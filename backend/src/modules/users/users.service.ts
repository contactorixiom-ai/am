import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpsertDriverProfileDto } from './dto/upsert-driver-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private get safeSelect(): Prisma.UserSelect {
    return {
      id: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      accountType: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      companyName: true,
      companyVatId: true,
      companySiret: true,
      companyAddress: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    };
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { ...this.safeSelect, driverProfile: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, dto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: this.safeSelect,
    });
  }

  async upsertDriverProfile(userId: string, dto: UpsertDriverProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role !== UserRole.DRIVER) {
      throw new ForbiddenException('Only DRIVER accounts can have a driver profile');
    }
    return this.prisma.driverProfile.upsert({
      where: { userId },
      create: {
        userId,
        licenseNumber: dto.licenseNumber,
        licenseExpiresAt: new Date(dto.licenseExpiresAt),
        licenseCategories: dto.licenseCategories,
        yearsOfExperience: dto.yearsOfExperience ?? 0,
        bio: dto.bio,
        serviceCountries: dto.serviceCountries ?? [],
        baseCity: dto.baseCity,
        baseLatitude: dto.baseLatitude,
        baseLongitude: dto.baseLongitude,
        isAvailable: dto.isAvailable ?? true,
      },
      update: {
        licenseNumber: dto.licenseNumber,
        licenseExpiresAt: new Date(dto.licenseExpiresAt),
        licenseCategories: dto.licenseCategories,
        yearsOfExperience: dto.yearsOfExperience,
        bio: dto.bio,
        serviceCountries: dto.serviceCountries,
        baseCity: dto.baseCity,
        baseLatitude: dto.baseLatitude,
        baseLongitude: dto.baseLongitude,
        isAvailable: dto.isAvailable,
      },
    });
  }

  // Annuaire clients pour l'espace admin (prise de commande téléphonique).
  async listClients(opts: { skip: number; take: number; q?: string }) {
    const term = opts.q?.trim();
    const where: Prisma.UserWhereInput = {
      role: UserRole.CLIENT,
      deletedAt: null,
      ...(term
        ? {
            OR: [
              { firstName: { contains: term, mode: 'insensitive' as const } },
              { lastName: { contains: term, mode: 'insensitive' as const } },
              { email: { contains: term, mode: 'insensitive' as const } },
              { phone: { contains: term, mode: 'insensitive' as const } },
              { companyName: { contains: term, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: opts.skip,
        take: opts.take,
        select: this.safeSelect,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { data, total };
  }

  async listDrivers(opts: { skip: number; take: number; city?: string }) {
    const where: Prisma.UserWhereInput = {
      role: UserRole.DRIVER,
      status: 'ACTIVE',
      driverProfile: opts.city
        ? { is: { baseCity: { equals: opts.city, mode: 'insensitive' } } }
        : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: opts.skip,
        take: opts.take,
        select: { ...this.safeSelect, driverProfile: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { data, total };
  }
}
