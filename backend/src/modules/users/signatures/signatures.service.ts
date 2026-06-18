import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { SignDocumentDto } from './dto/sign-document.dto';

@Injectable()
export class SignaturesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Appose une signature électronique sur un document :
   *  - vérifie les droits (propriétaire, participant à la mission, ou ADMIN),
   *  - pose `signedAt`, `signatureUrl`, `signedBy` sur le document,
   *  - trace l'opération dans un AuditLog.
   */
  async sign(documentId: string, user: AuthenticatedUser, dto: SignDocumentDto) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: { mission: { select: { clientId: true, driverId: true } } },
    });
    if (!doc) throw new NotFoundException('Document introuvable');

    const isOwner = doc.ownerId === user.id;
    const m = doc.mission;
    const isParticipant = !!m && (m.clientId === user.id || m.driverId === user.id);
    if (!isOwner && !isParticipant && user.role !== 'ADMIN') {
      throw new ForbiddenException('Vous ne pouvez pas signer ce document');
    }

    if (doc.signedAt) {
      throw new ConflictException('Ce document est déjà signé');
    }

    const updated = await this.prisma.document.update({
      where: { id: documentId },
      data: { signedAt: new Date(), signatureUrl: dto.signatureUrl, signedBy: user.id },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'DOCUMENT_SIGN',
        entity: 'Document',
        entityId: documentId,
        metadata: { signatureUrl: dto.signatureUrl },
      },
    });

    return {
      id: updated.id,
      signedAt: updated.signedAt,
      signatureUrl: updated.signatureUrl,
      signedBy: updated.signedBy,
    };
  }
}
