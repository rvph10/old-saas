import { IsString, IsNotEmpty } from 'class-validator';

export class VerifyEmailDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class ResendVerificationDto {
  @IsString()
  @IsNotEmpty()
  email: string;
}