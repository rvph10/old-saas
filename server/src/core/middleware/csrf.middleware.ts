import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CsrfService } from 'src/modules/auth/services/csrf.service';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];
  private readonly PUBLIC_ROUTES = new Set([
    '/auth/register',
    '/auth/login',
    '/auth/verify-email',
    '/auth/verify',
    '/auth/resend-verification',
    '/auth/password-reset/request',
    '/auth/refresh',
    '/auth/csrf-token',
    '/health'
  ]);

  private skipSessionCheck(path: string): boolean {
    return this.PUBLIC_ROUTES.has(path.split('?')[0]); // Handle paths with query params
  }

  constructor(private readonly csrfService: CsrfService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const path = req.path.split('?')[0]; // Remove query parameters

    // Skip CSRF check for safe methods and public routes
    if (
      this.SAFE_METHODS.includes(req.method) ||
      this.PUBLIC_ROUTES.has(path)
    ) {
      return next();
    }

    const csrfToken = req.headers['x-csrf-token'] as string;
    const sessionId = req.headers['session-id'] as string;

    // For protected routes that require a session
    if (!this.skipSessionCheck(path)) {
      if (!sessionId) {
        throw new ForbiddenException('No session ID provided');
      }

      if (!csrfToken) {
        throw new ForbiddenException('CSRF token missing');
      }

      const isValid = await this.csrfService.validateToken(
        sessionId,
        csrfToken,
      );

      if (!isValid) {
        throw new ForbiddenException('Invalid CSRF token');
      }

      // Generate new token after successful validation
      const newToken = await this.csrfService.generateToken(sessionId);
      res.cookie('csrf_token', newToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
      });
    }

    next();
  }
}
