import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SaveAdminDocumentDto } from './save-admin-document.dto';

/**
 * Historique et numérotation des documents officiels (douane, factures,
 * étiquettes…), partagés par toute l'équipe Axis. Ils vivaient dans le
 * navigateur du téléphone de l'administrateur : perdus en changeant
 * d'appareil, et deux personnes pouvaient sortir le même numéro.
 */
/** Documents chiffrés que seul l'administrateur voit et émet. */
export const ADMIN_ONLY_TYPES = ['invoice'];

@Injectable()
export class AdminDocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: { role: UserRole }, take = 200) {
    return this.prisma.adminDocument.findMany({
      // Les factures clients sont des chiffres : administrateur seulement.
      where: user.role === UserRole.ADMIN ? {} : { typeId: { notIn: ADMIN_ONLY_TYPES } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(take, 1), 500),
    });
  }

  async save(user: { id: string; role: UserRole }, dto: SaveAdminDocumentDto) {
    if (user.role !== UserRole.ADMIN && ADMIN_ONLY_TYPES.includes(dto.typeId)) {
      throw new ForbiddenException('Les factures clients sont réservées à l\'administrateur.');
    }
    const author = await this.prisma.user.findUnique({ where: { id: user.id }, select: { firstName: true, lastName: true } });
    const data = {
      typeId: dto.typeId,
      typeLabel: dto.typeLabel,
      reference: dto.reference,
      activity: dto.activity,
      values: dto.values as Prisma.InputJsonValue,
      createdById: user.id,
      createdByName: author ? `${author.firstName} ${author.lastName}`.trim() : 'Axis',
      ...(dto.createdAt ? { createdAt: new Date(dto.createdAt) } : {}),
    };
    // Reprise de l'ancien historique local : un même identifiant n'est
    // enregistré qu'une fois.
    if (dto.clientRef) {
      return this.prisma.adminDocument.upsert({
        where: { clientRef: dto.clientRef },
        create: { ...data, clientRef: dto.clientRef },
        update: {},
      });
    }
    return this.prisma.adminDocument.create({ data });
  }

  /** Prochain numéro de l'année pour ce type, sans le consommer. */
  async peek(typeId: string): Promise<{ year: number; seq: number }> {
    const year = new Date().getFullYear();
    const row = await this.prisma.documentSequence.findUnique({ where: { typeId_year: { typeId, year } } });
    return { year, seq: (row?.seq ?? 0) + 1 };
  }

  /**
   * Enregistre le numéro utilisé : le compteur ne recule jamais, et un
   * numéro saisi à la main plus haut que le compteur le fait avancer.
   */
  async commit(typeId: string, used?: number): Promise<{ year: number; seq: number }> {
    const year = new Date().getFullYear();
    const rows = await this.prisma.$queryRaw<{ seq: number }[]>`
      INSERT INTO "DocumentSequence" ("typeId", "year", "seq")
      VALUES (${typeId}, ${year}, ${used && used > 0 ? used : 1})
      ON CONFLICT ("typeId", "year") DO UPDATE
        SET "seq" = GREATEST("DocumentSequence"."seq" + ${used && used > 0 ? 0 : 1}, ${used && used > 0 ? used : 0})
      RETURNING "seq"`;
    return { year, seq: Number(rows[0]?.seq ?? 1) };
  }
}
