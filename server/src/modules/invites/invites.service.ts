import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MatchStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createInitialState } from '../../game';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { InviteEventsService } from './invite-events.service';

const INVITE_TTL_SECONDS = 2 * 60;

type InvitePayload = {
  id: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
  createdAt: string;
};

type AcceptedInvitePayload = {
  inviteId: string;
  matchId: string;
  acceptedByUsername: string;
  acceptedAt: string;
};

type DeclinedInvitePayload = {
  inviteId: string;
  declinedByUsername: string;
  declinedAt: string;
};

@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly inviteEvents: InviteEventsService,
  ) {}

  async createInvite(fromUserId: string, toUsername: string) {
    const [fromUser, toUser] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: fromUserId },
        select: { id: true, username: true },
      }),
      this.prisma.user.findUnique({
        where: { username: toUsername },
        select: { id: true, username: true },
      }),
    ]);

    if (!fromUser) {
      throw new NotFoundException('User not found');
    }

    if (!toUser) {
      throw new NotFoundException('Invited user not found');
    }

    if (fromUser.id === toUser.id) {
      throw new BadRequestException('Cannot invite yourself');
    }

    const invite: InvitePayload = {
      id: randomUUID(),
      fromUserId: fromUser.id,
      fromUsername: fromUser.username,
      toUserId: toUser.id,
      toUsername: toUser.username,
      createdAt: new Date().toISOString(),
    };

    await Promise.all([
      this.redis.set(
        this.inviteKey(invite.id),
        JSON.stringify(invite),
        'EX',
        INVITE_TTL_SECONDS,
      ),
      this.redis.sadd(this.userInvitesKey(toUser.id), invite.id),
      this.redis.expire(this.userInvitesKey(toUser.id), INVITE_TTL_SECONDS),
    ]);
    this.inviteEvents.emitReceived(toUser.id, invite);

    return invite;
  }

  async getIncomingInvites(userId: string) {
    const inviteIds = await this.redis.smembers(this.userInvitesKey(userId));
    const invites: InvitePayload[] = [];

    for (const inviteId of inviteIds) {
      const rawInvite = await this.redis.get(this.inviteKey(inviteId));
      if (!rawInvite) {
        await this.redis.srem(this.userInvitesKey(userId), inviteId);
        continue;
      }

      invites.push(JSON.parse(rawInvite) as InvitePayload);
    }

    const [acceptedMatch, declinedInvite] = await Promise.all([
      this.consumeAcceptedInvite(userId),
      this.consumeDeclinedInvite(userId),
    ]);

    return { acceptedMatch, declinedInvite, invites };
  }

  async acceptInvite(userId: string, inviteId: string) {
    const invite = await this.getInvite(inviteId);
    if (invite.toUserId !== userId) {
      throw new ForbiddenException('Invite belongs to another user');
    }

    const initial = createInitialState();
    const match = await this.prisma.match.create({
      data: {
        status: MatchStatus.ACTIVE,
        playerXId: invite.fromUserId,
        playerOId: invite.toUserId,
        currentTurn: initial.currentTurn,
        activeBoard: initial.activeBoard,
        boardState: initial.cells,
        macroboardState: initial.miniBoards,
        startedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        playerXId: true,
        playerOId: true,
        currentTurn: true,
        activeBoard: true,
        createdAt: true,
        startedAt: true,
      },
    });

    await Promise.all([
      this.setAcceptedInvite(invite.fromUserId, {
        inviteId: invite.id,
        matchId: match.id,
        acceptedByUsername: invite.toUsername,
        acceptedAt: new Date().toISOString(),
      }),
      this.deleteInvite(invite),
    ]);
    this.inviteEvents.emitAccepted(invite.fromUserId, {
      inviteId: invite.id,
      matchId: match.id,
    });
    this.inviteEvents.emitCanceled(invite.toUserId, {
      inviteId: invite.id,
    });

    return { match };
  }

  async declineInvite(userId: string, inviteId: string) {
    const invite = await this.getInvite(inviteId);
    if (invite.toUserId !== userId && invite.fromUserId !== userId) {
      throw new ForbiddenException('Invite belongs to another user');
    }

    if (invite.toUserId === userId) {
      await Promise.all([
        this.setDeclinedInvite(invite.fromUserId, {
          inviteId: invite.id,
          declinedByUsername: invite.toUsername,
          declinedAt: new Date().toISOString(),
        }),
        this.deleteInvite(invite),
      ]);
      this.inviteEvents.emitDeclined(invite.fromUserId, {
        inviteId: invite.id,
      });
    } else {
      await this.deleteInvite(invite);
      this.inviteEvents.emitCanceled(invite.toUserId, {
        inviteId: invite.id,
      });
    }

    return { status: 'DECLINED' as const };
  }

  private async getInvite(inviteId: string) {
    const rawInvite = await this.redis.get(this.inviteKey(inviteId));
    if (!rawInvite) {
      throw new NotFoundException('Invite not found or expired');
    }

    return JSON.parse(rawInvite) as InvitePayload;
  }

  private async deleteInvite(invite: InvitePayload) {
    await Promise.all([
      this.redis.del(this.inviteKey(invite.id)),
      this.redis.srem(this.userInvitesKey(invite.toUserId), invite.id),
    ]);
  }

  private async setAcceptedInvite(
    userId: string,
    payload: AcceptedInvitePayload,
  ) {
    await this.redis.set(
      this.acceptedInviteKey(userId),
      JSON.stringify(payload),
      'EX',
      INVITE_TTL_SECONDS,
    );
  }

  private async setDeclinedInvite(
    userId: string,
    payload: DeclinedInvitePayload,
  ) {
    await this.redis.set(
      this.declinedInviteKey(userId),
      JSON.stringify(payload),
      'EX',
      INVITE_TTL_SECONDS,
    );
  }

  private async consumeAcceptedInvite(userId: string) {
    const rawPayload = await this.redis.call(
      'GETDEL',
      this.acceptedInviteKey(userId),
    );

    if (!rawPayload || typeof rawPayload !== 'string') {
      return null;
    }

    return JSON.parse(rawPayload) as AcceptedInvitePayload;
  }

  private async consumeDeclinedInvite(userId: string) {
    const rawPayload = await this.redis.call(
      'GETDEL',
      this.declinedInviteKey(userId),
    );

    if (!rawPayload || typeof rawPayload !== 'string') {
      return null;
    }

    return JSON.parse(rawPayload) as DeclinedInvitePayload;
  }

  private get redis() {
    return this.redisService.client;
  }

  private inviteKey(inviteId: string) {
    return `invite:${inviteId}`;
  }

  private userInvitesKey(userId: string) {
    return `invites:user:${userId}`;
  }

  private acceptedInviteKey(userId: string) {
    return `invites:accepted:${userId}`;
  }

  private declinedInviteKey(userId: string) {
    return `invites:declined:${userId}`;
  }
}
