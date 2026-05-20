import { IsInt, Max, Min } from 'class-validator';

export class CreateMoveDto {
  @IsInt()
  @Min(0)
  @Max(8)
  localBoard!: number;

  @IsInt()
  @Min(0)
  @Max(8)
  localCell!: number;
}
