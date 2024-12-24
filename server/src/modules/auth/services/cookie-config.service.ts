import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthCookieConfig } from '../interfaces/cookie.types';
import { CookieOptions } from 'express';

@Injectable()
export class CookieConfigService {
  private readonly config: AuthCookieConfig;

  constructor(private readonly configService: ConfigService) {
    const isProduction = configService.get('NODE_ENV') === 'production';

    const defaultOptions: CookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      domain: configService.get('COOKIE_DOMAIN'),
      path: '/',
    };

    this.config = {
      defaultOptions,
      accessTokenOptions: {
        ...defaultOptions,
        maxAge: 15 * 60 * 1000, // 15 minutes
      },
      refreshTokenOptions: {
        ...defaultOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/auth/refresh', // Restrict refresh token to refresh endpoint
      },
    };
  }

  get accessTokenOptions(): CookieOptions {
    return this.config.accessTokenOptions;
  }

  get refreshTokenOptions(): CookieOptions {
    return this.config.refreshTokenOptions;
  }

  get defaultOptions(): CookieOptions {
    return this.config.defaultOptions;
  }
}
