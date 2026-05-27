import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateInviteDto {
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  username!: string;
}
