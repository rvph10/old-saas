import { IsString, IsNotEmpty } from 'class-validator';

export class Enable2FADto {
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class Verify2FADto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
