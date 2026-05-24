import { Injectable } from '@nestjs/common';
import { MatchStatus } from '@prisma/client';
import { createInitialState } from '../../game';
import { PrismaService } from '../../prisma/prisma.service';

type MatchmakingMatch = {
  id: string;
  status: MatchStatus;
  playerXId: string;
  playerOId: string | null;
  currentTurn: string;
  activeBoard: number | null;
  createdAt: Date;
  startedAt: Date | null;
};

@Injectable()
export class MatchmakingService {
  private readonly queue: string[] = [];
  private readonly pendingMatches = new Map<string, MatchmakingMatch>();

  constructor(private readonly prisma: PrismaService) {}

  async getQueueStatus(userId: string) {
    const pendingMatch = this.consumePendingMatch(userId);
    if (pendingMatch) {
      return {
        status: 'MATCH_FOUND' as const,
        match: pendingMatch,
      };
    }

    return {
      status: this.queue.includes(userId) ? 'SEARCHING' as const : 'NOT_IN_QUEUE' as const,
    };
  }

  async joinQueue(userId: string) {
    const pendingMatch = this.consumePendingMatch(userId);
    if (pendingMatch) {
      return {
        status: 'MATCH_FOUND' as const,
        match: pendingMatch,
      };
    }

    const waitingOpponent = this.dequeueOpponent(userId);

    if (!waitingOpponent) {
      if (!this.queue.includes(userId)) {
        this.queue.push(userId);
      }

      return {
        status: 'SEARCHING' as const,
      };
    }

    const initial = createInitialState();
    const match = await this.prisma.match.create({
      data: {
        status: MatchStatus.ACTIVE,
        playerXId: waitingOpponent,
        playerOId: userId,
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

    this.pendingMatches.set(waitingOpponent, match);

    return {
      status: 'MATCH_FOUND' as const,
      match,
    };
  }

  leaveQueue(userId: string) {
    const before = this.queue.length;
    this.removeFromQueue(userId);

    return {
      status: before === this.queue.length ? 'NOT_IN_QUEUE' : 'LEFT_QUEUE',
    };
  }

  getQueueSize() {
    return this.queue.length;
  }

  private consumePendingMatch(userId: string): MatchmakingMatch | null {
    const match = this.pendingMatches.get(userId);
    if (!match) {
      return null;
    }

    this.pendingMatches.delete(userId);
    this.removeFromQueue(userId);
    return match;
  }

  private dequeueOpponent(userId: string): string | null {
    while (this.queue.length > 0) {
      const opponentId = this.queue.shift();
      if (opponentId && opponentId !== userId) {
        return opponentId;
      }
    }

    return null;
  }

  private removeFromQueue(userId: string) {
    const index = this.queue.indexOf(userId);
    if (index >= 0) {
      this.queue.splice(index, 1);
    }
  }
}
