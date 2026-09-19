import { Injectable, Logger } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async notify(userId: string, type: NotificationType, title: string, body: string, payload?: Prisma.JsonObject) {
    const notification = await this.prisma.notification.create({
      data: { userId, type, title, body, payload: payload as Prisma.InputJsonValue },
    });
    // TODO: dispatch to push providers (FCM / APNS) via PushToken
    this.logger.debug(`Notification ${type} -> user ${userId}`);
    return notification;
  }

  async list(userId: string, skip: number, take: number) {
    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);
    return { data, total };
  }

  markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
