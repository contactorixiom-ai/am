import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MissionStatus, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { TrackLocationDto } from './dto/track-location.dto';

@Injectable()
export class GpsService {
  constructor(private readonly prisma: PrismaService) {}

  async track(missionId: string, driverId: string, dto: TrackLocationDto) {
    const mission = await this.prisma.mission.findUnique({
      where: { id: missionId },
      select: { driverId: true, status: true },
    });
    if (!mission) throw new NotFoundException('Mission introuvable.');
    if (mission.driverId !== driverId) throw new ForbiddenException('Vous n\'êtes pas le convoyeur affecté à cette mission.');
    if (mission.status !== MissionStatus.IN_PROGRESS) {
      throw new ForbiddenException('La mission n\'est pas en cours.');
    }
    return this.prisma.missionLocation.create({
      data: {
        missionId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracy,
        speedKmh: dto.speedKmh,
        heading: dto.heading,
        altitude: dto.altitude,
      },
    });
  }

  /**
   * Position et trace d'un convoyage : visibles par son client, son
   * convoyeur et Axis uniquement. Elles étaient lisibles par n'importe quel
   * compte connecté.
   */
  async assertCanView(missionId: string, user: Pick<AuthenticatedUser, 'id' | 'role'>) {
    const mission = await this.prisma.mission.findUnique({
      where: { id: missionId },
      select: { clientId: true, driverId: true },
    });
    if (!mission) throw new NotFoundException('Mission introuvable.');
    if (user.role !== UserRole.ADMIN && mission.clientId !== user.id && mission.driverId !== user.id) {
      throw new ForbiddenException('Ce convoyage ne vous concerne pas.');
    }
  }

  async trail(missionId: string, limit = 500) {
    return this.prisma.missionLocation.findMany({
      where: { missionId },
      orderBy: { recordedAt: 'asc' },
      take: limit,
    });
  }

  async latest(missionId: string) {
    return this.prisma.missionLocation.findFirst({
      where: { missionId },
      orderBy: { recordedAt: 'desc' },
    });
  }
}
