import { accountNoFilter } from '../../common/accounts/account-number';
import { personnelCompliance } from '../../common/auth/driver-kyc';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StaffFileKind, StaffFileStatus, StaffRequestStatus, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../storage/storage.service';
import {
  ANNOUNCE_ROLES,
  EXPENSE_ROLES,
  handlesPaperwork,
  hasRole,
  HR_ROLES,
  PERSONNEL_ROLES,
  TEAM_ROLES,
  TRAVEL_ROLES,
} from '../../common/auth/staff';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import {
  AnnouncementDto,
  MyStaffFileDto,
  PersonStaffFileDto,
  ReviewStaffFileDto,
  StaffRequestDto,
} from './staff-space.dto';

const STAFF_FILE_URL = /\/storage\/file\/staff\/[0-9a-f-]{36}(\.[a-z0-9]{1,8})?$/i;

const CATEGORY_LABELS: Record<string, string> = {
  TRAIN: 'Billet de train',
  BUS: 'Billet de bus',
  FLIGHT: 'Billet d\'avion',
  FERRY: 'Billet de bateau',
  HOTEL: 'Réservation d\'hébergement',
  FUEL: 'Carburant',
  TOLL: 'Péage',
  PARKING: 'Stationnement',
  MEAL: 'Repas',
  TRANSPORT: 'Transport (taxi, métro…)',
  RECEIPT: 'Ticket de caisse',
  CONTRACT: 'Contrat',
  INSURANCE: 'Assurance',
  PAYSLIP: 'Fiche de paie',
  CERTIFICATE: 'Attestation',
  OTHER: 'Document',
};

function label(category: string) {
  return CATEGORY_LABELS[category] ?? 'Document';
}

/** Quelles pièces chaque rôle de l'équipe voit dans le dossier d'une personne. */
function visibleKinds(role: UserRole): StaffFileKind[] {
  const kinds = new Set<StaffFileKind>();
  if (hasRole(TRAVEL_ROLES, role)) kinds.add(StaffFileKind.TRAVEL);
  if (hasRole(EXPENSE_ROLES, role)) kinds.add(StaffFileKind.EXPENSE);
  if (hasRole(HR_ROLES, role)) {
    kinds.add(StaffFileKind.HR_DOCUMENT);
    kinds.add(StaffFileKind.EMPLOYEE_DOCUMENT);
  }
  return [...kinds];
}

