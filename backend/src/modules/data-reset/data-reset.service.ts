import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

export const RESET_ACTION = 'DATA_RESET';
export const RESET_CONFIRMATION = 'EFFACER';

export interface ResetKeep {
  missionIds?: string[];
  parcelIds?: string[];
}

/**
 * Remise à zéro avant le lancement : efface l'activité de test (convoyages,
 * colis, devis, paiements, factures, documents, états des lieux, messages,
 * notifications, historique des documents officiels).
 *
 * Roger peut garder des opérations réelles : elles restent intactes avec
 * leur règlement, leur facture, leurs documents, leur suivi et leur
 * conversation. Les comptes (clients, convoyeurs, équipe), leurs pièces
 * d'identité, les actualités et les référentiels sont toujours conservés.
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

  /**
   * Toutes les opérations, la plus ancienne d'abord : pour choisir celles à
   * garder, et pour télécharger les données de test avant de les effacer.
   */
  async operations() {
    const p = this.prisma;
    const person = { select: { firstName: true, lastName: true, email: true, phone: true, companyName: true } };
    const [missions, parcels, payments] = await Promise.all([
      p.mission.findMany({
        orderBy: { createdAt: 'asc' },
        include: { client: person, driver: person, vehicle: { select: { make: true, model: true, licensePlate: true } } },
      }),
      p.parcel.findMany({
        orderBy: { createdAt: 'asc' },
        include: { sender: person, items: { select: { description: true, quantity: true } } },
      }),
      p.payment.findMany({ select: { missionId: true, parcelId: true, status: true, amountCents: true, invoiceNumber: true, paidAt: true } }),
    ]);
    const payOf = (where: { missionId?: string; parcelId?: string }) => {
      const list = payments.filter((x) => (where.missionId ? x.missionId === where.missionId : x.parcelId === where.parcelId));
      return list.find((x) => x.status === 'PAID') ?? list[0] ?? null;
    };
    const name = (u: { firstName: string; lastName: string; companyName: string | null } | null) =>
      u ? `${u.companyName ? `${u.companyName} — ` : ''}${u.firstName} ${u.lastName}`.trim() : '';
    return [
      ...missions.map((m) => {
        const pay = payOf({ missionId: m.id });
        return {
          kind: 'mission' as const,
          id: m.id,
          reference: m.reference,
          createdAt: m.createdAt,
          status: m.status,
          route: `${m.pickupCity} → ${m.deliveryCity}`,
          clientName: name(m.client),
          clientEmail: m.client?.email ?? '',
          clientPhone: m.client?.phone ?? '',
          detail: `${m.vehicle.make} ${m.vehicle.model} (${m.vehicle.licensePlate})`,
          recipient: '',
          driverName: m.driver ? `${m.driver.firstName} ${m.driver.lastName}` : '',
          priceCents: m.priceCents,
          paymentStatus: pay?.status ?? null,
          paidCents: pay?.status === 'PAID' ? pay.amountCents : null,
          invoiceNumber: pay?.invoiceNumber ?? null,
        };
      }),
      ...parcels.map((x) => {
        const pay = payOf({ parcelId: x.id });
        return {
          kind: 'parcel' as const,
          id: x.id,
          reference: x.reference,
          createdAt: x.createdAt,
          status: x.status,
          route: `${x.originCity} → ${x.destinationCity} (${x.destinationCountry})`,
          clientName: name(x.sender),
          clientEmail: x.sender?.email ?? '',
          clientPhone: x.sender?.phone ?? '',
          detail: [x.items.map((i) => `${i.quantity} × ${i.description}`).join(', '), x.description ? `Déclaré : ${x.description}` : '']
            .filter(Boolean)
            .join(' · '),
          recipient: `${x.recipientFirstName} ${x.recipientLastName} · ${x.recipientPhone}`.trim(),
          driverName: '',
          priceCents: x.priceCents,
          paymentStatus: pay?.status ?? null,
          paidCents: pay?.status === 'PAID' ? pay.amountCents : null,
          invoiceNumber: pay?.invoiceNumber ?? null,
        };
      }),
    ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async reset(adminId: string, confirmation: string, keep: ResetKeep = {}) {
    if ((confirmation ?? '').trim().toUpperCase() !== RESET_CONFIRMATION) {
      throw new BadRequestException(`Tape « ${RESET_CONFIRMATION} » pour confirmer.`);
    }
    const done = await this.doneAt();
    if (done) {
      throw new ConflictException(`La remise à zéro a déjà été faite le ${done.toLocaleDateString('fr-FR')}.`);
    }
    const p = this.prisma;

    // Opérations gardées : uniquement des identifiants qui existent.
    const [keptMissions, keptParcels] = await Promise.all([
      keep.missionIds?.length
        ? p.mission.findMany({ where: { id: { in: keep.missionIds } }, select: { id: true, reference: true, clientId: true, vehicleId: true } })
        : Promise.resolve([]),
      keep.parcelIds?.length
        ? p.parcel.findMany({ where: { id: { in: keep.parcelIds } }, select: { id: true, reference: true, senderId: true } })
        : Promise.resolve([]),
    ]);
    const mIds = keptMissions.map((m) => m.id);
    const pIds = keptParcels.map((x) => x.id);
    const keptRefs = [...keptMissions, ...keptParcels].map((o) => o.reference);
    const keptClients = [...new Set([...keptMissions.map((m) => m.clientId), ...keptParcels.map((x) => x.senderId)])];
    const keptVehicles = [...new Set(keptMissions.map((m) => m.vehicleId))];

    const notMission = { notIn: mIds };
    // Paiements, documents et conversations gardés : calculés ici, puis tout
    // le reste est effacé par identifiant (un filtre « NOT IN » laisserait
    // passer les lignes sans opération, à valeur NULL).
    const linked = <T extends { missionId: string | null; parcelId: string | null }>(r: T) =>
      (!!r.missionId && mIds.includes(r.missionId)) || (!!r.parcelId && pIds.includes(r.parcelId));
    const [allPayments, allDocuments, allConversations] = await Promise.all([
      p.payment.findMany({ select: { id: true, missionId: true, parcelId: true, invoiceNumber: true } }),
      p.document.findMany({ select: { id: true, missionId: true, parcelId: true } }),
      p.conversation.findMany({ select: { id: true, missionId: true, parcelId: true, participants: { select: { userId: true } } } }),
    ]);
    const keptPayments = allPayments.filter(linked);
    const keptPaymentIds = keptPayments.map((x) => x.id);
    const keptDocumentIds = allDocuments.filter(linked).map((x) => x.id);
    // Conversations : celles des opérations gardées, et les échanges directs
    // avec leurs clients (questions avant commande).
    const keptConversationIds = allConversations
      .filter((c) => linked(c) || (!c.missionId && !c.parcelId && c.participants.some((u) => keptClients.includes(u.userId))))
      .map((c) => c.id);
    const paymentGone: Prisma.PaymentWhereInput = { id: { notIn: keptPaymentIds } };
    const documentGone: Prisma.DocumentWhereInput = { id: { notIn: keptDocumentIds } };
    const conversationGone: Prisma.ConversationWhereInput = { id: { notIn: keptConversationIds } };

    // Documents officiels qui citent une opération gardée : conservés.
    const adminDocs = await p.adminDocument.findMany({ select: { id: true, typeId: true, reference: true, values: true } });
    const keptAdminDocs = adminDocs.filter((d) => {
      const text = `${d.reference} ${JSON.stringify(d.values ?? {})}`;
      return keptRefs.some((ref) => text.includes(ref));
    });
    const keptAdminDocIds = keptAdminDocs.map((d) => d.id);
    const keptDocTypes = [...new Set(keptAdminDocs.map((d) => d.typeId))];

    // Numérotation des factures : elle repart après la dernière facture gardée.
    const lastByYear = new Map<number, number>();
    for (const { invoiceNumber } of keptPayments) {
      const m = /-(\d{4})-(\d+)$/.exec(invoiceNumber ?? '');
      if (m) lastByYear.set(Number(m[1]), Math.max(lastByYear.get(Number(m[1])) ?? 0, Number(m[2])));
    }

    const before = await this.preview();

    // Fichiers liés à ce qui part, effacés du disque après la base.
    const [docs, inspectionPhotos, vehiclePhotos, attachments] = await Promise.all([
      p.document.findMany({ where: documentGone, select: { fileUrl: true, signatureUrl: true } }),
      p.inspectionPhoto.findMany({ where: { inspection: { missionId: notMission } }, select: { url: true, thumbnailUrl: true } }),
      p.vehiclePhoto.findMany({ where: { vehicleId: { notIn: keptVehicles } }, select: { url: true } }),
      p.message.findMany({ where: { attachmentUrl: { not: null }, conversation: conversationGone }, select: { attachmentUrl: true } }),
    ]);
    const files = [
      ...docs.flatMap((d) => [d.fileUrl, d.signatureUrl]),
      ...inspectionPhotos.flatMap((i) => [i.url, i.thumbnailUrl]),
      ...vehiclePhotos.map((v) => v.url),
      ...attachments.map((m) => m.attachmentUrl),
    ].filter((u): u is string => !!u);

    // Des feuilles vers les racines : aucune contrainte ne bloque.
    await p.$transaction([
      p.payment.deleteMany({ where: paymentGone }),
      p.invoiceSequence.deleteMany(),
      ...[...lastByYear].map(([year, last]) => p.invoiceSequence.create({ data: { year, last } })),
      p.review.deleteMany({ where: { missionId: { notIn: mIds } } }),
      p.call.deleteMany({ where: { conversation: conversationGone } }),
      p.message.deleteMany({ where: { conversation: conversationGone } }),
      p.conversationParticipant.deleteMany({ where: { conversation: conversationGone } }),
      p.conversation.deleteMany({ where: conversationGone }),
      p.notification.deleteMany(),
      p.document.deleteMany({ where: documentGone }),
      p.inspectionPhoto.deleteMany({ where: { inspection: { missionId: notMission } } }),
      p.inspection.deleteMany({ where: { missionId: { notIn: mIds } } }),
      p.missionLocation.deleteMany({ where: { missionId: { notIn: mIds } } }),
      p.missionStatusHistory.deleteMany({ where: { missionId: { notIn: mIds } } }),
      p.quoteOption.deleteMany(),
      p.quote.deleteMany(),
      p.mission.deleteMany({ where: { id: { notIn: mIds } } }),
      p.cargoTrackingNote.deleteMany({ where: pIds.length ? { OR: [{ parcelId: null }, { parcelId: { notIn: pIds } }] } : {} }),
      p.parcelTrackingEvent.deleteMany({ where: { parcelId: { notIn: pIds } } }),
      p.parcelItem.deleteMany({ where: { parcelId: { notIn: pIds } } }),
      p.parcel.deleteMany({ where: { id: { notIn: pIds } } }),
      p.vehiclePhoto.deleteMany({ where: { vehicleId: { notIn: keptVehicles } } }),
      p.vehicle.deleteMany({ where: { id: { notIn: keptVehicles } } }),
      p.adminDocument.deleteMany({ where: { id: { notIn: keptAdminDocIds } } }),
      p.documentSequence.deleteMany({ where: { typeId: { notIn: keptDocTypes } } }),
      // Compteurs des convoyeurs : recalculés plus bas sur ce qui reste.
      p.driverProfile.updateMany({ data: { completedMissions: 0, averageRating: 0, ratingCount: 0 } }),
      p.auditLog.create({
        data: {
          userId: adminId,
          action: RESET_ACTION,
          entity: 'Database',
          metadata: { erased: { ...before, doneAt: undefined }, kept: keptRefs },
        },
      }),
    ]);

    if (mIds.length) await this.recountDrivers();

    let removed = 0;
    for (const url of files) {
      if (await this.storage.removeByUrl(url).catch(() => false)) removed += 1;
    }
    const after = await this.preview();
    this.logger.warn(`Remise à zéro par ${adminId} : gardé ${keptRefs.join(', ') || 'rien'} · ${removed} fichier(s) supprimé(s).`);
    return { ...after, kept: keptRefs, filesRemoved: removed };
  }

  /** Missions terminées et avis des convoyeurs, d'après les missions gardées. */
  private async recountDrivers() {
    const p = this.prisma;
    const [done, reviews] = await Promise.all([
      p.mission.groupBy({ by: ['driverId'], where: { driverId: { not: null }, status: { in: ['DELIVERED', 'COMPLETED'] } }, _count: { _all: true } }),
      p.review.groupBy({ by: ['targetId'], _avg: { rating: true }, _count: { _all: true } }),
    ]);
    for (const d of done) {
      if (!d.driverId) continue;
      await p.driverProfile.updateMany({ where: { userId: d.driverId }, data: { completedMissions: d._count._all } });
    }
    for (const r of reviews) {
      await p.driverProfile.updateMany({
        where: { userId: r.targetId },
        data: { averageRating: r._avg.rating ?? 0, ratingCount: r._count._all },
      });
    }
  }
}
