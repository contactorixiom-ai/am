import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

export const RESET_ACTION = 'DATA_RESET';
export const RESET_CONFIRMATION = 'EFFACER';

/**
 * Remise à zéro avant le lancement : efface toute l'activité de test
 * (convoyages, colis, devis, paiements, factures, documents, états des lieux,
 * messages, notifications, historique des documents officiels) et remet les
 * numérotations à 1. Les comptes (clients, convoyeurs, équipe), leurs pièces
 * d'identité, les actualités et les référentiels sont conservés.
 *
 * Utilisable une seule fois : la remise à zéro est inscrite au journal.
 */
@Injectable()
export class DataResetService {
  private readonly logger = new Logger(DataResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** Date de la remise à zéro, si elle a déjà eu lieu. */
  async doneAt(): Promise<Date | null> {
    const log = await this.prisma.auditLog.findFirst({ where: { action: RESET_ACTION }, orderBy: { createdAt: 'desc' } });
    return log?.createdAt ?? null;
  }

  /** Ce qui serait effacé, pour que Roger confirme en connaissance de cause. */
  async preview() {
    const p = this.prisma;
    const [missions, parcels, quotes, payments, documents, inspections, conversations, notifications, adminDocuments, vehicles, doneAt] =
      await Promise.all([
        p.mission.count(),
        p.parcel.count(),
        p.quote.count(),
        p.payment.count(),
        p.document.count(),
        p.inspection.count(),
        p.conversation.count(),
        p.notification.count(),
        p.adminDocument.count(),
        p.vehicle.count(),
        this.doneAt(),
      ]);
    return { missions, parcels, quotes, payments, documents, inspections, conversations, notifications, adminDocuments, vehicles, doneAt };
  }

  async reset(adminId: string, confirmation: string) {
    if ((confirmation ?? '').trim().toUpperCase() !== RESET_CONFIRMATION) {
      throw new BadRequestException(`Tape « ${RESET_CONFIRMATION} » pour confirmer.`);
    }
    const done = await this.doneAt();
    if (done) {
      throw new ConflictException(`La remise à zéro a déjà été faite le ${done.toLocaleDateString('fr-FR')}.`);
    }
    const before = await this.preview();
    const p = this.prisma;

    // Fichiers liés à l'activité, effacés du disque après la base.
    const [docs, inspectionPhotos, vehiclePhotos, attachments] = await Promise.all([
      p.document.findMany({ select: { fileUrl: true, signatureUrl: true } }),
      p.inspectionPhoto.findMany({ select: { url: true, thumbnailUrl: true } }),
      p.vehiclePhoto.findMany({ select: { url: true } }),
      p.message.findMany({ where: { attachmentUrl: { not: null } }, select: { attachmentUrl: true } }),
    ]);
    const files = [
      ...docs.flatMap((d) => [d.fileUrl, d.signatureUrl]),
      ...inspectionPhotos.flatMap((i) => [i.url, i.thumbnailUrl]),
      ...vehiclePhotos.map((v) => v.url),
      ...attachments.map((m) => m.attachmentUrl),
    ].filter((u): u is string => !!u);

    // Des feuilles vers les racines : aucune contrainte ne bloque.
    await p.$transaction([
      p.payment.deleteMany(),
      p.invoiceSequence.deleteMany(),
      p.review.deleteMany(),
      p.call.deleteMany(),
      p.message.deleteMany(),
      p.conversationParticipant.deleteMany(),
      p.conversation.deleteMany(),
      p.notification.deleteMany(),
      p.document.deleteMany(),
      p.inspectionPhoto.deleteMany(),
      p.inspection.deleteMany(),
      p.missionLocation.deleteMany(),
      p.missionStatusHistory.deleteMany(),
      p.quoteOption.deleteMany(),
      p.quote.deleteMany(),
      p.mission.deleteMany(),
      p.cargoTrackingNote.deleteMany(),
      p.parcelTrackingEvent.deleteMany(),
      p.parcelItem.deleteMany(),
      p.parcel.deleteMany(),
      p.vehiclePhoto.deleteMany(),
      p.vehicle.deleteMany(),
      p.adminDocument.deleteMany(),
      p.documentSequence.deleteMany(),
      // Compteurs des convoyeurs : plus aucune mission ni avis.
      p.driverProfile.updateMany({ data: { completedMissions: 0, averageRating: 0, ratingCount: 0 } }),
      p.auditLog.create({
        data: { userId: adminId, action: RESET_ACTION, entity: 'Database', metadata: { erased: { ...before, doneAt: undefined } } },
      }),
    ]);

    let removed = 0;
    for (const url of files) {
      if (await this.storage.removeByUrl(url).catch(() => false)) removed += 1;
    }
    this.logger.warn(`Remise à zéro par ${adminId} : ${JSON.stringify(before)} · ${removed} fichier(s) supprimé(s).`);
    return { ...before, doneAt: new Date(), filesRemoved: removed };
  }
}
