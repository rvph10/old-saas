import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { CsrfService } from '../services/csrf.service';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CsrfMiddleware.name);
  private readonly PUBLIC_PATHS = new Set([
    '/auth/register',
    '/auth/login',
    '/auth/verify-email',
    '/auth/verify',
    '/auth/resend-verification',
    '/auth/password-reset/request',
    '/auth/csrf-token',
    '/health',
  ]);

  private readonly SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

  constructor(
    private readonly csrfService: CsrfService,
    private readonly configService: ConfigService,
  ) {}

  private isPublicPath(path: string): boolean {
    const normalizedPath = path.toLowerCase();
    return Array.from(this.PUBLIC_PATHS).some((publicPath) =>
      normalizedPath.startsWith(publicPath.toLowerCase()),
    );
  }

  private isSafeMethod(method: string): boolean {
    return this.SAFE_METHODS.has(method.toUpperCase());
  }

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      // Skip CSRF check for safe methods and public paths
      if (this.isSafeMethod(req.method) || this.isPublicPath(req.path)) {
        return next();
      }

      const csrfToken = req.headers['x-csrf-token'] as string;
      const sessionId = req.headers['session-id'] as string;

      // Only check CSRF for authenticated routes
      if (!this.isPublicPath(req.path)) {
        if (!sessionId) {
          throw new UnauthorizedException('No session ID provided');
        }

        if (!csrfToken) {
          throw new UnauthorizedException('CSRF token missing');
        }

        const isValid = await this.csrfService.validateToken(
          sessionId,
          csrfToken,
        );

        if (!isValid) {
          this.logger.warn(
            `Invalid CSRF token detected for session ${sessionId}`,
          );
          throw new UnauthorizedException('Invalid CSRF token');
        }

        // Generate new token after successful validation for enhanced security
        const newToken = await this.csrfService.generateToken(sessionId);

        // Set cookie with appropriate security flags
        res.cookie('csrf_token', newToken, {
          httpOnly: false, // Needs to be false so JS can read it
          secure: this.configService.get('NODE_ENV') === 'production',
          sameSite: 'strict',
          path: '/',
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
        });
      }

      next();
    } catch (error) {
      this.logger.error(`CSRF check failed: ${error.message}`, error.stack);
      throw error;
    }
  }
}
