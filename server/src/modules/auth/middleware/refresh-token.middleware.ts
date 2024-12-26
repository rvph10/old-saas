import { Injectable, NestMiddleware } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { NextFunction } from 'express';
import { Request, Response } from 'express';

@Injectable()
export class RefreshTokenMiddleware implements NestMiddleware {
  constructor(private authService: AuthService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Skip for specific routes
    if (
      req.path.includes('/auth/register') ||
      req.path.includes('/auth/login') ||
      req.path.includes('/auth/password-reset') ||
      req.path.includes('/auth/verify-email')
    ) {
      return next();
    }

    try {
      const cookies = req.cookies || {};
      const accessToken = cookies['access_token'];
      const refreshToken = cookies['refresh_token'];

      if (!accessToken && refreshToken) {
        await this.authService.refreshToken(refreshToken, res);
      }
    } catch (error) {
      // Log error but don't block the request
      console.error('Token refresh failed:', error);
    }

    next();
  }
}
