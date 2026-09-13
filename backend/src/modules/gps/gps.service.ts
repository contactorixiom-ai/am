import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MissionStatus } from '@prisma/client';
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
    if (!mission) throw new NotFoundException('Mission not found');
    if (mission.driverId !== driverId) throw new ForbiddenException('Not assigned driver');
    if (mission.status !== MissionStatus.IN_PROGRESS) {
      throw new ForbiddenException('Mission not in progress');
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
