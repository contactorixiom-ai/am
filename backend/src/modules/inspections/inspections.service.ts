import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InspectionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AddInspectionPhotoDto } from './dto/add-photo.dto';
import { CreateInspectionDto } from './dto/create-inspection.dto';
import { SignInspectionDto } from './dto/sign-inspection.dto';

@Injectable()
export class InspectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(missionId: string, inspectorId: string, dto: CreateInspectionDto) {
    const mission = await this.prisma.mission.findUnique({
      where: { id: missionId },
      select: { clientId: true, driverId: true },
    });
    if (!mission) throw new NotFoundException('Mission not found');
    if (inspectorId !== mission.clientId && inspectorId !== mission.driverId) {
      throw new ForbiddenException('Not a mission participant');
    }
    return this.prisma.inspection.create({
      data: {
        missionId,
        inspectorId,
        ...dto,
      },
      include: { photos: true },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const insp = await this.prisma.inspection.findUnique({
      where: { id },
      include: {
        photos: true,
        mission: { select: { clientId: true, driverId: true } },
      },
    });
    if (!insp) throw new NotFoundException('Inspection not found');
    this.assertParticipant(insp.mission, user);
    return insp;
  }

  async listByMission(missionId: string, user: AuthenticatedUser) {
    const mission = await this.prisma.mission.findUnique({
      where: { id: missionId },
      select: { clientId: true, driverId: true },
    });
    if (!mission) throw new NotFoundException('Mission not found');
    this.assertParticipant(mission, user);
    return this.prisma.inspection.findMany({
      where: { missionId },
      include: { photos: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addPhoto(inspectionId: string, user: AuthenticatedUser, dto: AddInspectionPhotoDto) {
    const insp = await this.findOne(inspectionId, user);
    if (insp.status !== InspectionStatus.DRAFT && insp.status !== InspectionStatus.SUBMITTED) {
      throw new BadRequestException('Inspection already signed');
    }
    return this.prisma.inspectionPhoto.create({
      data: {
        inspectionId,
        url: dto.url,
        thumbnailUrl: dto.thumbnailUrl,
        tag: dto.tag,
        caption: dto.caption,
        latitude: dto.latitude,
        longitude: dto.longitude,
      },
    });
  }

  async submit(id: string, user: AuthenticatedUser) {
    const insp = await this.findOne(id, user);
    if (insp.status !== InspectionStatus.DRAFT) {
      throw new BadRequestException('Already submitted');
    }
    return this.prisma.inspection.update({
      where: { id },
      data: { status: InspectionStatus.SUBMITTED, submittedAt: new Date() },
    });
  }

  async sign(id: string, user: AuthenticatedUser, dto: SignInspectionDto) {
    const insp = await this.findOne(id, user);
    const allowed: InspectionStatus[] = [InspectionStatus.SUBMITTED, InspectionStatus.SIGNED];
    if (!allowed.includes(insp.status)) {
      throw new BadRequestException('Inspection must be submitted before signing');
    }
    const data: Record<string, unknown> = {};
    if (dto.party === 'CLIENT') {
      if (user.id !== insp.mission.clientId) throw new ForbiddenException('Only client can sign as CLIENT');
      data.clientSignatureUrl = dto.signatureUrl;
      data.clientSignedAt = new Date();
    } else {
      if (user.id !== insp.mission.driverId) throw new ForbiddenException('Only driver can sign as DRIVER');
      data.driverSignatureUrl = dto.signatureUrl;
      data.driverSignedAt = new Date();
    }

    const updated = await this.prisma.inspection.update({
      where: { id },
      data,
    });
    if (updated.clientSignedAt && updated.driverSignedAt) {
      return this.prisma.inspection.update({
        where: { id },
        data: { status: InspectionStatus.SIGNED },
      });
    }
    return updated;
  }

  private assertParticipant(
    mission: { clientId: string; driverId: string | null },
    user: AuthenticatedUser,
  ): void {
    if (user.role === 'ADMIN') return;
    if (user.id !== mission.clientId && user.id !== mission.driverId) {
      throw new ForbiddenException();
    }
  }
}
