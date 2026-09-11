import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  create(ownerId: string, dto: CreateVehicleDto) {
    return this.prisma.vehicle.create({
      data: {
        ownerId,
        ...dto,
        insuranceExpiresAt: dto.insuranceExpiresAt ? new Date(dto.insuranceExpiresAt) : null,
      },
    });
  }

  async listByOwner(ownerId: string, skip: number, take: number) {
    const [data, total] = await Promise.all([
      this.prisma.vehicle.findMany({
        where: { ownerId, deletedAt: null },
        skip,
        take,
        include: { photos: { orderBy: { position: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.vehicle.count({ where: { ownerId, deletedAt: null } }),
    ]);
    return { data, total };
  }

  async findOne(id: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, deletedAt: null },
      include: { photos: { orderBy: { position: 'asc' } } },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }

  async update(id: string, userId: string, dto: UpdateVehicleDto) {
    await this.assertOwner(id, userId);
    return this.prisma.vehicle.update({
      where: { id },
      data: {
        ...dto,
        insuranceExpiresAt: dto.insuranceExpiresAt ? new Date(dto.insuranceExpiresAt) : undefined,
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.assertOwner(id, userId);
    return this.prisma.vehicle.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private async assertOwner(id: string, userId: string): Promise<void> {
    const v = await this.prisma.vehicle.findUnique({ where: { id }, select: { ownerId: true } });
    if (!v) throw new NotFoundException('Vehicle not found');
    if (v.ownerId !== userId) throw new ForbiddenException('Not vehicle owner');
  }
}
