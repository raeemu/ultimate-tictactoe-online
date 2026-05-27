import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class WsMoveDto {
  @IsUUID()
  matchId!: string;

  @IsInt()
  @Min(0)
  @Max(8)
  localBoard!: number;

  @IsInt()
  @Min(0)
  @Max(8)
  localCell!: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  clientMoveId?: string;
}
