import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { AccountType, Prisma, UserRole, UserStatus } from '@prisma/client';
import { normalizeSiret, normalizeVat } from '../../common/validation/company-ids';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpsertDriverProfileDto } from './dto/upsert-driver-profile.dto';

export type DirectorySegment = 'all' | 'individual' | 'pro' | 'driver' | 'staff';
export interface DirectoryAddress {
  line: string;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  /** D'où vient l'adresse : facturation, société ou dernière commande. */
  source: string;
}
export const DIRECTORY_SEGMENTS: DirectorySegment[] = ['all', 'individual', 'pro', 'driver', 'staff'];

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

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

    // Fichiers des pièces d'identité, à effacer du disque une fois le
    // compte neutralisé (la base n'en garde que le lien).
    const kycFiles = await this.prisma.kycDocument.findMany({
      where: { userId },
      select: { fileUrl: true },
    });

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

    await Promise.all(kycFiles.map((f) => this.storage.removeByUrl(f.fileUrl)));

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

  // ─── Équipe Axis : responsables d'exploitation ─────────────────────────
  // Chacun son compte : l'administrateur (Roger) les crée, leur envoie un
  // lien d'accès et peut leur retirer l'accès. Ils pilotent l'activité sans
  // gérer l'équipe, les remboursements ni le chiffre d'affaires.

  listStaff() {
    return this.prisma.user.findMany({
      where: { role: { in: [UserRole.ADMIN, UserRole.MANAGER] }, deletedAt: null },
      select: { id: true, email: true, phone: true, firstName: true, lastName: true, role: true, status: true, lastLoginAt: true, createdAt: true },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createManager(adminId: string, dto: { firstName: string; lastName: string; email: string; phone?: string }) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing && !existing.deletedAt) {
      throw new ConflictException('Un compte existe déjà avec cet e-mail : utilise une autre adresse pour le compte d\'équipe.');
    }
    await this.assertPhoneFree(dto.phone);
    // Mot de passe aléatoire : le responsable choisit le sien via le lien
    // d'accès envoyé par l'administrateur.
    const passwordHash = await argon2.hash(randomBytes(24).toString('hex'), { type: argon2.argon2id });
    const user = await this.prisma.user.create({
      data: {
        email,
        phone: dto.phone?.trim() || null,
        passwordHash,
        role: UserRole.MANAGER,
        status: UserStatus.PENDING,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
      },
      select: { id: true, email: true, phone: true, firstName: true, lastName: true, role: true, status: true, createdAt: true },
    });
    await this.prisma.auditLog.create({ data: { userId: adminId, action: 'STAFF_CREATE', entity: 'User', entityId: user.id } });
    return user;
  }

  /** Le téléphone est unique : message clair plutôt qu'une erreur serveur. */
  private async assertPhoneFree(phone?: string) {
    const p = phone?.trim();
    if (!p) return;
    const taken = await this.prisma.user.findUnique({ where: { phone: p }, select: { id: true } });
    if (taken) throw new ConflictException('Ce numéro de téléphone est déjà utilisé par un autre compte.');
  }

  /**
   * Invitation d'un convoyeur par l'équipe Axis : compte convoyeur sans mot
   * de passe connu. Il choisit le sien via le lien d'accès, puis envoie son
   * permis et sa pièce d'identité, que Roger valide comme pour une
   * inscription spontanée.
   */
  async inviteDriver(staffId: string, dto: { firstName: string; lastName: string; email: string; phone?: string }) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email }, select: { role: true, deletedAt: true } });
    if (existing && !existing.deletedAt) {
      throw new ConflictException(
        existing.role === UserRole.DRIVER
          ? 'Ce convoyeur a déjà un compte : envoie-lui plutôt un lien d\'accès depuis sa fiche.'
          : 'Un compte existe déjà avec cet e-mail.',
      );
    }
    await this.assertPhoneFree(dto.phone);
    const passwordHash = await argon2.hash(randomBytes(24).toString('hex'), { type: argon2.argon2id });
    const user = await this.prisma.user.create({
      data: {
        email,
        phone: dto.phone?.trim() || null,
        passwordHash,
        role: UserRole.DRIVER,
        status: UserStatus.PENDING,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
      },
      select: { id: true, email: true, phone: true, firstName: true, lastName: true, role: true, status: true, createdAt: true, lastLoginAt: true },
    });
    await this.prisma.auditLog.create({ data: { userId: staffId, action: 'DRIVER_INVITE', entity: 'User', entityId: user.id } });
    return user;
  }

  /** Convoyeurs invités qui ne se sont pas encore connectés. */
  listInvitedDrivers() {
    return this.prisma.user.findMany({
      where: { role: UserRole.DRIVER, deletedAt: null, lastLoginAt: null },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, email: true, phone: true, firstName: true, lastName: true, role: true, status: true, createdAt: true, lastLoginAt: true },
    });
  }

  /** Retire l'accès d'un responsable : compte suspendu, sessions coupées. */
  async revokeManager(adminId: string, id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!user || user.role !== UserRole.MANAGER) throw new NotFoundException('Responsable introuvable.');
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { status: UserStatus.SUSPENDED } }),
      this.prisma.refreshToken.deleteMany({ where: { userId: id } }),
      this.prisma.auditLog.create({ data: { userId: adminId, action: 'STAFF_REVOKE', entity: 'User', entityId: id } }),
    ]);
    return { id, status: UserStatus.SUSPENDED };
  }

  /** Rend l'accès à un responsable suspendu (il garde son mot de passe). */
  async restoreManager(adminId: string, id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!user || user.role !== UserRole.MANAGER) throw new NotFoundException('Responsable introuvable.');
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { status: UserStatus.ACTIVE } }),
      this.prisma.auditLog.create({ data: { userId: adminId, action: 'STAFF_RESTORE', entity: 'User', entityId: id } }),
    ]);
    return { id, status: UserStatus.ACTIVE };
  }
  // ─── Annuaire des inscrits (espace admin de Roger) ─────────────────────────

  private directoryWhere(segment: DirectorySegment, q?: string): Prisma.UserWhereInput {
    const term = q?.trim();
    const bySegment: Record<DirectorySegment, Prisma.UserWhereInput> = {
      all: {},
      individual: { role: UserRole.CLIENT, accountType: AccountType.INDIVIDUAL },
      pro: { role: UserRole.CLIENT, accountType: AccountType.PROFESSIONAL },
      driver: { role: UserRole.DRIVER },
      staff: { role: { in: [UserRole.ADMIN, UserRole.MANAGER] } },
    };
    return {
      deletedAt: null,
      ...bySegment[segment],
      ...(term
        ? {
            OR: [
              { firstName: { contains: term, mode: 'insensitive' as const } },
              { lastName: { contains: term, mode: 'insensitive' as const } },
              { email: { contains: term, mode: 'insensitive' as const } },
              { phone: { contains: term, mode: 'insensitive' as const } },
              { companyName: { contains: term, mode: 'insensitive' as const } },
              { companySiret: { contains: term.replace(/\s/g, '') } },
            ],
          }
        : {}),
    };
  }

  /** Tous les comptes, avec leur activité (commandes, colis, missions, pièces). */
  async directory(opts: { skip: number; take: number; segment?: DirectorySegment; q?: string }) {
    const where = this.directoryWhere(opts.segment ?? 'all', opts.q);
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: opts.skip,
        take: opts.take,
        orderBy: { createdAt: 'desc' },
        select: {
          ...this.safeSelect,
          termsAcceptedAt: true,
          driverProfile: { select: { baseCity: true, completedMissions: true, isAvailable: true } },
          kycDocuments: { select: { status: true } },
          _count: { select: { clientMissions: true, driverMissions: true, parcelsSent: true, ownedVehicles: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    const ids = rows.map((r) => r.id);
    const paid = ids.length
      ? await this.prisma.payment.groupBy({
          by: ['clientId'],
          where: { clientId: { in: ids }, status: 'PAID' },
          _sum: { amountCents: true },
        })
      : [];
    const paidBy = new Map(paid.map((p) => [p.clientId, p._sum.amountCents ?? 0]));
    const addressBy = await this.lastKnownAddresses(rows);
    const data = rows.map(({ kycDocuments, _count, ...u }) => ({
      ...u,
      address: addressBy.get(u.id) ?? null,
      missionsCount: _count.clientMissions,
      driverMissionsCount: _count.driverMissions,
      parcelsCount: _count.parcelsSent,
      vehiclesCount: _count.ownedVehicles,
      kyc: {
        approved: kycDocuments.filter((k) => k.status === 'APPROVED').length,
        pending: kycDocuments.filter((k) => k.status === 'PENDING').length,
        rejected: kycDocuments.filter((k) => k.status === 'REJECTED').length,
      },
      paidCents: paidBy.get(u.id) ?? 0,
    }));
    return { data, total };
  }

  /**
   * Adresse la plus fiable de chaque inscrit : facturation, sinon société,
   * sinon la plus récente de ses commandes (enlèvement à domicile, dépôt,
   * prise en charge du véhicule).
   */
  private async lastKnownAddresses(users: { id: string; billingAddress: string | null; companyAddress: string | null }[]) {
    const out = new Map<string, DirectoryAddress>();
    const missing: string[] = [];
    for (const u of users) {
      const line = u.billingAddress?.trim() || u.companyAddress?.trim();
      if (line) out.set(u.id, { line, postalCode: null, city: null, country: null, source: u.billingAddress ? 'Facturation' : 'Société' });
      else missing.push(u.id);
    }
    if (!missing.length) return out;
    const [parcels, missions] = await Promise.all([
      this.prisma.parcel.findMany({
        where: { senderId: { in: missing } },
        orderBy: { createdAt: 'desc' },
        select: { senderId: true, pickupAddress: true, originAddress: true, originCity: true, originCountry: true, createdAt: true },
      }),
      this.prisma.mission.findMany({
        where: { clientId: { in: missing } },
        orderBy: { createdAt: 'desc' },
        select: { clientId: true, pickupAddress: true, pickupPostalCode: true, pickupCity: true, pickupCountry: true, createdAt: true },
      }),
    ]);
    const candidates = new Map<string, (DirectoryAddress & { at: Date })[]>();
    const push = (id: string, a: DirectoryAddress & { at: Date }) => candidates.set(id, [...(candidates.get(id) ?? []), a]);
    for (const p of parcels) {
      // En import, l'adresse d'origine est l'expéditeur au pays, pas le client.
      const line = p.pickupAddress?.trim() || (p.originAddress && !p.originAddress.startsWith('Expéditeur') ? p.originAddress.trim() : '');
      if (line) push(p.senderId, { line, postalCode: null, city: p.originCity, country: p.originCountry, source: 'Commande colis', at: p.createdAt });
    }
    for (const m of missions) {
      if (m.pickupAddress?.trim()) {
        push(m.clientId, { line: m.pickupAddress.trim(), postalCode: m.pickupPostalCode, city: m.pickupCity, country: m.pickupCountry, source: 'Commande convoyage', at: m.createdAt });
      }
    }
    for (const [id, list] of candidates) {
      const { at: _at, ...latest } = list.sort((x, y) => y.at.getTime() - x.at.getTime())[0];
      out.set(id, latest);
    }
    return out;
  }

  /** Chiffres de l'annuaire : combien d'inscrits, par type, et la dynamique. */
  async directoryStats() {
    const now = Date.now();
    const since7 = new Date(now - 7 * 86400_000);
    const since30 = new Date(now - 30 * 86400_000);
    const month = new Date();
    month.setDate(1);
    month.setHours(0, 0, 0, 0);
    const alive = { deletedAt: null };
    const [total, individual, pro, driver, staff, new7, newMonth, active30, deleted] = await Promise.all([
      this.prisma.user.count({ where: alive }),
      this.prisma.user.count({ where: this.directoryWhere('individual') }),
      this.prisma.user.count({ where: this.directoryWhere('pro') }),
      this.prisma.user.count({ where: this.directoryWhere('driver') }),
      this.prisma.user.count({ where: this.directoryWhere('staff') }),
      this.prisma.user.count({ where: { ...alive, createdAt: { gte: since7 } } }),
      this.prisma.user.count({ where: { ...alive, createdAt: { gte: month } } }),
      this.prisma.user.count({ where: { ...alive, lastLoginAt: { gte: since30 } } }),
      this.prisma.user.count({ where: { deletedAt: { not: null } } }),
    ]);
    return { total, individual, pro, driver, staff, new7, newMonth, active30, deleted };
  }

  /** Fiche complète d'un inscrit : profil et derniers dossiers. */
  async directoryEntry(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        ...this.safeSelect,
        termsAcceptedAt: true,
        termsVersion: true,
        driverProfile: true,
        kycDocuments: { select: { id: true, type: true, status: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
        ownedVehicles: { select: { id: true, make: true, model: true, licensePlate: true }, take: 10 },
      },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    const [missions, driverMissions, parcels, payments] = await Promise.all([
      this.prisma.mission.findMany({
        where: { clientId: id },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: { id: true, reference: true, status: true, pickupCity: true, deliveryCity: true, createdAt: true, priceCents: true },
      }),
      this.prisma.mission.findMany({
        where: { driverId: id },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: { id: true, reference: true, status: true, pickupCity: true, deliveryCity: true, createdAt: true },
      }),
      this.prisma.parcel.findMany({
        where: { senderId: id },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: { id: true, reference: true, status: true, originCity: true, destinationCity: true, createdAt: true, priceCents: true },
      }),
      this.prisma.payment.findMany({
        where: { clientId: id },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: { id: true, reference: true, status: true, amountCents: true, paidAt: true, createdAt: true, invoiceNumber: true },
      }),
    ]);
    const address = (await this.lastKnownAddresses([user])).get(user.id) ?? null;
    return { ...user, address, missions, driverMissions, parcels, payments };
  }
}
