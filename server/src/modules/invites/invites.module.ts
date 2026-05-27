import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../redis/redis.service';
import { InvitesController } from './invites.controller';
import { InviteEventsService } from './invite-events.service';
import { InvitesService } from './invites.service';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [InvitesController],
  providers: [InvitesService, InviteEventsService],
  exports: [InviteEventsService],
})
export class InvitesModule {}
