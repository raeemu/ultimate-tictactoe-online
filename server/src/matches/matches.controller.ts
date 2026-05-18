import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateMoveDto } from './dto/create-move.dto';
import { MatchesService } from './matches.service';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
  };
};

@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Post(':matchId/moves')
  createMove(
    @Param('matchId') matchId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateMoveDto,
  ) {
    return this.matchesService.createMove(matchId, req.user.id, dto);
  }
}
