import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../infrastructure/prisma/prisma.module';
import { AuthModule } from '../modules/auth/auth.module';
import { MatchmakingModule } from '../modules/matchmaking/matchmaking.module';
import { MatchesModule } from '../modules/matches/matches.module';
import { WsModule } from '../modules/ws/ws.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    MatchmakingModule,
    MatchesModule,
    WsModule,
  ],
})
export class AppModule { }
