import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { MatchmakingModule } from './modules/matchmaking/matchmaking.module';
import { MatchesModule } from './modules/matches/matches.module';
import { ProfileModule } from './modules/profile/profile.module';
import { WsModule } from './modules/ws/ws.module';
import { RedisModule } from './redis/redis.service';
import { InvitesModule } from './modules/invites/invites.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RedisModule,
    PrismaModule,
    AuthModule,
    MatchmakingModule,
    MatchesModule,
    ProfileModule,
    InvitesModule,
    WsModule,
  ],
})
export class AppModule {}
