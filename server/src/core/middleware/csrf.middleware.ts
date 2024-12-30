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
    '/auth/password-reset/reset',
    '/auth/refresh',
    '/auth/csrf-token',
    '/health',
  ]);

  constructor(private readonly csrfService: CsrfService) {}

  private getActualPath(req: Request): string {
    // Get the path from the '0' parameter if it exists, otherwise use req.path
    const paramPath = req.params?.[0];
    if (paramPath) {
      return `/${paramPath}`;
    }
    return req.path;
  }

  private isPublicPath(path: string): boolean {
    if (this.PUBLIC_ROUTES.has(path)) {
      return true;
    }

    // For cases where path starts with 'auth/'
    const authPath = path.startsWith('/') ? path : `/auth/${path}`;
    return this.PUBLIC_ROUTES.has(authPath);
  }

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      const actualPath = this.getActualPath(req);
      console.log('Actual Path:', actualPath);
      console.log('Method:', req.method);

      // Skip CSRF check for safe methods
      if (this.SAFE_METHODS.includes(req.method)) {
        return next();
      }

      // Check if it's a public route
      if (this.isPublicPath(actualPath)) {
        console.log('Public route detected:', actualPath);
        return next();
      }

      const csrfToken = req.headers['x-csrf-token'] as string;
      const sessionId = req.headers['session-id'] as string;

      // For protected routes, require session and CSRF token
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

      next();
    } catch (error) {
      next(error);
    }
  }
}
