import {
  ConnectedSocket,
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
import { JoinMatchDto } from './dto/join-match.dto';
import { WsMoveDto } from './dto/ws-move.dto';

type SocketUser = {
  id: string;
  username: string;
};

type AuthenticatedSocket = Socket & {
  data: {
    user?: SocketUser;
  };
};

@WebSocketGateway({
  namespace: '/matches',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class WsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WsGateway.name);

  constructor(
    private readonly matchesService: MatchesService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        throw new UnauthorizedException('Missing auth token');
      }

      const payload = await this.jwtService.verifyAsync<{ sub: string; username: string }>(token, {
        secret: this.configService.get<string>('JWT_SECRET', 'dev-secret'),
      });

      client.data.user = {
        id: payload.sub,
        username: payload.username,
      };
    } catch (error) {
      this.logger.warn(`Socket rejected: ${(error as Error).message}`);
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  @SubscribeMessage('match:join')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }))
  async onJoinMatch(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: JoinMatchDto,
  ) {
    const userId = client.data.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Unauthorized');
    }

    const match = await this.matchesService.getMatchSnapshotForUser(payload.matchId, userId);
    const room = this.getMatchRoom(payload.matchId);
    await client.join(room);

    client.emit('match:joined', {
      room,
      match,
    });

    return {
      ok: true,
      room,
    };
  }

  @SubscribeMessage('match:move')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }))
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

    const result = await this.matchesService.createMove(payload.matchId, userId, {
      localBoard: payload.localBoard,
      localCell: payload.localCell,
    });

    this.server.to(room).emit('match:move', result);

    return {
      ok: true,
      moveId: result.move.id,
    };
  }

  private getMatchRoom(matchId: string): string {
    return `match:${matchId}`;
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
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
