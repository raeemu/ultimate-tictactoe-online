import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from '../infrastructure/persistence/prisma/prisma.module';
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
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
