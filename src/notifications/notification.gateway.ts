import {
    SubscribeMessage,
    WebSocketGateway,
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    WebSocketServer,
  } from '@nestjs/websockets';
  import { Server, Socket } from 'socket.io';
  
  @WebSocketGateway({ cors: true })
  export class NotificationGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
  {
    @WebSocketServer() server: Server;
  
    afterInit(server: Server) {
      console.log('WebSocket Initialized');
    }
  
    handleConnection(client: Socket) {
      const userId = client.handshake.query.userId;
      if (userId) {
        client.join(userId.toString());
        console.log(`Client connected: ${userId}`);
      }
    }
  
    handleDisconnect(client: Socket) {
      console.log('Client disconnected');
    }
  
    sendNotification(userId: number, payload: any) {
      this.server.to(userId.toString()).emit('notification', payload);
    }
  }
  