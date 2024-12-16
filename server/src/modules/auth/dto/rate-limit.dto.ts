import { IsNumber, IsString, IsOptional } from 'class-validator';

export class RateLimitConfigDto {
  @IsNumber()
  limit: number;

  @IsNumber()
  windowSize: number;

  @IsString()
  @IsOptional()
  errorMessage?: string;
}
