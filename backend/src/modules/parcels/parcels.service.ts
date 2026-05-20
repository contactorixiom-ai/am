import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ParcelStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateParcelDto } from './dto/create-parcel.dto';
import { AddParcelEventDto } from './dto/parcel-event.dto';

@Injectable()
export class ParcelsService {
  constructor(private readonly prisma: PrismaService) {}

  create(senderId: string, dto: CreateParcelDto) {
    return this.prisma.parcel.create({
      data: {
        senderId,
        reference: this.generateReference(),
        category: dto.category,
        weightKg: dto.weightKg,
        declaredValueCents: dto.declaredValueCents,
        description: dto.description,
        recipientFirstName: dto.recipientFirstName,
        recipientLastName: dto.recipientLastName,
        recipientPhone: dto.recipientPhone,
        recipientEmail: dto.recipientEmail,
        originCountry: dto.originCountry.toUpperCase(),
        originCity: dto.originCity,
        originAddress: dto.originAddress,
        destinationCountry: dto.destinationCountry.toUpperCase(),
        destinationCity: dto.destinationCity,
        destinationAddress: dto.destinationAddress,
        items: dto.items
          ? {
              create: dto.items.map((i) => ({
                description: i.description,
                quantity: i.quantity ?? 1,
                weightKg: i.weightKg,
                valueCents: i.valueCents,
                hsCode: i.hsCode,
              })),
            }
          : undefined,
      },
      include: { items: true },
    });
  }

  async list(user: AuthenticatedUser, opts: { skip: number; take: number; status?: ParcelStatus }) {
    const where: Prisma.ParcelWhereInput =
      user.role === UserRole.ADMIN ? {} : { senderId: user.id };
    if (opts.status) where.status = opts.status;

    const [data, total] = await Promise.all([
      this.prisma.parcel.findMany({
        where,
        skip: opts.skip,
        take: opts.take,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.parcel.count({ where }),
    ]);
    return { data, total };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const parcel = await this.prisma.parcel.findUnique({
      where: { id },
      include: { items: true, trackingEvents: { orderBy: { occurredAt: 'asc' } } },
    });
    if (!parcel) throw new NotFoundException('Parcel not found');
    if (user.role !== UserRole.ADMIN && parcel.senderId !== user.id) {
      throw new ForbiddenException();
    }
    return parcel;
  }

  async track(reference: string) {
    const parcel = await this.prisma.parcel.findUnique({
      where: { reference },
      select: {
        reference: true,
        status: true,
        originCountry: true,
        destinationCountry: true,
        destinationCity: true,
        estimatedDelivery: true,
        deliveredAt: true,
        trackingEvents: { orderBy: { occurredAt: 'asc' } },
      },
    });
    if (!parcel) throw new NotFoundException('Parcel not found');
    return parcel;
  }

  async addEvent(id: string, dto: AddParcelEventDto, user: AuthenticatedUser) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException('Admin only');
    const parcel = await this.prisma.parcel.findUnique({ where: { id } });
    if (!parcel) throw new NotFoundException('Parcel not found');

    await this.prisma.parcelTrackingEvent.create({
      data: {
        parcelId: id,
        status: dto.status,
        location: dto.location,
        notes: dto.notes,
      },
    });
    return this.prisma.parcel.update({
      where: { id },
      data: {
        status: dto.status,
        deliveredAt: dto.status === ParcelStatus.DELIVERED ? new Date() : undefined,
      },
    });
  }

  private generateReference(): string {
    const stamp = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `AXP-${stamp}-${rand}`;
  }
}
