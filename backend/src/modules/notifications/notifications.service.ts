import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType, Prisma, PushPlatform } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { isExpoPushToken, sendExpoPush } from './expo-push';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async notify(userId: string, type: NotificationType, title: string, body: string, payload?: Prisma.JsonObject) {
    const notification = await this.prisma.notification.create({
      data: { userId, type, title, body, payload: payload as Prisma.InputJsonValue },
    });
    // La notification restait en base et n'apparaissait qu'à l'ouverture de
    // l'application : aucun envoi sur le téléphone. L'envoi part sans être
    // attendu, pour qu'un service de push lent ne ralentisse pas l'action
    // qui l'a déclenché.
    void this.push(userId, title, body, { notificationId: notification.id, type, ...(payload ?? {}) });
    return notification;
  }

  /** Enregistre le jeton de notification d'un appareil. */
  async registerPushToken(userId: string, token: string, platform: PushPlatform, deviceId?: string) {
    // Le jeton appartient à l'appareil : si quelqu'un d'autre s'y connecte,
    // il lui est réattribué, l'ancien titulaire ne reçoit plus rien dessus.
    return this.prisma.pushToken.upsert({
      where: { token },
      create: { userId, token, platform, deviceId },
      update: { userId, platform, deviceId, lastUsedAt: new Date() },
      select: { id: true, platform: true, createdAt: true },
    });
  }

  /** À la déconnexion : l'appareil cesse de recevoir les notifications du compte. */
  async removePushToken(userId: string, token: string) {
    await this.prisma.pushToken.deleteMany({ where: { userId, token } });
  }

  private async push(userId: string, title: string, body: string, data: Record<string, unknown>) {
    try {
      const tokens = await this.prisma.pushToken.findMany({
        where: { userId },
        select: { id: true, token: true },
      });
      const valid = tokens.filter((t) => isExpoPushToken(t.token));
      if (valid.length === 0) return;

      const tickets = await sendExpoPush(
        valid.map((t) => ({
          to: t.token,
          title,
          body: body.length > 180 ? `${body.slice(0, 177)}…` : body,
          data,
          sound: 'default' as const,
          channelId: 'default',
        })),
        this.config.get<string>('push.expoAccessToken'),
      );

      // Application désinstallée ou autorisation retirée : le jeton est mort,
      // on arrête de l'utiliser.
      const dead = valid.filter((_, i) => tickets[i]?.details?.error === 'DeviceNotRegistered');
      if (dead.length > 0) {
        await this.prisma.pushToken.deleteMany({ where: { id: { in: dead.map((t) => t.id) } } });
      }
      const failed = tickets.filter((t) => t.status === 'error').length;
      if (failed > 0) this.logger.warn(`Push : ${failed}/${tickets.length} envoi(s) refusé(s) pour ${userId}`);
    } catch (err) {
      this.logger.warn(`Push impossible pour ${userId} : ${(err as Error).message}`);
    }
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
