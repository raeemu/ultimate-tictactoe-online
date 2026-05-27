import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

export type InviteRealtimePayload = {
  id: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
  createdAt: string;
};

@Injectable()
export class InviteEventsService {
  private server: Server | null = null;

  setServer(server: Server) {
    this.server = server;
  }

  emitReceived(userId: string, invite: InviteRealtimePayload) {
    this.emitToUser(userId, 'invite:received', { invite });
  }

  emitAccepted(userId: string, payload: { inviteId: string; matchId: string }) {
    this.emitToUser(userId, 'invite:accepted', payload);
  }

  emitDeclined(userId: string, payload: { inviteId: string }) {
    this.emitToUser(userId, 'invite:declined', payload);
  }

  emitCanceled(userId: string, payload: { inviteId: string }) {
    this.emitToUser(userId, 'invite:canceled', payload);
  }

  private emitToUser(userId: string, event: string, payload: unknown) {
    this.server?.to(this.userRoom(userId)).emit(event, payload);
  }

  userRoom(userId: string) {
    return `user:${userId}`;
  }
}
