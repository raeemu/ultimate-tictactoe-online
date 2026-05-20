import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MatchesModule } from '../matches/matches.module';
import { WsGateway } from './ws.gateway';

@Module({
  imports: [ConfigModule, JwtModule, MatchesModule],
  providers: [WsGateway],
})
export class WsModule {}
