import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CellValue, MatchStatus, Prisma } from '@prisma/client';
import { applyMove, GameRuleError, MoveInput, UltimateGameState } from '../game-core';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MatchesService {
  constructor(private readonly prisma: PrismaService) {}

  async getMatchSnapshotForUser(matchId: string, userId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        status: true,
        playerXId: true,
        playerOId: true,
        currentTurn: true,
        activeBoard: true,
        boardState: true,
        macroboardState: true,
        winnerId: true,
        finishedAt: true,
        updatedAt: true,
      },
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    if (match.playerXId !== userId && match.playerOId !== userId) {
      throw new ForbiddenException('User is not a participant of this match');
    }

    return match;
  }

  async createMove(matchId: string, userId: string, move: MoveInput) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Match" WHERE id = ${matchId} FOR UPDATE`;

        const match = await tx.match.findUnique({
          where: { id: matchId },
          select: {
            id: true,
            status: true,
            playerXId: true,
            playerOId: true,
            currentTurn: true,
            activeBoard: true,
            boardState: true,
            macroboardState: true,
            winnerId: true,
            moves: {
              orderBy: { moveNumber: 'desc' },
              take: 1,
              select: { moveNumber: true },
            },
          },
        });

        if (!match) {
          throw new NotFoundException('Match not found');
        }

        if (match.status !== MatchStatus.ACTIVE) {
          throw new BadRequestException('Match is not active');
        }

        const playerSymbol = this.resolvePlayerSymbol(match.playerXId, match.playerOId, userId);
        if (!playerSymbol) {
          throw new ForbiddenException('User is not a participant of this match');
        }

        const currentState: UltimateGameState = {
          cells: match.boardState as UltimateGameState['cells'],
          miniBoards: match.macroboardState as UltimateGameState['miniBoards'],
          activeBoard: match.activeBoard,
          currentTurn: match.currentTurn as 'X' | 'O',
          status: 'ONGOING',
          winner:
            match.winnerId === match.playerXId
              ? 'X'
              : match.winnerId === match.playerOId
                ? 'O'
                : null,
          moveCount: match.moves[0]?.moveNumber ?? 0,
        };

        let nextState: UltimateGameState;
        try {
          nextState = applyMove(currentState, move, playerSymbol);
        } catch (error) {
          if (error instanceof GameRuleError) {
            throw new BadRequestException(error.message);
          }

          throw error;
        }

        const moveNumber = (match.moves[0]?.moveNumber ?? 0) + 1;
        const { globalRow, globalCol } = this.toGlobalCoordinates(move.localBoard, move.localCell);

        const winnerId = nextState.winner === 'X'
          ? match.playerXId
          : nextState.winner === 'O'
            ? match.playerOId
            : null;

        const updatedMatch = await tx.match.update({
          where: { id: match.id },
          data: {
            status: nextState.status === 'FINISHED' ? MatchStatus.FINISHED : MatchStatus.ACTIVE,
            currentTurn: nextState.currentTurn as CellValue,
            activeBoard: nextState.activeBoard,
            boardState: nextState.cells,
            macroboardState: nextState.miniBoards,
            winnerId,
            finishedAt: nextState.status === 'FINISHED' ? new Date() : null,
          },
          select: {
            id: true,
            status: true,
            playerXId: true,
            playerOId: true,
            currentTurn: true,
            activeBoard: true,
            winnerId: true,
            finishedAt: true,
            updatedAt: true,
          },
        });

        const createdMove = await tx.move.create({
          data: {
            matchId: match.id,
            userId,
            moveNumber,
            localBoard: move.localBoard,
            localCell: move.localCell,
            globalRow,
            globalCol,
            symbol: playerSymbol,
          },
          select: {
            id: true,
            matchId: true,
            userId: true,
            moveNumber: true,
            localBoard: true,
            localCell: true,
            globalRow: true,
            globalCol: true,
            symbol: true,
            createdAt: true,
          },
        });

        return {
          match: updatedMatch,
          move: createdMove,
        };
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2034') {
          throw new ConflictException('Move conflict, retry request');
        }

        if (error.code === 'P2002') {
          throw new ConflictException('Duplicate move conflict, retry request');
        }
      }

      throw error;
    }
  }

  private resolvePlayerSymbol(
    playerXId: string,
    playerOId: string | null,
    userId: string,
  ): 'X' | 'O' | null {
    if (playerXId === userId) {
      return 'X';
    }

    if (playerOId === userId) {
      return 'O';
    }

    return null;
  }

  private toGlobalCoordinates(localBoard: number, localCell: number) {
    const boardRow = Math.floor(localBoard / 3);
    const boardCol = localBoard % 3;
    const cellRow = Math.floor(localCell / 3);
    const cellCol = localCell % 3;

    return {
      globalRow: boardRow * 3 + cellRow,
      globalCol: boardCol * 3 + cellCol,
    };
  }
}
