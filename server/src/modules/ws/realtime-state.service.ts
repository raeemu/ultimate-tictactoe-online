import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

const PRESENCE_TTL_SECONDS = 60;
const DISCONNECT_GRACE_SECONDS = 60;
const TURN_SECONDS = 60;

@Injectable()
export class RealtimeStateService {
  constructor(private readonly redisService: RedisService) {}

  async touchUser(user: { id: string; username: string }) {
    await this.redis.set(
      this.presenceKey(user.id),
      JSON.stringify({
        id: user.id,
        username: user.username,
        seenAt: new Date().toISOString(),
      }),
      'EX',
      PRESENCE_TTL_SECONDS,
    );
  }

  async isOnline(userId: string) {
    return (await this.redis.exists(this.presenceKey(userId))) === 1;
  }

  async joinMatch(matchId: string, userId: string) {
    await Promise.all([
      this.redis.sadd(this.activePlayersKey(matchId), userId),
      this.redis.del(this.disconnectKey(matchId, userId)),
    ]);
  }

  async leaveMatch(matchId: string, userId: string) {
    await this.redis.srem(this.activePlayersKey(matchId), userId);
  }

  async getActivePlayers(matchId: string) {
    return this.redis.smembers(this.activePlayersKey(matchId));
  }

  async markDisconnected(matchId: string, userId: string) {
    await Promise.all([
      this.leaveMatch(matchId, userId),
      this.redis.set(
        this.disconnectKey(matchId, userId),
        '1',
        'EX',
        DISCONNECT_GRACE_SECONDS,
      ),
    ]);
  }

  async isStillDisconnected(matchId: string, userId: string) {
    return (await this.redis.exists(this.disconnectKey(matchId, userId))) === 1;
  }

  async setTurnDeadline(matchId: string) {
    const deadline = Date.now() + TURN_SECONDS * 1000;
    await this.redis.set(
      this.turnDeadlineKey(matchId),
      String(deadline),
      'EX',
      TURN_SECONDS + 5,
    );

    return deadline;
  }

  async getTurnDeadline(matchId: string) {
    const deadline = await this.redis.get(this.turnDeadlineKey(matchId));
    return deadline ? Number(deadline) : null;
  }

  get disconnectGraceSeconds() {
    return DISCONNECT_GRACE_SECONDS;
  }

  get turnSeconds() {
    return TURN_SECONDS;
  }

  private get redis() {
    return this.redisService.client;
  }

  private presenceKey(userId: string) {
    return `presence:user:${userId}`;
  }

  private activePlayersKey(matchId: string) {
    return `match:${matchId}:active_players`;
  }

  private disconnectKey(matchId: string, userId: string) {
    return `match:${matchId}:disconnect:${userId}`;
  }

  private turnDeadlineKey(matchId: string) {
    return `match:${matchId}:turn_deadline`;
  }
}
