import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MatchesModule } from '../matches/matches.module';
import { RedisModule } from '../../redis/redis.service';
import { InvitesModule } from '../invites/invites.module';
import { RealtimeStateService } from './realtime-state.service';
import { WsGateway } from './ws.gateway';

@Module({
  imports: [ConfigModule, JwtModule, MatchesModule, RedisModule, InvitesModule],
  providers: [WsGateway, RealtimeStateService],
})
export class WsModule {}
