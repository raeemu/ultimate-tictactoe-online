import { Module } from '@nestjs/common';
import { RedisModule } from '../../redis/redis.service';
import { LeaderboardController } from './leaderboard.controller';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [RedisModule],
  controllers: [ProfileController, LeaderboardController],
  providers: [ProfileService],
})
export class ProfileModule {}
