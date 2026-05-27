import {
  ConnectedSocket,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  ForbiddenException,
  Logger,
  UnauthorizedException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { MatchesService } from '../matches/matches.service';
import { InviteEventsService } from '../invites/invite-events.service';
import { JoinMatchDto } from './dto/join-match.dto';
import { WsMoveDto } from './dto/ws-move.dto';
import { RealtimeStateService } from './realtime-state.service';

type SocketUser = {
  id: string;
  username: string;
};

type SocketData = {
  user?: SocketUser;
  matchIds?: string[];
};

type ServerToClientEvents = {
  error: (payload: { message: string }) => void;
  'match:joined': (payload: { room: string; match: unknown }) => void;
  'match:move': (payload: unknown) => void;
  'match:abandoned': (payload: { match: unknown }) => void;
  'match:presence': (payload: {
    matchId: string;
    activePlayerIds: string[];
  }) => void;
  'match:turn-deadline': (payload: {
    matchId: string;
    deadline: number;
  }) => void;
  'match:turn-timeout': (payload: { matchId: string; match: unknown }) => void;
  'invite:received': (payload: { invite: unknown }) => void;
  'invite:accepted': (payload: { inviteId: string; matchId: string }) => void;
  'invite:declined': (payload: { inviteId: string }) => void;
  'invite:canceled': (payload: { inviteId: string }) => void;
};

type AuthenticatedSocket = Socket<
  Record<string, never>,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

@WebSocketGateway({
  namespace: '/matches',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class WsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server<Record<string, never>, ServerToClientEvents>;

  private readonly logger = new Logger(WsGateway.name);
  private readonly turnTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  constructor(
    private readonly matchesService: MatchesService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly realtimeState: RealtimeStateService,
    private readonly inviteEvents: InviteEventsService,
  ) {}

  afterInit(server: Server<Record<string, never>, ServerToClientEvents>) {
    this.inviteEvents.setServer(server);
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        throw new UnauthorizedException('Missing auth token');
      }

      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        username: string;
      }>(token, {
        secret: this.configService.get<string>('JWT_SECRET', 'dev-secret'),
      });

      client.data.user = {
        id: payload.sub,
        username: payload.username,
      };
      client.data.matchIds = [];
      await this.realtimeState.touchUser(client.data.user);
      await client.join(this.inviteEvents.userRoom(client.data.user.id));
    } catch (error) {
      this.logger.warn(`Socket rejected: ${(error as Error).message}`);
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.data.user?.id;
    if (!userId) {
      return;
    }

    for (const matchId of client.data.matchIds ?? []) {
      await this.realtimeState.markDisconnected(matchId, userId);
      await this.emitMatchPresence(matchId);
      this.scheduleDisconnectGrace(matchId, userId);
    }
  }

  @SubscribeMessage('match:join')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  )
  async onJoinMatch(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: JoinMatchDto,
  ) {
    const userId = client.data.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Unauthorized');
    }
    const user = client.data.user;
    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    const match = await this.matchesService.getMatchSnapshotForUser(
      payload.matchId,
      userId,
    );
    const room = this.getMatchRoom(payload.matchId);
    await client.join(room);
    client.data.matchIds = Array.from(
      new Set([...(client.data.matchIds ?? []), payload.matchId]),
    );
    await this.realtimeState.touchUser(user);
    await this.realtimeState.joinMatch(payload.matchId, userId);

    client.emit('match:joined', {
      room,
      match,
    });
    await this.emitMatchPresence(payload.matchId);
    if (this.isActiveMatch(match)) {
      await this.scheduleTurnTimer(payload.matchId, false);
    }

    return {
      ok: true,
      room,
    };
  }

  @SubscribeMessage('match:move')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  )
  async onCreateMove(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: WsMoveDto,
  ) {
    const userId = client.data.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Unauthorized');
    }

    const room = this.getMatchRoom(payload.matchId);
    if (!client.rooms.has(room)) {
      throw new ForbiddenException('Join match room before sending moves');
    }

    const result = await this.matchesService.createMove(
      payload.matchId,
      userId,
      {
        localBoard: payload.localBoard,
        localCell: payload.localCell,
        clientMoveId: payload.clientMoveId,
      },
    );

    this.server.to(room).emit('match:move', result);
    if (this.isActiveMatch(result.match)) {
      await this.scheduleTurnTimer(payload.matchId, true);
    } else {
      this.clearTurnTimer(payload.matchId);
    }

    return {
      ok: true,
      moveId: result.move.id,
    };
  }

  @SubscribeMessage('match:abandon')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  )
  async onAbandonMatch(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: JoinMatchDto,
  ) {
    const userId = client.data.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Unauthorized');
    }

    const room = this.getMatchRoom(payload.matchId);
    if (!client.rooms.has(room)) {
      throw new ForbiddenException('Join match room before abandoning match');
    }

    const match = await this.matchesService.abandonMatch(
      payload.matchId,
      userId,
    );

    this.server.to(room).emit('match:abandoned', { match });
    this.clearTurnTimer(payload.matchId);

    return {
      ok: true,
      matchId: match.id,
    };
  }

  private getMatchRoom(matchId: string): string {
    return `match:${matchId}`;
  }

  private async emitMatchPresence(matchId: string) {
    const activePlayerIds = await this.realtimeState.getActivePlayers(matchId);
    this.server.to(this.getMatchRoom(matchId)).emit('match:presence', {
      matchId,
      activePlayerIds,
    });
  }

  private scheduleDisconnectGrace(matchId: string, userId: string) {
    setTimeout(() => {
      void this.finishIfStillDisconnected(matchId, userId);
    }, this.realtimeState.disconnectGraceSeconds * 1000);
  }

  private async finishIfStillDisconnected(matchId: string, userId: string) {
    if (!(await this.realtimeState.isStillDisconnected(matchId, userId))) {
      return;
    }

    try {
      const match = await this.matchesService.abandonMatch(matchId, userId);
      this.server.to(this.getMatchRoom(matchId)).emit('match:abandoned', {
        match,
      });
      this.clearTurnTimer(matchId);
    } catch (error) {
      this.logger.warn(
        `Failed to finish disconnected match ${matchId}: ${(error as Error).message}`,
      );
    }
  }

  private async scheduleTurnTimer(matchId: string, reset: boolean) {
    this.clearTurnTimer(matchId);
    const existingDeadline = reset
      ? null
      : await this.realtimeState.getTurnDeadline(matchId);
    const deadline =
      existingDeadline ?? (await this.realtimeState.setTurnDeadline(matchId));
    this.server.to(this.getMatchRoom(matchId)).emit('match:turn-deadline', {
      matchId,
      deadline,
    });

    const delayMs = Math.max(deadline - Date.now(), 0);
    const timer = setTimeout(() => {
      void this.finishTimedOutTurn(matchId, deadline);
    }, delayMs);
    this.turnTimers.set(matchId, timer);
  }

  private async finishTimedOutTurn(matchId: string, expectedDeadline: number) {
    const currentDeadline = await this.realtimeState.getTurnDeadline(matchId);
    if (currentDeadline !== expectedDeadline) {
      return;
    }

    try {
      const match = await this.matchesService.timeoutCurrentTurn(matchId);
      if (!match) {
        return;
      }

      this.server.to(this.getMatchRoom(matchId)).emit('match:turn-timeout', {
        matchId,
        match,
      });
      if (this.isActiveMatch(match)) {
        await this.scheduleTurnTimer(matchId, true);
      } else {
        this.clearTurnTimer(matchId);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to apply turn timeout for ${matchId}: ${(error as Error).message}`,
      );
    }
  }

  private clearTurnTimer(matchId: string) {
    const timer = this.turnTimers.get(matchId);
    if (timer) {
      clearTimeout(timer);
      this.turnTimers.delete(matchId);
    }
  }

  private isActiveMatch(match: unknown): match is { status: string } {
    return (
      typeof match === 'object' &&
      match !== null &&
      'status' in match &&
      match.status === 'ACTIVE'
    );
  }

  private extractToken(client: AuthenticatedSocket): string | null {
    const auth = client.handshake.auth as unknown;
    const authToken =
      auth && typeof auth === 'object' && 'token' in auth
        ? auth.token
        : undefined;

    if (typeof authToken === 'string' && authToken.trim().length > 0) {
      return authToken;
    }

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice(7);
    }

    return null;
  }
}
