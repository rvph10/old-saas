import { Injectable, NestMiddleware } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { NextFunction } from 'express';
import { Request, Response } from 'express';

@Injectable()
export class RefreshTokenMiddleware implements NestMiddleware {
  constructor(private authService: AuthService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const accessToken = req.cookies['access_token'];
    const refreshToken = req.cookies['refresh_token'];

    if (!accessToken && refreshToken) {
      try {
        await this.authService.refreshTokens(refreshToken, res);
      } catch (error) {
        // Token refresh failed, continue to next middleware
        console.error('Token refresh failed:', error);
      }
    }

    next();
  }
}
