import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MatchStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const RATING_DELTA = 25;
const HISTORY_PAGE_SIZE = 20;

type StatsMatch = {
  status: MatchStatus;
  winnerId: string | null;
  abandonedById: string | null;
};

type ProfileMatch = {
  id: string;
  status: MatchStatus;
  playerXId: string;
  playerOId: string | null;
  winnerId: string | null;
  abandonedById: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  playerX: { id: string; username: string };
  playerO: { id: string; username: string } | null;
  winner: { id: string; username: string } | null;
  abandonedBy: { id: string; username: string } | null;
  _count: { moves: number };
};

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyProfile(userId: string, offsetParam?: string) {
    const offset = this.parseOffset(offsetParam);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        rating: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [statMatches, recentMatches] = await Promise.all([
      this.prisma.match.findMany({
        where: {
          OR: [
            { playerXId: userId },
            { playerOId: userId },
          ],
        },
        select: {
          status: true,
          winnerId: true,
          abandonedById: true,
        },
      }),
      this.prisma.match.findMany({
        where: {
          OR: [
            { playerXId: userId },
            { playerOId: userId },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        skip: offset,
        take: HISTORY_PAGE_SIZE + 1,
        select: {
          id: true,
          status: true,
          playerXId: true,
          playerOId: true,
          winnerId: true,
          abandonedById: true,
          startedAt: true,
          finishedAt: true,
          createdAt: true,
          updatedAt: true,
          playerX: {
            select: {
              id: true,
              username: true,
            },
          },
          playerO: {
            select: {
              id: true,
              username: true,
            },
          },
          winner: {
            select: {
              id: true,
              username: true,
            },
          },
          abandonedBy: {
            select: {
              id: true,
              username: true,
            },
          },
          _count: {
            select: {
              moves: true,
            },
          },
        },
      }),
    ]);

    const historyItems = recentMatches
      .slice(0, HISTORY_PAGE_SIZE)
      .map((match) => this.toHistoryItem(match, userId));

    return {
      user,
      stats: this.buildStats(statMatches, userId),
      recentMatches: historyItems,
      history: {
        limit: HISTORY_PAGE_SIZE,
        offset,
        nextOffset: offset + historyItems.length,
        hasMore: recentMatches.length > HISTORY_PAGE_SIZE,
      },
    };
  }

  private buildStats(matches: StatsMatch[], userId: string) {
    const resolved = matches.filter((match) => (
      match.status === MatchStatus.FINISHED || match.status === MatchStatus.ABANDONED
    ));

    return {
      total: matches.length,
      active: matches.filter((match) => match.status === MatchStatus.ACTIVE).length,
      wins: resolved.filter((match) => match.winnerId === userId).length,
      losses: resolved.filter((match) => match.winnerId && match.winnerId !== userId).length,
      draws: matches.filter((match) => (
        match.status === MatchStatus.FINISHED && !match.winnerId
      )).length,
      abandoned: matches.filter((match) => match.abandonedById === userId).length,
    };
  }

  private toHistoryItem(match: ProfileMatch, userId: string) {
    const playerSymbol = match.playerXId === userId ? 'X' : 'O';
    const opponent = match.playerXId === userId ? match.playerO : match.playerX;
    const result = this.resolveResult(match, userId);

    return {
      id: match.id,
      status: match.status,
      result,
      ratingDelta: this.resolveRatingDelta(result, match, userId),
      playerSymbol,
      opponent: opponent
        ? {
            id: opponent.id,
            username: opponent.username,
          }
        : null,
      winner: match.winner
        ? {
            id: match.winner.id,
            username: match.winner.username,
          }
        : null,
      abandonedBy: match.abandonedBy
        ? {
            id: match.abandonedBy.id,
            username: match.abandonedBy.username,
          }
        : null,
      movesCount: match._count.moves,
      startedAt: match.startedAt,
      finishedAt: match.finishedAt,
      updatedAt: match.updatedAt,
    };
  }

  private resolveResult(match: ProfileMatch, userId: string) {
    if (match.status === MatchStatus.ACTIVE) {
      return 'ACTIVE';
    }

    if (match.status === MatchStatus.ABANDONED) {
      return 'ABANDONED';
    }

    if (match.status === MatchStatus.FINISHED && !match.winnerId) {
      return 'DRAW';
    }

    if (match.status === MatchStatus.FINISHED && match.winnerId === userId) {
      return 'WIN';
    }

    if (match.status === MatchStatus.FINISHED) {
      return 'LOSS';
    }

    return match.status;
  }

  private resolveRatingDelta(result: string, match?: ProfileMatch, userId?: string) {
    if (match?.status === MatchStatus.ABANDONED && userId) {
      if (match.abandonedById === userId) {
        return -RATING_DELTA;
      }

      if (match.abandonedById && match.abandonedById !== userId) {
        return RATING_DELTA;
      }
    }

    if (result === 'WIN') {
      return RATING_DELTA;
    }

    if (result === 'LOSS') {
      return -RATING_DELTA;
    }

    return 0;
  }

  private parseOffset(offsetParam?: string) {
    if (!offsetParam) {
      return 0;
    }

    const offset = Number(offsetParam);
    if (!Number.isInteger(offset) || offset < 0) {
      throw new BadRequestException('Offset must be a non-negative integer');
    }

    return offset;
  }
}
