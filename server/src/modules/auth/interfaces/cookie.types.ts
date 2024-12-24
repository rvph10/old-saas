import { CookieOptions } from 'express';

export interface AuthCookieConfig {
  readonly accessTokenOptions: CookieOptions;
  readonly refreshTokenOptions: CookieOptions;
  readonly defaultOptions: CookieOptions;
}
