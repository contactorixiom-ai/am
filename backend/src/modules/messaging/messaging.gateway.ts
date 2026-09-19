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
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: 'messaging',
  cors: { origin: true, credentials: true },
})
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(MessagingGateway.name);

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket): void {
    this.logger.debug(`Messaging client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Messaging client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-conversation')
  onJoin(@MessageBody() data: { conversationId: string }, @ConnectedSocket() client: Socket): { ok: boolean } {
    if (!data?.conversationId) return { ok: false };
    void client.join(`conv:${data.conversationId}`);
    return { ok: true };
  }

  @SubscribeMessage('leave-conversation')
  onLeave(@MessageBody() data: { conversationId: string }, @ConnectedSocket() client: Socket): { ok: boolean } {
    if (!data?.conversationId) return { ok: false };
    void client.leave(`conv:${data.conversationId}`);
    return { ok: true };
  }

  @SubscribeMessage('typing')
  onTyping(@MessageBody() data: { conversationId: string; userId: string; isTyping: boolean }): void {
    if (!data?.conversationId) return;
    this.server.to(`conv:${data.conversationId}`).emit('typing', data);
  }

  broadcastMessage(conversationId: string, message: unknown): void {
    this.server.to(`conv:${conversationId}`).emit('message', message);
  }

  broadcastCall(conversationId: string, call: unknown): void {
    this.server.to(`conv:${conversationId}`).emit('call', call);
  }
}
