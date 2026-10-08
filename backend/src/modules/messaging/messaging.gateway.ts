import { Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { UserStatus } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';

interface JwtPayload {
  sub: string;
  email: string;
}

/**
 * Canal temps réel des conversations.
 *
 * Il était entièrement ouvert : n'importe quel client pouvait se connecter
 * sans jeton, rejoindre `conv:<id>` avec un identifiant quelconque et
 * recevoir en direct tous les messages de la conversation. Désormais la
 * connexion exige un jeton valide et l'appartenance à la conversation est
 * vérifiée en base avant toute adhésion à la salle.
 */
@WebSocketGateway({
  namespace: 'messaging',
  cors: { origin: true, credentials: true },
})
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(MessagingGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @WebSocketServer()
  server!: Server;

  async handleConnection(client: Socket): Promise<void> {
    try {
      const user = await this.authenticate(client);
      client.data.userId = user.id;
      this.logger.debug(`Messaging client connected: ${client.id} (${user.id})`);
    } catch {
      // Pas de jeton valide : on referme au lieu de laisser écouter.
      this.logger.warn(`Messaging client refused: ${client.id}`);
      client.emit('unauthorized', { message: 'Jeton manquant ou invalide.' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Messaging client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-conversation')
  async onJoin(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<{ ok: boolean; reason?: string }> {
    const userId = client.data.userId as string | undefined;
    if (!userId) return { ok: false, reason: 'unauthenticated' };
    if (!data?.conversationId) return { ok: false, reason: 'missing-conversation' };
    if (!(await this.isMember(data.conversationId, userId))) {
      return { ok: false, reason: 'forbidden' };
    }
    void client.join(`conv:${data.conversationId}`);
    return { ok: true };
  }

  @SubscribeMessage('leave-conversation')
  onLeave(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ): { ok: boolean } {
    if (!data?.conversationId) return { ok: false };
    void client.leave(`conv:${data.conversationId}`);
    return { ok: true };
  }

  @SubscribeMessage('typing')
  onTyping(
    @MessageBody() data: { conversationId: string; isTyping: boolean },
    @ConnectedSocket() client: Socket,
  ): void {
    const userId = client.data.userId as string | undefined;
    if (!userId || !data?.conversationId) return;
    // On ne rediffuse que dans une salle réellement rejointe, et avec
    // l'identité du socket : un client annonçait auparavant le userId de
    // son choix.
    if (!client.rooms.has(`conv:${data.conversationId}`)) return;
    this.server.to(`conv:${data.conversationId}`).emit('typing', {
      conversationId: data.conversationId,
      userId,
      isTyping: !!data.isTyping,
    });
  }

  broadcastMessage(conversationId: string, message: unknown): void {
    this.server.to(`conv:${conversationId}`).emit('message', message);
  }

  broadcastCall(conversationId: string, call: unknown): void {
    this.server.to(`conv:${conversationId}`).emit('call', call);
  }

  /** Jeton lu dans le handshake (auth.token, en-tête, ou paramètre). */
  private async authenticate(client: Socket): Promise<{ id: string }> {
    const raw =
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.headers?.authorization as string | undefined) ??
      (client.handshake.query?.token as string | undefined);
    if (!raw) throw new UnauthorizedException();
    const token = raw.startsWith('Bearer ') ? raw.slice(7) : raw;

    const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
      secret: this.config.get<string>('jwt.secret', 'change-me'),
    });
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, status: true },
    });
    if (!user || user.status === UserStatus.DELETED || user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException();
    }
    return { id: user.id };
  }

  private async isMember(conversationId: string, userId: string): Promise<boolean> {
    const part = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { id: true },
    });
    return !!part;
  }
}
