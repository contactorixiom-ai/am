import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
import { GpsService } from './gps.service';

@WebSocketGateway({
  namespace: 'gps',
  cors: { origin: true, credentials: true },
})
export class GpsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(GpsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly gps: GpsService,
  ) {}

  // Connexion refusée sans jeton valide (handshake.auth.token ou
  // « Authorization: Bearer … ») : la position d'un convoyage ne se diffuse
  // qu'à ses participants.
  async handleConnection(client: Socket): Promise<void> {
    try {
      const raw =
        (client.handshake.auth as { token?: string } | undefined)?.token ??
        (client.handshake.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
      const payload = await this.jwt.verifyAsync<{ sub: string }>(raw, { secret: this.config.get<string>('jwt.secret') });
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true, status: true } });
      if (!user || user.status === 'SUSPENDED' || user.status === 'DELETED') throw new Error('compte inactif');
      (client.data as { user?: { id: string; role: UserRole } }).user = { id: user.id, role: user.role };
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`GPS client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe-mission')
  async onSubscribe(
    @MessageBody() data: { missionId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<{ ok: boolean }> {
    const user = (client.data as { user?: { id: string; role: UserRole } }).user;
    if (!data?.missionId || !user) return { ok: false };
    try {
      await this.gps.assertCanView(data.missionId, user);
    } catch {
      return { ok: false };
    }
    void client.join(`mission:${data.missionId}`);
    return { ok: true };
  }

  @SubscribeMessage('unsubscribe-mission')
  onUnsubscribe(
    @MessageBody() data: { missionId: string },
    @ConnectedSocket() client: Socket,
  ): { ok: boolean } {
    if (!data?.missionId) return { ok: false };
    void client.leave(`mission:${data.missionId}`);
    return { ok: true };
  }

  broadcastLocation(missionId: string, point: unknown): void {
    this.server.to(`mission:${missionId}`).emit('location', point);
  }
}
