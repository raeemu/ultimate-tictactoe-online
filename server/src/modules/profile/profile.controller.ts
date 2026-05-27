import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProfileService } from './profile.service';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
  };
};

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('me')
  getMyProfile(
    @Req() req: AuthenticatedRequest,
    @Query('offset') offset?: string,
  ) {
    return this.profileService.getMyProfile(req.user.id, offset);
  }

  @Get('leaderboard')
  getLeaderboard() {
    return this.profileService.getLeaderboard();
  }
}
