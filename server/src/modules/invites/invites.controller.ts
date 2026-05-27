import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateInviteDto } from './dto/create-invite.dto';
import { InvitesService } from './invites.service';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
  };
};

@Controller('invites')
@UseGuards(JwtAuthGuard)
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Get()
  getIncomingInvites(@Req() req: AuthenticatedRequest) {
    return this.invitesService.getIncomingInvites(req.user.id);
  }

  @Post()
  createInvite(@Req() req: AuthenticatedRequest, @Body() dto: CreateInviteDto) {
    return this.invitesService.createInvite(req.user.id, dto.username);
  }

  @Post(':inviteId/accept')
  acceptInvite(
    @Req() req: AuthenticatedRequest,
    @Param('inviteId') inviteId: string,
  ) {
    return this.invitesService.acceptInvite(req.user.id, inviteId);
  }

  @Delete(':inviteId')
  declineInvite(
    @Req() req: AuthenticatedRequest,
    @Param('inviteId') inviteId: string,
  ) {
    return this.invitesService.declineInvite(req.user.id, inviteId);
  }
}