const PERSON_SELECT = {
  id: true,
  accountNo: true,
  avatarUrl: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

/**
 * Espace des convoyeurs et salariés : billets et réservations déposés par
 * Axis, justificatifs de frais pour la comptabilité, documents échangés avec
 * la RH (contrats, assurances, pièces demandées), annonces du secrétariat.
 */
@Injectable()
export class StaffSpaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
  ) {}

  // ─── Utilitaires ───────────────────────────────────────────────────────────

  private async nameOf(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } });
    return u ? `${u.firstName} ${u.lastName}`.trim() : 'Axis Import';
  }

  /** Le fichier vient de notre stockage (dossier staff) et n'a pas déjà servi. */
  private async assertFreshFile(fileUrl: string) {
    if (!STAFF_FILE_URL.test(fileUrl)) {
      throw new BadRequestException('Fichier invalide : envoyez-le depuis l\'application.');
    }
    const suffix = fileUrl.slice(fileUrl.indexOf('/storage/file/staff/'));
    const taken = await this.prisma.staffFile.findFirst({ where: { fileUrl: { endsWith: suffix } }, select: { id: true } });
    if (taken) throw new BadRequestException('Fichier déjà utilisé.');
  }

  private async personnel(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: PERSON_SELECT });
    if (!user || !PERSONNEL_ROLES.includes(user.role) || user.status === UserStatus.DELETED) {
      throw new NotFoundException('Convoyeur ou salarié introuvable.');
    }
    return user;
  }

  private async mission(missionId: string | undefined, user: AuthenticatedUser, ownerId: string) {
    if (!missionId) return { missionId: null, missionRef: null };
    const m = await this.prisma.mission.findUnique({ where: { id: missionId }, select: { id: true, reference: true, driverId: true } });
    if (!m) throw new NotFoundException('Mission introuvable.');
    // Un convoyeur ne rattache une pièce qu'à ses propres missions.
    if (user.role === UserRole.DRIVER && m.driverId !== ownerId) {
      throw new ForbiddenException('Cette mission ne vous est pas confiée.');
    }
    return { missionId: m.id, missionRef: m.reference };
  }

  private async usersWithRoles(roles: UserRole[], except?: string) {
    const rows = await this.prisma.user.findMany({
      where: {
        role: { in: roles },
        deletedAt: null,
        status: { notIn: [UserStatus.SUSPENDED, UserStatus.DELETED] },
        ...(except ? { id: { not: except } } : {}),
      },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  private async notifyAll(ids: string[], title: string, body: string, payload: Prisma.JsonObject) {
    await Promise.all(
      ids.map((id) => this.notifications.notify(id, 'SYSTEM', title, body, payload).catch(() => undefined)),
    );
  }

  // ─── Côté convoyeur / salarié ──────────────────────────────────────────────

  async mySpace(userId: string) {
    const [files, requests, announcements, missions] = await Promise.all([
      this.prisma.staffFile.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 300 }),
      this.prisma.staffRequest.findMany({
        where: { userId, status: { not: StaffRequestStatus.CANCELLED } },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take: 100,
      }),
      this.prisma.announcement.findMany({
        where: { recipientIds: { has: userId } },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: { id: true, title: true, body: true, authorName: true, attachmentUrl: true, attachmentName: true, attachmentMime: true, createdAt: true },
      }),
      this.prisma.mission.findMany({
        where: { driverId: userId },
        orderBy: { pickupAt: 'desc' },
        take: 30,
        select: { id: true, reference: true, pickupCity: true, deliveryCity: true, pickupAt: true },
      }),
    ]);
    return { files, requests, announcements, missions };
  }

  async submitMine(user: AuthenticatedUser, dto: MyStaffFileDto) {
    if (!PERSONNEL_ROLES.includes(user.role)) {
      throw new ForbiddenException('Espace réservé aux convoyeurs et salariés d\'Axis.');
    }
    await this.assertFreshFile(dto.fileUrl);
    if (dto.kind === 'EXPENSE' && !dto.amountCents) {
      throw new BadRequestException('Indiquez le montant du justificatif.');
    }
    let request: { id: string; requestedById: string; title: string } | null = null;
    if (dto.requestId) {
      request = await this.prisma.staffRequest.findFirst({
        where: { id: dto.requestId, userId: user.id, status: StaffRequestStatus.OPEN },
        select: { id: true, requestedById: true, title: true },
      });
      if (!request) throw new NotFoundException('Demande introuvable ou déjà traitée.');
    }
    const link = await this.mission(dto.missionId, user, user.id);
    const name = await this.nameOf(user.id);
    const kind = dto.kind === 'EXPENSE' ? StaffFileKind.EXPENSE : StaffFileKind.EMPLOYEE_DOCUMENT;

    const file = await this.prisma.staffFile.create({
      data: {
        userId: user.id,
        kind,
        category: dto.category,
        title: dto.title?.trim() || (request ? request.title : label(dto.category)),
        note: dto.note?.trim() || null,
        amountCents: kind === StaffFileKind.EXPENSE ? dto.amountCents : null,
        spentAt: dto.spentAt ? new Date(dto.spentAt) : null,
        ...link,
        requestId: request?.id ?? null,
        fileUrl: dto.fileUrl,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        fileSize: dto.fileSize,
        uploadedById: user.id,
        uploadedByName: name,
      },
    });

    if (request) {
      await this.prisma.staffRequest.update({
        where: { id: request.id },
        data: { status: StaffRequestStatus.DONE, doneAt: new Date() },
      });
    }

    // La comptabilité reçoit les frais ; la RH, les documents administratifs.
    if (kind === StaffFileKind.EXPENSE) {
      const ids = await this.usersWithRoles(EXPENSE_ROLES, user.id);
      const amount = ((dto.amountCents ?? 0) / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
      await this.notifyAll(ids, 'Nouveau justificatif de frais', `${name} : ${label(dto.category).toLowerCase()}, ${amount}${link.missionRef ? ` (${link.missionRef})` : ''}.`, {
        kind: 'STAFF_EXPENSE', staffFileId: file.id,
      });
    } else {
      const ids = new Set(await this.usersWithRoles(HR_ROLES, user.id));
      if (request) ids.add(request.requestedById);
      ids.delete(user.id);
      await this.notifyAll([...ids], request ? 'Pièce reçue' : 'Nouveau document reçu', `${name} a envoyé : ${file.title}.`, {
        kind: 'STAFF_DOCUMENT', staffFileId: file.id, userId: user.id,
      });
    }
    return file;
  }

  async markSeen(userId: string, id: string) {
    const file = await this.prisma.staffFile.findFirst({ where: { id, userId }, select: { id: true, seenAt: true } });
    if (!file) throw new NotFoundException('Pièce introuvable.');
    if (file.seenAt) return file;
    return this.prisma.staffFile.update({ where: { id }, data: { seenAt: new Date() }, select: { id: true, seenAt: true } });
  }

  /** Le salarié retire une pièce envoyée par erreur, tant qu'elle n'est pas traitée. */
  async removeMine(userId: string, id: string) {
    const file = await this.prisma.staffFile.findFirst({ where: { id, userId, uploadedById: userId } });
    if (!file) throw new NotFoundException('Pièce introuvable.');
    if (file.status !== StaffFileStatus.PENDING) {
      throw new BadRequestException('Pièce déjà traitée : demandez à Axis de la retirer.');
    }
    await this.prisma.staffFile.delete({ where: { id } });
    if (file.requestId) {
      await this.prisma.staffRequest.updateMany({
        where: { id: file.requestId, status: StaffRequestStatus.DONE },
        data: { status: StaffRequestStatus.OPEN, doneAt: null },
      });
    }
    await this.storage.removeByUrl(file.fileUrl);
    return { id };
  }

  // ─── Côté équipe Axis ──────────────────────────────────────────────────────

  /** Convoyeurs et salariés, avec ce qui attend une action. */
  async people(viewer: AuthenticatedUser, q?: string) {
    const term = q?.trim();
    const users = await this.prisma.user.findMany({
      where: {
        role: { in: PERSONNEL_ROLES },
        deletedAt: null,
        status: { not: UserStatus.DELETED },
        ...(term
          ? {
              OR: [
                { firstName: { contains: term, mode: 'insensitive' as const } },
                { lastName: { contains: term, mode: 'insensitive' as const } },
                { email: { contains: term, mode: 'insensitive' as const } },
                { phone: { contains: term } },
                ...accountNoFilter(term),
              ],
            }
          : {}),
      },
      orderBy: [{ role: 'asc' }, { lastName: 'asc' }],
      take: 500,
      select: {
        ...PERSON_SELECT,
        kycDocuments: { select: { type: true, status: true } },
      },
    });
    const ids = users.map((u) => u.id);
    const kinds = visibleKinds(viewer.role);
    const [files, requests] = await Promise.all([
      this.prisma.staffFile.groupBy({
        by: ['userId', 'kind', 'status'],
        where: { userId: { in: ids }, kind: { in: kinds } },
        _count: { _all: true },
      }),
      hasRole(HR_ROLES, viewer.role)
        ? this.prisma.staffRequest.groupBy({
            by: ['userId'],
            where: { userId: { in: ids }, status: StaffRequestStatus.OPEN },
            _count: { _all: true },
          })
        : Promise.resolve([] as { userId: string; _count: { _all: number } }[]),
    ]);
    const paperwork = handlesPaperwork(viewer.role);
    return users.map(({ kycDocuments, ...u }) => {
      const mine = files.filter((f) => f.userId === u.id);
      const count = (pred: (f: (typeof mine)[number]) => boolean) => mine.filter(pred).reduce((n, f) => n + f._count._all, 0);
      return {
        ...u,
        files: count(() => true),
        pendingExpenses: count((f) => f.kind === StaffFileKind.EXPENSE && f.status === StaffFileStatus.PENDING),
        newDocuments: count((f) => f.kind === StaffFileKind.EMPLOYEE_DOCUMENT && f.status === StaffFileStatus.PENDING),
        openRequests: requests.find((r) => r.userId === u.id)?._count._all ?? 0,
        compliance: paperwork && u.role !== UserRole.ADMIN ? personnelCompliance(u.role, kycDocuments) : null,
      };
    });
  }

  async person(viewer: AuthenticatedUser, id: string) {
    const user = await this.personnel(id);
    const kinds = visibleKinds(viewer.role);
    const [files, requests, kyc, missions] = await Promise.all([
      this.prisma.staffFile.findMany({ where: { userId: id, kind: { in: kinds } }, orderBy: { createdAt: 'desc' }, take: 300 }),
      hasRole(HR_ROLES, viewer.role)
        ? this.prisma.staffRequest.findMany({ where: { userId: id }, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], take: 100 })
        : Promise.resolve([]),
      handlesPaperwork(viewer.role)
        ? this.prisma.kycDocument.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' } })
        : Promise.resolve([]),
      user.role === UserRole.DRIVER
        ? this.prisma.mission.findMany({
            where: { driverId: id },
            orderBy: { pickupAt: 'desc' },
            take: 30,
            select: { id: true, reference: true, pickupCity: true, deliveryCity: true, pickupAt: true, status: true },
          })
        : Promise.resolve([]),
    ]);
    return {
      user,
      files,
      requests,
      kyc,
      missions,
      compliance: handlesPaperwork(viewer.role) && user.role !== UserRole.ADMIN ? personnelCompliance(user.role, kyc) : null,
    };
  }

  async addForPerson(viewer: AuthenticatedUser, id: string, dto: PersonStaffFileDto) {
    if (dto.kind === 'TRAVEL' && !hasRole(TRAVEL_ROLES, viewer.role)) {
      throw new ForbiddenException('Dépôt de billets réservé à l\'exploitation, au secrétariat et à la RH.');
    }
    if (dto.kind === 'HR_DOCUMENT' && !hasRole(HR_ROLES, viewer.role)) {
      throw new ForbiddenException('Documents administratifs réservés à la RH et à l\'administrateur.');
    }
    const person = await this.personnel(id);
    await this.assertFreshFile(dto.fileUrl);
    // L'équipe peut rattacher n'importe quelle mission.
    const link = await this.mission(dto.missionId, viewer, id);
    const by = await this.nameOf(viewer.id);
    const file = await this.prisma.staffFile.create({
      data: {
        userId: id,
        kind: dto.kind as StaffFileKind,
        category: dto.category,
        title: dto.title?.trim() || label(dto.category),
        note: dto.note?.trim() || null,
        spentAt: dto.spentAt ? new Date(dto.spentAt) : null,
        ...link,
        status: StaffFileStatus.APPROVED,
        fileUrl: dto.fileUrl,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        fileSize: dto.fileSize,
        uploadedById: viewer.id,
        uploadedByName: by,
      },
    });
    const when = file.spentAt ? ` du ${file.spentAt.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}` : '';
    await this.notifications
      .notify(
        person.id,
        'SYSTEM',
        dto.kind === 'TRAVEL' ? 'Nouveau billet / réservation' : 'Nouveau document de la RH',
        `${file.title}${when}${link.missionRef ? ` · ${link.missionRef}` : ''} : à télécharger dans Mon espace.`,
        { kind: 'STAFF_FILE', staffFileId: file.id },
      )
      .catch(() => undefined);
    await this.prisma.auditLog.create({
      data: { userId: viewer.id, action: 'STAFF_FILE_ADD', entity: 'StaffFile', entityId: file.id, metadata: { kind: dto.kind, for: id } },
    });
    return file;
  }

  /** Retrait d'une pièce par l'équipe (celui qui l'a déposée, ou l'administrateur). */
  async removeByStaff(viewer: AuthenticatedUser, id: string) {
    const file = await this.prisma.staffFile.findUnique({ where: { id } });
    if (!file || !visibleKinds(viewer.role).includes(file.kind)) throw new NotFoundException('Pièce introuvable.');
    if (viewer.role !== UserRole.ADMIN && file.uploadedById !== viewer.id && !hasRole(HR_ROLES, viewer.role)) {
      throw new ForbiddenException('Seul l\'auteur du dépôt ou l\'administrateur peut retirer cette pièce.');
    }
    await this.prisma.staffFile.delete({ where: { id } });
    await this.storage.removeByUrl(file.fileUrl);
    await this.prisma.auditLog.create({
      data: { userId: viewer.id, action: 'STAFF_FILE_DELETE', entity: 'StaffFile', entityId: id, metadata: { kind: file.kind, for: file.userId } },
    });
    return { id };
  }

  async createRequest(viewer: AuthenticatedUser, id: string, dto: StaffRequestDto) {
    const person = await this.personnel(id);
    const by = await this.nameOf(viewer.id);
    const req = await this.prisma.staffRequest.create({
      data: {
        userId: person.id,
        title: dto.title.trim(),
        message: dto.message?.trim() || null,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        requestedById: viewer.id,
        requestedByName: by,
      },
    });
    const due = req.dueAt ? ` avant le ${req.dueAt.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}` : '';
    await this.notifications
      .notify(person.id, 'SYSTEM', 'Pièce demandée par la RH', `${req.title}${due} : à envoyer depuis Mon espace.`, {
        kind: 'STAFF_REQUEST', staffRequestId: req.id,
      })
      .catch(() => undefined);
    return req;
  }

  async cancelRequest(id: string) {
    const req = await this.prisma.staffRequest.findUnique({ where: { id }, select: { id: true } });
    if (!req) throw new NotFoundException('Demande introuvable.');
    return this.prisma.staffRequest.update({ where: { id }, data: { status: StaffRequestStatus.CANCELLED } });
  }

  /** Justificatifs de frais (comptabilité) ou pièces reçues (RH). */
  async inbox(kind: StaffFileKind, opts: { status?: string; from?: string; to?: string }) {
    const status = opts.status && opts.status in StaffFileStatus ? (opts.status as StaffFileStatus) : undefined;
    const createdAt: Prisma.DateTimeFilter = {};
    if (opts.from && !Number.isNaN(Date.parse(opts.from))) createdAt.gte = new Date(opts.from);
    if (opts.to && !Number.isNaN(Date.parse(opts.to))) createdAt.lte = new Date(opts.to);
    const rows = await this.prisma.staffFile.findMany({
      where: { kind, ...(status ? { status } : {}), ...(createdAt.gte || createdAt.lte ? { createdAt } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true } } },
    });
    return rows;
  }

  async review(viewer: AuthenticatedUser, id: string, dto: ReviewStaffFileDto, kind: StaffFileKind) {
    const file = await this.prisma.staffFile.findUnique({ where: { id } });
    if (!file || file.kind !== kind) throw new NotFoundException('Pièce introuvable.');
    if (dto.status === 'REIMBURSED' && kind !== StaffFileKind.EXPENSE) {
      throw new BadRequestException('Seuls les frais se remboursent.');
    }
    const updated = await this.prisma.staffFile.update({
      where: { id },
      data: {
        status: dto.status as StaffFileStatus,
        reviewNote: dto.note?.trim() || null,
        reviewedAt: new Date(),
        reviewedById: viewer.id,
      },
    });
    const WORD: Record<string, string> = {
      APPROVED: kind === StaffFileKind.EXPENSE ? 'validé' : 'reçu et validé',
      REJECTED: 'refusé',
      REIMBURSED: 'remboursé',
    };
    if (WORD[dto.status]) {
      await this.notifications
        .notify(
          file.userId,
          'SYSTEM',
          kind === StaffFileKind.EXPENSE ? `Justificatif ${WORD[dto.status]}` : `Document ${WORD[dto.status]}`,
          `${file.title}${dto.note?.trim() ? ` : ${dto.note.trim()}` : '.'}`,
          { kind: 'STAFF_FILE', staffFileId: file.id },
        )
        .catch(() => undefined);
    }
    await this.prisma.auditLog.create({
      data: { userId: viewer.id, action: 'STAFF_FILE_REVIEW', entity: 'StaffFile', entityId: id, metadata: { status: dto.status } },
    });
    return updated;
  }

  // ─── Annonces (secrétariat) ────────────────────────────────────────────────

  async announce(viewer: AuthenticatedUser, dto: AnnouncementDto) {
    if (dto.attachmentUrl && !STAFF_FILE_URL.test(dto.attachmentUrl)) {
      throw new BadRequestException('Pièce jointe invalide : envoyez-la depuis l\'application.');
    }
    let recipients: string[];
    if (dto.audience === 'PEOPLE') {
      const wanted = [...new Set(dto.recipientIds ?? [])];
      if (!wanted.length) throw new BadRequestException('Choisissez au moins un destinataire.');
      const found = await this.prisma.user.findMany({
        where: { id: { in: wanted }, role: { in: [...PERSONNEL_ROLES, UserRole.ADMIN] }, deletedAt: null },
        select: { id: true },
      });
      recipients = found.map((u) => u.id);
    } else {
      const roles =
        dto.audience === 'DRIVERS'
          ? [UserRole.DRIVER]
          : dto.audience === 'TEAM'
            ? [UserRole.ADMIN, ...TEAM_ROLES]
            : [UserRole.ADMIN, ...PERSONNEL_ROLES];
      recipients = await this.usersWithRoles(roles);
    }
    recipients = recipients.filter((r) => r !== viewer.id);
    if (!recipients.length) throw new BadRequestException('Aucun destinataire pour cette annonce.');

    const authorName = await this.nameOf(viewer.id);
    const a = await this.prisma.announcement.create({
      data: {
        authorId: viewer.id,
        authorName,
        title: dto.title.trim(),
        body: dto.body.trim(),
        audience: dto.audience,
        recipientIds: recipients,
        recipientCount: recipients.length,
        attachmentUrl: dto.attachmentUrl ?? null,
        attachmentName: dto.attachmentUrl ? dto.attachmentName ?? 'Pièce jointe' : null,
        attachmentMime: dto.attachmentUrl ? dto.attachmentMime ?? null : null,
      },
    });
    const preview = a.body.length > 160 ? `${a.body.slice(0, 157)}…` : a.body;
    await this.notifyAll(recipients, a.title, preview, { kind: 'ANNOUNCEMENT', announcementId: a.id });
    return a;
  }

  listAnnouncements() {
    return this.prisma.announcement.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  }
}

/** Accès à un fichier du dossier « staff » (servi par /storage/file). */
export async function canReadStaffFile(prisma: PrismaService, user: AuthenticatedUser, suffix: string): Promise<boolean> {
  const file = await prisma.staffFile.findFirst({
    where: { fileUrl: { endsWith: suffix } },
    select: { userId: true, uploadedById: true, kind: true },
  });
  if (file) {
    return file.userId === user.id || file.uploadedById === user.id || visibleKinds(user.role).includes(file.kind);
  }
  const a = await prisma.announcement.findFirst({
    where: { attachmentUrl: { endsWith: suffix } },
    select: { authorId: true, recipientIds: true },
  });
  if (a) return a.authorId === user.id || a.recipientIds.includes(user.id) || hasRole(ANNOUNCE_ROLES, user.role);
  // Pas encore rattaché (envoi en cours) : seul l'administrateur y accède.
  return user.role === UserRole.ADMIN;
}

export { DRIVER_REQUIRED_KYC, driverCompliance } from '../../common/auth/driver-kyc';
