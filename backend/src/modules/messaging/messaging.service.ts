import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CallStatus, CallType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class MessagingService {
  constructor(private readonly prisma: PrismaService) {}

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
    return message;
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
    if ([CallStatus.ENDED, CallStatus.DECLINED, CallStatus.MISSED, CallStatus.FAILED].includes(status)) {
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
