import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InspectionStatus, InspectionType, NotificationType, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AddInspectionPhotoDto } from './dto/add-photo.dto';
import { CreateInspectionDto } from './dto/create-inspection.dto';
import { SignInspectionDto } from './dto/sign-inspection.dto';

@Injectable()
export class InspectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(missionId: string, inspectorId: string, dto: CreateInspectionDto) {
    const mission = await this.prisma.mission.findUnique({
      where: { id: missionId },
      select: { clientId: true, driverId: true, reference: true },
    });
    if (!mission) throw new NotFoundException('Mission not found');
    if (inspectorId !== mission.clientId && inspectorId !== mission.driverId) {
      throw new ForbiddenException('Not a mission participant');
    }

    const data = {
      mileage: dto.mileage,
      fuelLevel: dto.fuelLevel,
      exteriorNotes: dto.exteriorNotes,
      interiorNotes: dto.interiorNotes,
      damageNotes: dto.damageNotes,
      generalNotes: dto.generalNotes,
      damages: (dto.damages ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
      controls: (dto.controls ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
    };

    // Un seul état des lieux par phase : deux PV de départ contradictoires
    // sur le même convoyage n'ont aucune valeur. Tant qu'il est en
    // brouillon, on le remplace ; une fois soumis ou signé, il est figé.
    const existing = await this.prisma.inspection.findUnique({
      where: { missionId_type: { missionId, type: dto.type } },
      select: { id: true, status: true },
    });
    if (existing) {
      if (existing.status !== InspectionStatus.DRAFT) {
        throw new BadRequestException(
          `Un état des lieux ${dto.type === InspectionType.PRE_DEPARTURE ? 'de départ' : "d'arrivée"} existe déjà pour ce convoyage.`,
        );
      }
      return this.prisma.inspection.update({
        where: { id: existing.id },
        data: { ...data, inspectorId },
        include: { photos: true },
      });
    }

    return this.prisma.inspection.create({
      data: { missionId, inspectorId, type: dto.type, ...data },
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
    if (insp.status === InspectionStatus.SIGNED) {
      // Un PV contradictoire signé des deux parties ne se rejoue pas : c'est
      // la pièce qui tranche un litige de dommages.
      throw new BadRequestException('Cet état des lieux est signé par les deux parties.');
    }
    if (insp.status !== InspectionStatus.SUBMITTED) {
      throw new BadRequestException('Inspection must be submitted before signing');
    }
    const data: Prisma.InspectionUpdateInput = {};
    if (dto.party === 'CLIENT') {
      // Le client signe soit depuis son compte, soit sur le téléphone du
      // convoyeur au moment de la remise — c'est le cas courant, et c'est
      // exactement ce que fait un constat papier. On enregistre alors que la
      // signature a été recueillie en présence, sans le maquiller.
      const inPerson = user.id === insp.mission.driverId;
      if (user.id !== insp.mission.clientId && !inPerson) {
        throw new ForbiddenException('Seuls le client ou son convoyeur peuvent apposer la signature client.');
      }
      if (insp.clientSignedAt) throw new BadRequestException('Le client a déjà signé cet état des lieux.');
      data.clientSignatureUrl = dto.signatureUrl;
      data.clientSignedAt = new Date();
      data.clientSignedInPerson = inPerson;
    } else {
      if (user.id !== insp.mission.driverId) throw new ForbiddenException('Only driver can sign as DRIVER');
      if (insp.driverSignedAt) throw new BadRequestException('Le convoyeur a déjà signé cet état des lieux.');
      data.driverSignatureUrl = dto.signatureUrl;
      data.driverSignedAt = new Date();
    }

    let updated = await this.prisma.inspection.update({ where: { id }, data });
    if (updated.clientSignedAt && updated.driverSignedAt) {
      updated = await this.prisma.inspection.update({
        where: { id },
        data: { status: InspectionStatus.SIGNED },
      });
    }

    await this.announce(insp.missionId, updated.type, updated.status, user.id);
    return updated;
  }

  /**
   * Prévient l'autre partie et Axis. Un état des lieux qui reste dans le
   * téléphone de celui qui l'a rempli ne sert à rien le jour du litige.
   */
  private async announce(
    missionId: string,
    type: string,
    status: InspectionStatus,
    actorId: string,
  ): Promise<void> {
    const mission = await this.prisma.mission.findUnique({
      where: { id: missionId },
      select: { reference: true, clientId: true, driverId: true },
    });
    if (!mission) return;
    const phase = type === InspectionType.PRE_DEPARTURE ? 'de prise en charge' : 'de livraison';
    const complet = status === InspectionStatus.SIGNED;
    const admins = await this.prisma.user.findMany({
      where: { role: UserRole.ADMIN, deletedAt: null },
      select: { id: true },
    });
    const targets = new Set(
      [mission.clientId, mission.driverId, ...admins.map((a) => a.id)].filter(
        (x): x is string => !!x && x !== actorId,
      ),
    );
    await Promise.all(
      [...targets].map((userId) =>
        this.notifications
          .notify(
            userId,
            NotificationType.INSPECTION_SIGNED,
            complet ? `État des lieux ${phase} signé` : `Signature d'un état des lieux ${phase}`,
            complet
              ? `L'état des lieux ${phase} du convoyage ${mission.reference} est signé par les deux parties.`
              : `Une signature vient d'être apposée sur l'état des lieux ${phase} du convoyage ${mission.reference}.`,
            { missionId, reference: mission.reference, type } as never,
          )
          .catch(() => { /* la signature reste valable si la notification échoue */ }),
      ),
    );
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
