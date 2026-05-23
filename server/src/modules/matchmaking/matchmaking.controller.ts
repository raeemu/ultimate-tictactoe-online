import { Controller, Delete, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MatchmakingService } from './matchmaking.service';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
  };
};

@Controller('matchmaking')
@UseGuards(JwtAuthGuard)
export class MatchmakingController {
  constructor(private readonly matchmakingService: MatchmakingService) {}

  @Get('queue')
  getQueueStatus(@Req() req: AuthenticatedRequest) {
    return this.matchmakingService.getQueueStatus(req.user.id);
  }

  @Post('queue')
  joinQueue(@Req() req: AuthenticatedRequest) {
    return this.matchmakingService.joinQueue(req.user.id);
  }

  @Delete('queue')
  leaveQueue(@Req() req: AuthenticatedRequest) {
    return this.matchmakingService.leaveQueue(req.user.id);
  }
}
