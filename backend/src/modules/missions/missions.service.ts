import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MissionStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateMissionDto } from './dto/create-mission.dto';
import { SearchMissionsDto } from './dto/search-missions.dto';

@Injectable()
export class MissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(clientId: string, dto: CreateMissionDto) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } });
    if (!vehicle || vehicle.deletedAt) throw new NotFoundException('Vehicle not found');
    if (vehicle.ownerId !== clientId) {
      throw new ForbiddenException('You can only create missions for your own vehicles');
    }

    return this.prisma.mission.create({
      data: {
        clientId,
        vehicleId: dto.vehicleId,
        reference: this.generateReference(),
        status: MissionStatus.DRAFT,
        priority: dto.priority,
        pickupAddress: dto.pickupAddress,
        pickupCity: dto.pickupCity,
        pickupCountry: dto.pickupCountry.toUpperCase(),
        pickupPostalCode: dto.pickupPostalCode,
        pickupLatitude: dto.pickupLatitude,
        pickupLongitude: dto.pickupLongitude,
        pickupAt: new Date(dto.pickupAt),
        pickupNotes: dto.pickupNotes,
        deliveryAddress: dto.deliveryAddress,
        deliveryCity: dto.deliveryCity,
        deliveryCountry: dto.deliveryCountry.toUpperCase(),
        deliveryPostalCode: dto.deliveryPostalCode,
        deliveryLatitude: dto.deliveryLatitude,
        deliveryLongitude: dto.deliveryLongitude,
        deliveryAt: dto.deliveryAt ? new Date(dto.deliveryAt) : null,
        deliveryNotes: dto.deliveryNotes,
        statusHistory: {
          create: { status: MissionStatus.DRAFT, changedBy: clientId },
        },
      },
      include: { vehicle: true },
    });
  }

  async search(query: SearchMissionsDto, user: AuthenticatedUser) {
    const where: Prisma.MissionWhereInput = {};

    if (user.role === UserRole.CLIENT) {
      where.clientId = user.id;
    } else if (user.role === UserRole.DRIVER) {
      // Drivers see published missions or their accepted ones
      where.OR = [
        { status: MissionStatus.PUBLISHED },
        { driverId: user.id },
      ];
    }

    if (query.status) where.status = query.status;
    if (query.pickupCity) where.pickupCity = { equals: query.pickupCity, mode: 'insensitive' };
    if (query.deliveryCity) where.deliveryCity = { equals: query.deliveryCity, mode: 'insensitive' };
    if (query.country) {
      where.OR = [
        ...(Array.isArray(where.OR) ? where.OR : []),
        { pickupCountry: query.country.toUpperCase() },
        { deliveryCountry: query.country.toUpperCase() },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.mission.findMany({
        where,
        skip: query.skip,
        take: query.take,
        include: {
          vehicle: { select: { id: true, make: true, model: true, year: true, licensePlate: true } },
          client: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          driver: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
        orderBy: { pickupAt: 'asc' },
      }),
      this.prisma.mission.count({ where }),
    ]);
    return { data, total };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const mission = await this.prisma.mission.findUnique({
      where: { id },
      include: {
        vehicle: { include: { photos: true } },
        client: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, phone: true } },
        driver: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, phone: true } },
        inspections: { include: { photos: true } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!mission) throw new NotFoundException('Mission not found');
    this.assertCanView(mission, user);
    return mission;
  }

  async publish(id: string, userId: string) {
    const mission = await this.requireMission(id);
    if (mission.clientId !== userId) throw new ForbiddenException('Only the client can publish');
    if (mission.status !== MissionStatus.DRAFT) {
      throw new BadRequestException(`Cannot publish from status ${mission.status}`);
    }
    return this.transition(id, MissionStatus.PUBLISHED, userId);
  }

  async accept(id: string, driverId: string) {
    const mission = await this.requireMission(id);
    if (mission.status !== MissionStatus.PUBLISHED) {
      throw new BadRequestException('Mission not available');
    }
    return this.prisma.mission.update({
      where: { id },
      data: {
        driverId,
        status: MissionStatus.ACCEPTED,
        acceptedAt: new Date(),
        statusHistory: { create: { status: MissionStatus.ACCEPTED, changedBy: driverId } },
        conversation: {
          create: {
            type: 'MISSION',
            participants: {
              create: [{ userId: mission.clientId }, { userId: driverId }],
            },
          },
        },
      },
      include: { conversation: true },
    });
  }

  async start(id: string, driverId: string) {
    const mission = await this.requireMission(id);
    if (mission.driverId !== driverId) throw new ForbiddenException('Not assigned driver');
    if (mission.status !== MissionStatus.ACCEPTED) {
      throw new BadRequestException(`Cannot start from status ${mission.status}`);
    }
    return this.prisma.mission.update({
      where: { id },
      data: {
        status: MissionStatus.IN_PROGRESS,
        startedAt: new Date(),
        statusHistory: { create: { status: MissionStatus.IN_PROGRESS, changedBy: driverId } },
      },
    });
  }

  async deliver(id: string, driverId: string) {
    const mission = await this.requireMission(id);
    if (mission.driverId !== driverId) throw new ForbiddenException('Not assigned driver');
    if (mission.status !== MissionStatus.IN_PROGRESS) {
      throw new BadRequestException(`Cannot deliver from status ${mission.status}`);
    }
    return this.prisma.mission.update({
      where: { id },
      data: {
        status: MissionStatus.DELIVERED,
        deliveredAt: new Date(),
        statusHistory: { create: { status: MissionStatus.DELIVERED, changedBy: driverId } },
      },
    });
  }

  async complete(id: string, userId: string) {
    const mission = await this.requireMission(id);
    if (mission.clientId !== userId) throw new ForbiddenException('Only client can complete');
    if (mission.status !== MissionStatus.DELIVERED) {
      throw new BadRequestException(`Cannot complete from status ${mission.status}`);
    }
    return this.prisma.mission.update({
      where: { id },
      data: {
        status: MissionStatus.COMPLETED,
        completedAt: new Date(),
        statusHistory: { create: { status: MissionStatus.COMPLETED, changedBy: userId } },
      },
    });
  }

  async cancel(id: string, userId: string, reason?: string) {
    const mission = await this.requireMission(id);
    if (mission.clientId !== userId && mission.driverId !== userId) {
      throw new ForbiddenException();
    }
    if ([MissionStatus.COMPLETED, MissionStatus.CANCELLED].includes(mission.status)) {
      throw new BadRequestException(`Cannot cancel from status ${mission.status}`);
    }
    return this.prisma.mission.update({
      where: { id },
      data: {
        status: MissionStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: reason,
        statusHistory: { create: { status: MissionStatus.CANCELLED, changedBy: userId, notes: reason } },
      },
    });
  }

  private async transition(id: string, status: MissionStatus, userId: string) {
    return this.prisma.mission.update({
      where: { id },
      data: {
        status,
        statusHistory: { create: { status, changedBy: userId } },
      },
    });
  }

  private async requireMission(id: string) {
    const mission = await this.prisma.mission.findUnique({ where: { id } });
    if (!mission) throw new NotFoundException('Mission not found');
    return mission;
  }

  private assertCanView(mission: { clientId: string; driverId: string | null; status: MissionStatus }, user: AuthenticatedUser): void {
    if (user.role === UserRole.ADMIN) return;
    if (user.id === mission.clientId) return;
    if (user.id === mission.driverId) return;
    if (user.role === UserRole.DRIVER && mission.status === MissionStatus.PUBLISHED) return;
    throw new ForbiddenException();
  }

  private generateReference(): string {
    const stamp = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `AXI-${stamp}-${rand}`;
  }
}
