import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KycDocument, KycStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { ReviewKycDto } from './dto/review-kyc.dto';
import { SubmitKycDto } from './dto/submit-kyc.dto';

/** Statut KYC global agrégé à partir des documents déposés. */
export type GlobalKycStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface KycOverview {
  status: GlobalKycStatus;
  documents: KycDocument[];
  counts: { total: number; pending: number; approved: number; rejected: number };
}

const KYC_LABELS: Record<string, string> = {
  IDENTITY_CARD: 'Pièce d\'identité',
  PASSPORT: 'Passeport',
  DRIVER_LICENSE: 'Permis de conduire',
  PROOF_OF_ADDRESS: 'Justificatif de domicile',
};

@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Dépose un document KYC (le fichier a déjà été uploadé via /storage). */
  async submit(userId: string, dto: SubmitKycDto): Promise<KycDocument> {
    // Le fichier doit venir de notre stockage, dossier kyc, et n'appartenir à
    // personne d'autre : l'accès aux pièces d'identité se fonde sur ce lien,
    // on ne peut donc pas laisser quelqu'un « déclarer » le fichier d'autrui.
    if (!/\/storage\/file\/kyc\/[0-9a-f-]{36}(\.[a-z0-9]{1,8})?$/i.test(dto.fileUrl)) {
      throw new BadRequestException('Fichier invalide : envoyez la photo depuis l\'application.');
    }
    const suffix = dto.fileUrl.slice(dto.fileUrl.indexOf('/storage/file/kyc/'));
    const taken = await this.prisma.kycDocument.findFirst({
      where: { fileUrl: { endsWith: suffix }, userId: { not: userId } },
      select: { id: true },
    });
    if (taken) throw new BadRequestException('Fichier déjà utilisé.');

    return this.prisma.kycDocument.create({
      data: {
        userId,
        type: dto.type,
        fileUrl: dto.fileUrl,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        fileSize: dto.fileSize,
        notes: dto.notes,
        status: KycStatus.PENDING,
      },
    });
  }

  /** Liste les documents d'un utilisateur + statut KYC global agrégé. */
  async overview(userId: string): Promise<KycOverview> {
    const documents = await this.prisma.kycDocument.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const counts = {
      total: documents.length,
      pending: documents.filter((d) => d.status === KycStatus.PENDING).length,
      approved: documents.filter((d) => d.status === KycStatus.APPROVED).length,
      rejected: documents.filter((d) => d.status === KycStatus.REJECTED).length,
    };

    return { status: this.aggregateStatus(documents), documents, counts };
  }

  /** Admin : documents en attente de vérification, les plus anciens d'abord. */
  async pending() {
    return this.prisma.kycDocument.findMany({
      where: { status: KycStatus.PENDING, user: { deletedAt: null } },
      orderBy: { createdAt: 'asc' },
      take: 200,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true } },
      },
    });
  }

  /** Revue admin : approuve ou rejette un document. */
  async review(reviewerId: string, documentId: string, dto: ReviewKycDto): Promise<KycDocument> {
    const doc = await this.prisma.kycDocument.findUnique({ where: { id: documentId } });
    if (!doc) throw new NotFoundException('Document KYC introuvable');

    if (dto.status === KycStatus.REJECTED && !dto.notes?.trim()) {
      throw new BadRequestException('Un motif est requis pour rejeter un document');
    }

    const updated = await this.prisma.kycDocument.update({
      where: { id: documentId },
      data: {
        status: dto.status,
        notes: dto.notes ?? doc.notes,
        reviewedAt: new Date(),
        reviewedBy: reviewerId,
      },
    });

    // Journalisation conformité (audit trail).
    await this.prisma.auditLog.create({
      data: {
        userId: reviewerId,
        action: dto.status === KycStatus.APPROVED ? 'KYC_APPROVE' : 'KYC_REJECT',
        entity: 'KycDocument',
        entityId: documentId,
        metadata: { targetUserId: doc.userId, type: doc.type, notes: dto.notes },
      },
    });

    // Le convoyeur attendait sans savoir : il devait rouvrir l'application
    // pour découvrir qu'il pouvait enfin accepter des missions, ou qu'un
    // document était à refaire.
    const label = KYC_LABELS[doc.type] ?? 'Document';
    await this.notifications
      .notify(
        doc.userId,
        dto.status === KycStatus.APPROVED ? 'KYC_APPROVED' : 'KYC_REJECTED',
        dto.status === KycStatus.APPROVED ? `${label} validé` : `${label} à refaire`,
        dto.status === KycStatus.APPROVED
          ? 'Votre document a été vérifié par Axis Import.'
          : `Motif : ${dto.notes?.trim()}. Déposez un nouveau document depuis votre profil.`,
        { kycDocumentId: documentId },
      )
      .catch(() => { /* la décision est enregistrée même si l'envoi échoue */ });

    return updated;
  }

  /**
   * Statut global :
   * - aucun document → NONE
   * - au moins un rejeté → REJECTED (l'utilisateur doit le re-déposer)
   * - tous approuvés → APPROVED
   * - sinon → PENDING
   */
  private aggregateStatus(documents: KycDocument[]): GlobalKycStatus {
    if (documents.length === 0) return 'NONE';
    if (documents.some((d) => d.status === KycStatus.REJECTED)) return 'REJECTED';
    if (documents.every((d) => d.status === KycStatus.APPROVED)) return 'APPROVED';
    return 'PENDING';
  }
}
