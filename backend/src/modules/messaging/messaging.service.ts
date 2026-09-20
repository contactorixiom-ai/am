import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CallStatus, CallType, NotificationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { SendMessageDto } from './dto/send-message.dto';

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
          participants: { include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } } },
          mission: { select: { id: true, reference: true, status: true } },
          messages: { take: 1, orderBy: { createdAt: 'desc' } },
        },
        orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.conversation.count({ where }),
    ]);
    return { data, total };
  }

  async getConversation(id: string, user: AuthenticatedUser) {
    const conv = await this.requireMember(id, user.id);
    return this.prisma.conversation.findUnique({
      where: { id: conv.id },
      include: {
        participants: { include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } } },
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
      const suffix = conv.mission?.reference ? ` · ${conv.mission.reference}` : '';
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
    if (!call) throw new NotFoundException('Call not found');
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
    if (!part) throw new ForbiddenException('Not a conversation participant');
    return { id: conversationId };
  }
}
