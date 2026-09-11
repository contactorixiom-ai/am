import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateDocumentDto } from './dto/create-document.dto';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  create(ownerId: string, dto: CreateDocumentDto) {
    return this.prisma.document.create({
      data: {
        ownerId,
        category: dto.category,
        visibility: dto.visibility,
        title: dto.title,
        description: dto.description,
        fileUrl: dto.fileUrl,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        fileSize: dto.fileSize,
        missionId: dto.missionId,
        parcelId: dto.parcelId,
      },
    });
  }

  async list(user: AuthenticatedUser, opts: { skip: number; take: number; category?: DocumentCategory; missionId?: string }) {
    const where: Prisma.DocumentWhereInput = { ownerId: user.id };
    if (opts.category) where.category = opts.category;
    if (opts.missionId) where.missionId = opts.missionId;

    const [data, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        skip: opts.skip,
        take: opts.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.document.count({ where }),
    ]);
    return { data, total };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: { mission: { select: { clientId: true, driverId: true } } },
    });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.ownerId !== user.id && doc.visibility === 'PRIVATE') {
      const m = doc.mission;
      const isParticipant = m && (m.clientId === user.id || m.driverId === user.id);
      if (!isParticipant && user.role !== 'ADMIN') throw new ForbiddenException();
    }
    return doc;
  }

  async remove(id: string, user: AuthenticatedUser) {
    const doc = await this.prisma.document.findUnique({ where: { id }, select: { ownerId: true } });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.ownerId !== user.id && user.role !== 'ADMIN') throw new ForbiddenException();
    return this.prisma.document.delete({ where: { id } });
  }
}
