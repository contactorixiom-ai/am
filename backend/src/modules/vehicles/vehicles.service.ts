import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateVehicleDto) {
    const data = {
      ...dto,
      insuranceExpiresAt: dto.insuranceExpiresAt ? new Date(dto.insuranceExpiresAt) : null,
    };
    // Une immatriculation n'existe qu'une fois. Un client qui fait convoyer
    // deux fois la même voiture (ou qui recommande après un paiement
    // abandonné) était bloqué : « véhicule déjà enregistré ». On reprend sa
    // fiche, mise à jour avec ce qu'il vient de saisir.
    const existing = await this.prisma.vehicle.findFirst({
      where: { licensePlate: dto.licensePlate, registrationCountry: dto.registrationCountry ?? null },
      select: { id: true, ownerId: true },
    });
    if (existing) {
      if (existing.ownerId !== ownerId) {
        throw new ConflictException(
          'Ce véhicule est déjà enregistré par un autre client. Contactez Axis Import, qui le rattachera à votre compte.',
        );
      }
      return this.prisma.vehicle.update({ where: { id: existing.id }, data: { ...data, deletedAt: null } });
    }
    return this.prisma.vehicle.create({ data: { ownerId, ...data } });
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

  /** Propriétaire, convoyeur d'une de ses missions, ou Axis. */
  async findOne(id: string, user: { id: string; role: string }) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, deletedAt: null },
      include: { photos: { orderBy: { position: 'asc' } } },
    });
    if (!vehicle) throw new NotFoundException('Véhicule introuvable.');
    if (vehicle.ownerId !== user.id && user.role !== 'ADMIN') {
      const driving = await this.prisma.mission.count({ where: { vehicleId: id, driverId: user.id } });
      if (driving === 0) throw new ForbiddenException('Ce véhicule ne vous concerne pas.');
    }
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
    if (!v) throw new NotFoundException('Véhicule introuvable.');
    if (v.ownerId !== userId) throw new ForbiddenException('Ce véhicule ne vous appartient pas.');
  }
}
