import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountType, Prisma, UserRole, UserStatus } from '@prisma/client';
import { normalizeSiret, normalizeVat } from '../../common/validation/company-ids';
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
      billingAddress: true,
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
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    return user;
  }

  /**
   * Export de ses données (RGPD, droits d'accès et à la portabilité).
   * L'application affichait « archive envoyée sous 48 h » sans rien faire.
   * Les empreintes de mot de passe, jetons et journaux techniques sont exclus.
   */
  async exportData(userId: string) {
    const [profile, vehicles, missionsAsClient, missionsAsDriver, parcels, payments, documents, kyc, quotes, messages, notifications] =
      await Promise.all([
        this.prisma.user.findUnique({ where: { id: userId }, select: { ...this.safeSelect, driverProfile: true } }),
        this.prisma.vehicle.findMany({ where: { ownerId: userId } }),
        this.prisma.mission.findMany({ where: { clientId: userId }, include: { statusHistory: true } }),
        this.prisma.mission.findMany({ where: { driverId: userId } }),
        this.prisma.parcel.findMany({ where: { senderId: userId } }),
        this.prisma.payment.findMany({ where: { clientId: userId } }),
        this.prisma.document.findMany({ where: { ownerId: userId } }),
        this.prisma.kycDocument.findMany({
          where: { userId },
          select: { id: true, type: true, status: true, fileName: true, createdAt: true, reviewedAt: true, notes: true },
        }),
        this.prisma.quote.findMany({ where: { customerId: userId } }),
        this.prisma.message.findMany({
          where: { senderId: userId },
          select: { id: true, conversationId: true, type: true, body: true, createdAt: true },
        }),
        this.prisma.notification.findMany({ where: { userId } }),
      ]);
    if (!profile) throw new NotFoundException('Utilisateur introuvable.');
    return {
      exportedAt: new Date().toISOString(),
      notice:
        'Données personnelles détenues par Axis Import vous concernant. Les fichiers (photos, pièces) sont référencés par leur adresse ; ils restent accessibles depuis l\'application.',
      profile,
      vehicles,
      missionsAsClient,
      missionsAsDriver,
      parcels,
      payments,
      documents,
      identityDocuments: kyc,
      quotes,
      messagesSent: messages,
      notifications,
    };
  }

  async updateProfile(userId: string, dto: UpdateUserDto) {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { accountType: true, companyName: true, companySiret: true },
    });
    if (!current) throw new NotFoundException('Utilisateur introuvable.');
    const trim = (v?: string) => (v === undefined ? undefined : v.trim() || null);
    const data = {
      firstName: dto.firstName?.trim() || undefined,
      lastName: dto.lastName?.trim() || undefined,
      phone: dto.phone === undefined ? undefined : dto.phone.trim() || null,
      avatarUrl: dto.avatarUrl,
      accountType: dto.accountType,
      companyName: trim(dto.companyName),
      companyAddress: trim(dto.companyAddress),
      billingAddress: trim(dto.billingAddress),
      companySiret: dto.companySiret === undefined ? undefined : dto.companySiret.trim() ? normalizeSiret(dto.companySiret) : null,
      companyVatId: dto.companyVatId === undefined ? undefined : dto.companyVatId.trim() ? normalizeVat(dto.companyVatId) : null,
    };
    // Un compte pro sans raison sociale ni SIRET donnerait des factures
    // incomplètes.
    const type = data.accountType ?? current.accountType;
    if (type === AccountType.PROFESSIONAL) {
      const name = data.companyName === undefined ? current.companyName : data.companyName;
      const siret = data.companySiret === undefined ? current.companySiret : data.companySiret;
      if (!name || !siret) {
        throw new BadRequestException('Compte professionnel : raison sociale et SIRET obligatoires.');
      }
    }
    return this.prisma.user.update({ where: { id: userId }, data, select: this.safeSelect });
  }

  /**
   * Suppression du compte à la demande de son titulaire.
   *
   * Exigée par l'App Store : une application qui permet de créer un compte
   * doit permettre de le supprimer depuis l'application elle-même, un lien
   * de contact ne suffit pas (règle 5.1.1(v)).
   *
   * Suppression logique : les identifiants directs sont effacés et l'accès
   * est révoqué, mais les pièces à valeur probante ou comptable sont
   * conservées — factures (dix ans, art. L102 B du LPF), contrats signés et
   * procès-verbaux d'état des lieux. Le RGPD réserve expressément ce cas
   * (art. 17.3 b et e : obligation légale et constatation d'un droit).
   */
  async deleteAccount(userId: string): Promise<{ deletedAt: Date }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, deletedAt: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (user.deletedAt) return { deletedAt: user.deletedAt };

    const deletedAt = new Date();
    // L'adresse et le téléphone sont uniques : on les neutralise au lieu de
    // les vider, pour que la personne puisse se réinscrire ensuite.
    const tombstone = `supprime+${userId}@axis-import.invalid`;

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          deletedAt,
          status: UserStatus.DELETED,
          email: tombstone,
          phone: null,
          firstName: 'Compte',
          lastName: 'supprimé',
          avatarUrl: null,
          companyName: null,
          companyVatId: null,
          companySiret: null,
          companyAddress: null,
        },
      }),
      // Révocation de toutes les sessions ouvertes.
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
      this.prisma.pushToken.deleteMany({ where: { userId } }),
      // Les pièces d'identité n'ont plus lieu d'être conservées.
      this.prisma.kycDocument.deleteMany({ where: { userId } }),
    ]);

    await this.prisma.auditLog
      .create({
        data: { userId, action: 'ACCOUNT_DELETE', entity: 'User', entityId: userId },
      })
      .catch(() => { /* la suppression reste effective */ });

    return { deletedAt };
  }

  async upsertDriverProfile(userId: string, dto: UpsertDriverProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    if (user.role !== UserRole.DRIVER) {
      throw new ForbiddenException('Seuls les comptes convoyeur ont un profil convoyeur.');
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
    // Tous les convoyeurs non suspendus : un convoyeur inscrit depuis
    // l'application reste « PENDING » et n'apparaissait jamais ici.
    const where: Prisma.UserWhereInput = {
      role: UserRole.DRIVER,
      deletedAt: null,
      status: { notIn: [UserStatus.SUSPENDED, UserStatus.DELETED] },
      driverProfile: opts.city
        ? { is: { baseCity: { equals: opts.city, mode: 'insensitive' } } }
        : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: opts.skip,
        take: opts.take,
        select: {
          ...this.safeSelect,
          driverProfile: true,
          kycDocuments: { where: { status: 'APPROVED' }, select: { type: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);
    // « Vérifié » = pièce d'identité (ou passeport) ET permis validés.
    const withStatus = data.map(({ kycDocuments, ...u }) => {
      const types = new Set((kycDocuments as { type: string }[]).map((d) => d.type));
      const verified = (types.has('IDENTITY_CARD') || types.has('PASSPORT')) && types.has('DRIVER_LICENSE');
      return { ...u, verified };
    });
    return { data: withStatus, total };
  }
}
