import { IsUUID } from 'class-validator';

export class JoinMatchDto {
  @IsUUID()
  matchId!: string;
}
