import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CallStatus, CallType, ConversationType, NotificationType, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { SendMessageDto } from './dto/send-message.dto';
import { hasRole, INTERNAL_ROLES, isStaff, STAFF_ROLES } from '../../common/auth/staff';
import { CreateGroupDto, UpdateGroupDto } from './dto/group.dto';

const USER_CARD = { id: true, firstName: true, lastName: true, avatarUrl: true, role: true, phone: true } as const;

@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async listConversations(userId: string, skip: number, take: number) {
    const where = { participants: { some: { userId } } };
    const [data, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        skip,
        take,
        include: {
          participants: { include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, role: true, phone: true } } } },
          mission: { select: { id: true, reference: true, status: true } },
          messages: { take: 1, orderBy: { createdAt: 'desc' } },
        },
        orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      }),
      this.prisma.conversation.count({ where }),
    ]);
    // Nombre de messages non lus par conversation (pastille chiffrée).
    const withUnread = await Promise.all(
      data.map(async (c) => {
        const me = c.participants.find((p) => p.userId === userId);
        const unreadCount = await this.prisma.message.count({
          where: {
            conversationId: c.id,
            senderId: { not: userId },
            deletedAt: null,
            ...(me?.lastReadAt ? { createdAt: { gt: me.lastReadAt } } : {}),
          },
        });
        return { ...c, unreadCount };
      }),
    );
    return { data: withUnread, total };
  }

  /** Compteurs des pastilles rouges : notifications et messages non lus. */
  async badges(userId: string) {
    const parts = await this.prisma.conversationParticipant.findMany({
      where: { userId },
      select: { conversationId: true, lastReadAt: true },
    });
    const counts = await Promise.all(
      parts.map((p) =>
        this.prisma.message.count({
          where: {
            conversationId: p.conversationId,
            senderId: { not: userId },
            deletedAt: null,
            ...(p.lastReadAt ? { createdAt: { gt: p.lastReadAt } } : {}),
          },
        }),
      ),
    );
    const notifications = await this.prisma.notification.count({ where: { userId, readAt: null } });
    return {
      notifications,
      messages: counts.reduce((a, b) => a + b, 0),
      conversations: counts.filter((n) => n > 0).length,
    };
  }

  // ─── Messagerie interne ──────────────────────────────────────────────────

  /** Personnes de l'équipe et convoyeurs à qui écrire (annuaire interne). */
  async contacts(user: AuthenticatedUser) {
    if (!hasRole(INTERNAL_ROLES, user.role)) throw new ForbiddenException('Messagerie interne réservée à l\'équipe Axis.');
    return this.prisma.user.findMany({
      where: {
        id: { not: user.id },
        role: { in: INTERNAL_ROLES },
        deletedAt: null,
        status: { notIn: [UserStatus.DELETED, UserStatus.SUSPENDED] },
      },
      orderBy: [{ role: 'asc' }, { lastName: 'asc' }],
      take: 500,
      select: { ...USER_CARD, accountNo: true },
    });
  }

  /**
   * Fil direct entre deux personnes. Entre comptes internes ; l'administrateur
   * (et le responsable d'exploitation) peut aussi écrire à un client.
   */
  async openDirect(user: AuthenticatedUser, otherId: string) {
    if (otherId === user.id) throw new BadRequestException('Choisissez une autre personne.');
    const other = await this.prisma.user.findFirst({ where: { id: otherId, deletedAt: null }, select: { id: true, role: true } });
    if (!other) throw new NotFoundException('Personne introuvable.');
    const meInternal = hasRole(INTERNAL_ROLES, user.role);
    const otherInternal = hasRole(INTERNAL_ROLES, other.role);
    if (!meInternal || (!otherInternal && !isStaff(user.role))) {
      throw new ForbiddenException('Messagerie interne réservée à l\'équipe Axis.');
    }
    const existing = await this.prisma.conversation.findFirst({
      where: {
        type: ConversationType.DIRECT,
        AND: [{ participants: { some: { userId: user.id } } }, { participants: { some: { userId: otherId } } }],
        participants: { every: { userId: { in: [user.id, otherId] } } },
      },
      select: { id: true },
    });
    if (existing) return existing;
    return this.prisma.conversation.create({
      data: {
        type: ConversationType.DIRECT,
        createdById: user.id,
        participants: { create: [{ userId: user.id }, { userId: otherId }] },
      },
      select: { id: true },
    });
  }

  private async internalIds(ids: string[]) {
    const found = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(ids)] }, role: { in: INTERNAL_ROLES }, deletedAt: null },
      select: { id: true },
    });
    return found.map((u) => u.id);
  }

  /** Administrateur : crée un groupe avec les personnes de son choix. */
  async createGroup(admin: AuthenticatedUser, dto: CreateGroupDto) {
    const members = (await this.internalIds(dto.memberIds)).filter((id) => id !== admin.id);
    if (!members.length) throw new BadRequestException('Ajoutez au moins une personne au groupe.');
    const conv = await this.prisma.conversation.create({
      data: {
        type: ConversationType.GROUP,
        title: dto.title.trim(),
        createdById: admin.id,
        lastMessageAt: new Date(),
        participants: { create: [admin.id, ...members].map((userId) => ({ userId })) },
      },
      select: { id: true, title: true },
    });
    const name = await this.prisma.user.findUnique({ where: { id: admin.id }, select: { firstName: true, lastName: true } });
    await this.prisma.message.create({
      data: { conversationId: conv.id, senderId: admin.id, type: 'SYSTEM', body: `${name?.firstName ?? ''} ${name?.lastName ?? ''}`.trim() + ` a créé le groupe « ${conv.title} ».` },
    });
    await Promise.all(
      members.map((m) =>
        this.notifications
          .notify(m, NotificationType.NEW_MESSAGE, `Nouveau groupe : ${conv.title}`, 'Vous avez été ajouté(e) à un groupe de discussion.', { conversationId: conv.id } as never)
          .catch(() => undefined),
      ),
    );
    return conv;
  }

  private async requireGroup(id: string) {
    const conv = await this.prisma.conversation.findUnique({ where: { id }, select: { id: true, type: true, createdById: true } });
    if (!conv || conv.type !== ConversationType.GROUP) throw new NotFoundException('Groupe introuvable.');
    return conv;
  }

  /** Administrateur : renomme, ajoute ou retire des membres. */
  async updateGroup(admin: AuthenticatedUser, id: string, dto: UpdateGroupDto) {
    await this.requireGroup(id);
    if (dto.title?.trim()) await this.prisma.conversation.update({ where: { id }, data: { title: dto.title.trim() } });
    if (dto.addIds?.length) {
      for (const userId of await this.internalIds(dto.addIds)) {
        await this.prisma.conversationParticipant.upsert({
          where: { conversationId_userId: { conversationId: id, userId } },
          create: { conversationId: id, userId },
          update: {},
        });
      }
    }
    if (dto.removeIds?.length) {
      await this.prisma.conversationParticipant.deleteMany({
        where: { conversationId: id, userId: { in: dto.removeIds.filter((u) => u !== admin.id) } },
      });
    }
    // L'administrateur garde la main sur ses groupes.
    await this.prisma.conversationParticipant.upsert({
      where: { conversationId_userId: { conversationId: id, userId: admin.id } },
      create: { conversationId: id, userId: admin.id },
      update: {},
    });
    return this.getConversation(id, admin);
  }

  /** Administrateur : supprime un groupe et ses messages. */
  async deleteGroup(id: string) {
    await this.requireGroup(id);
    await this.prisma.conversation.delete({ where: { id } });
    return { id, deleted: true };
  }

  /** Quitter un groupe (membre). */
  async leaveGroup(user: AuthenticatedUser, id: string) {
    await this.requireGroup(id);
    await this.requireMember(id, user.id);
    await this.prisma.conversationParticipant.delete({ where: { conversationId_userId: { conversationId: id, userId: user.id } } });
    return { id, left: true };
  }

  /**
   * Fil « Support Axis » d'un client ou d'un convoyeur avec l'équipe Axis.
   * « Contacter Axis » ouvrait les conversations de mission, dont Roger ne
   * fait pas partie : le message arrivait au convoyeur, ou nulle part.
   */
  async openSupport(user: AuthenticatedUser) {
    if (isStaff(user.role)) {
      throw new ForbiddenException('Les échanges avec les clients se trouvent dans la liste des conversations.');
    }
    const admins = await this.prisma.user.findMany({
      where: { role: { in: STAFF_ROLES }, deletedAt: null },
      select: { id: true },
    });
    let conv = await this.prisma.conversation.findFirst({
      where: {
        type: 'SUPPORT',
        participants: { some: { userId: user.id } },
      },
      select: { id: true },
    });
    if (!conv) {
      conv = await this.prisma.conversation.create({
        data: { type: 'SUPPORT', participants: { create: [{ userId: user.id }] } },
        select: { id: true },
      });
    }
    // Tout administrateur, y compris ajouté depuis, reçoit les messages.
    for (const a of admins) {
      await this.prisma.conversationParticipant.upsert({
        where: { conversationId_userId: { conversationId: conv.id, userId: a.id } },
        create: { conversationId: conv.id, userId: a.id },
        update: {},
      });
    }
    return conv;
  }

  async getConversation(id: string, user: AuthenticatedUser) {
    const conv = await this.requireMember(id, user.id);
    return this.prisma.conversation.findUnique({
      where: { id: conv.id },
      include: {
        participants: { include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, role: true, phone: true } } } },
        mission: true,
      },
    });
  }

  async listMessages(id: string, user: AuthenticatedUser, opts: { skip: number; take: number }) {
    await this.requireMember(id, user.id);
    const [data, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId: id, deletedAt: null },
        skip: opts.skip,
        take: opts.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.message.count({ where: { conversationId: id, deletedAt: null } }),
    ]);
    return { data, total };
  }

  async sendMessage(conversationId: string, senderId: string, dto: SendMessageDto) {
    await this.requireMember(conversationId, senderId);
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        type: dto.type,
        body: dto.body,
        attachmentUrl: dto.attachmentUrl,
        attachmentMime: dto.attachmentMime,
        latitude: dto.latitude,
        longitude: dto.longitude,
      },
    });
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: message.createdAt },
    });
    await this.notifyOthers(conversationId, senderId, message.body ?? '');
    return message;
  }

  /**
   * Prévient les autres participants. Sans cela, un message envoyé à un
   * client qui n'a pas l'application ouverte ne lui parvenait jamais : rien
   * ne le signalait.
   *
   * On ne notifie qu'au premier message non lu d'une série, sinon une
   * conversation active remplit la liste de notifications.
   */
  private async notifyOthers(conversationId: string, senderId: string, body: string): Promise<void> {
    try {
      const [conv, sender] = await Promise.all([
        this.prisma.conversation.findUnique({
          where: { id: conversationId },
          select: {
            type: true,
            title: true,
            mission: { select: { reference: true } },
            participants: {
              where: { userId: { not: senderId }, isMuted: false },
              select: { userId: true, lastReadAt: true },
            },
          },
        }),
        this.prisma.user.findUnique({
          where: { id: senderId },
          select: { firstName: true, lastName: true },
        }),
      ]);
      if (!conv) return;

      const from = sender ? `${sender.firstName} ${sender.lastName}`.trim() : 'Axis Import';
      const suffix = conv.title ? ` · ${conv.title}` : conv.mission?.reference ? ` · ${conv.mission.reference}` : '';
      const preview = body.length > 120 ? `${body.slice(0, 117)}…` : body;

      await Promise.all(
        conv.participants.map(async (p) => {
          // Déjà un message non lu en attente : inutile d'en rajouter un.
          const pending = await this.prisma.message.count({
            where: {
              conversationId,
              senderId: { not: p.userId },
              deletedAt: null,
              ...(p.lastReadAt ? { createdAt: { gt: p.lastReadAt } } : {}),
            },
          });
          if (pending > 1) return;
          await this.notifications.notify(
            p.userId,
            NotificationType.NEW_MESSAGE,
            `Message de ${from}${suffix}`,
            preview || 'Nouveau message',
            { conversationId } as never,
          );
        }),
      );
    } catch {
      /* un message part même si la notification échoue */
    }
  }

  async markRead(conversationId: string, userId: string) {
    await this.requireMember(conversationId, userId);
    return this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });
  }

  async initiateCall(conversationId: string, initiatorId: string, type: CallType) {
    await this.requireMember(conversationId, initiatorId);
    return this.prisma.call.create({
      data: {
        conversationId,
        initiatorId,
        type,
        status: CallStatus.RINGING,
      },
    });
  }

  async updateCall(callId: string, userId: string, status: CallStatus) {
    const call = await this.prisma.call.findUnique({ where: { id: callId } });
    if (!call) throw new NotFoundException('Appel introuvable.');
    await this.requireMember(call.conversationId, userId);

    const data: Record<string, unknown> = { status };
    if (status === CallStatus.ANSWERED) data.answeredAt = new Date();
    const terminalStatuses: CallStatus[] = [CallStatus.ENDED, CallStatus.DECLINED, CallStatus.MISSED, CallStatus.FAILED];
    if (terminalStatuses.includes(status)) {
      data.endedAt = new Date();
      if (call.answeredAt) {
        data.durationSec = Math.floor((Date.now() - call.answeredAt.getTime()) / 1000);
      }
    }
    return this.prisma.call.update({ where: { id: callId }, data });
  }

  private async requireMember(conversationId: string, userId: string) {
    const part = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!part) throw new ForbiddenException('Vous ne participez pas à cette conversation.');
    return { id: conversationId };
  }
}
