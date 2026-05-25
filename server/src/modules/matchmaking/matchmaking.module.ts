import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MatchmakingController } from './matchmaking.controller';
import { MatchmakingService } from './matchmaking.service';
import { RedisService } from './redis.service';

@Module({
  imports: [PrismaModule],
  controllers: [MatchmakingController],
  providers: [MatchmakingService, RedisService],
})
export class MatchmakingModule {}
