import { Injectable } from '@nestjs/common';
import { Prisma, RelayCarrier } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { haversineKm } from '../../common/haversine';

export interface SearchParams {
  city?: string;
  country?: string;
  carrier?: RelayCarrier;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  limit?: number;
}

@Injectable()
export class RelayPointsService {
  constructor(private readonly prisma: PrismaService) {}

  async search(params: SearchParams) {
    const where: Prisma.RelayPointWhereInput = { isActive: true };
    if (params.country) where.country = params.country.toUpperCase();
    if (params.city) where.city = { equals: params.city, mode: 'insensitive' };
    if (params.carrier) where.carrier = params.carrier;

    let points = await this.prisma.relayPoint.findMany({
      where,
      take: 200,
      orderBy: { name: 'asc' },
    });

    // Si lat/lng fournis, trie par distance et limite au rayon
    if (params.latitude != null && params.longitude != null) {
      const radius = params.radiusKm ?? 30;
      points = points
        .map((p) => ({
          ...p,
          distanceKm: haversineKm({ latitude: params.latitude!, longitude: params.longitude! }, p),
        }))
        .filter((p) => p.distanceKm <= radius)
        .sort((a, b) => a.distanceKm - b.distanceKm);
    }

    return points.slice(0, params.limit ?? 50);
  }

  async findOne(id: string) {
    return this.prisma.relayPoint.findUnique({ where: { id } });
  }
}
