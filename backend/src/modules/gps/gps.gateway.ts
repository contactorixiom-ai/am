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
  namespace: 'gps',
  cors: { origin: true, credentials: true },
})
export class GpsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(GpsGateway.name);

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket): void {
    this.logger.debug(`GPS client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`GPS client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe-mission')
  onSubscribe(
    @MessageBody() data: { missionId: string },
    @ConnectedSocket() client: Socket,
  ): { ok: boolean } {
    if (!data?.missionId) return { ok: false };
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
