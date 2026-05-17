import { Injectable } from '@nestjs/common';
import { MatchStatus } from '@prisma/client';
import { createInitialState } from '../game-core';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MatchmakingService {
  private readonly queue: string[] = [];

  constructor(private readonly prisma: PrismaService) {}

  async joinQueue(userId: string) {
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
