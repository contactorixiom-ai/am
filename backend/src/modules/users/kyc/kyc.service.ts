import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KycDocument, KycStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ReviewKycDto } from './dto/review-kyc.dto';
import { SubmitKycDto } from './dto/submit-kyc.dto';

/** Statut KYC global agrégé à partir des documents déposés. */
export type GlobalKycStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface KycOverview {
  status: GlobalKycStatus;
  documents: KycDocument[];
  counts: { total: number; pending: number; approved: number; rejected: number };
}

@Injectable()
export class KycService {
  constructor(private readonly prisma: PrismaService) {}

  /** Dépose un document KYC (le fichier a déjà été uploadé via /storage). */
  async submit(userId: string, dto: SubmitKycDto): Promise<KycDocument> {
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
