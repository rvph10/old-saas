import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CsrfService } from 'src/modules/auth/services/csrf.service';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];
  
  constructor(private readonly csrfService: CsrfService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Skip CSRF check for safe methods
    if (this.SAFE_METHODS.includes(req.method)) {
      return next();
    }

    const csrfToken = req.headers['x-csrf-token'] as string;
    const sessionId = req.headers['session-id'] as string;

    if (!sessionId) {
      throw new ForbiddenException('No session ID provided');
    }

    if (!csrfToken) {
      throw new ForbiddenException('CSRF token missing');
    }

    const isValid = await this.csrfService.validateToken(sessionId, csrfToken);
    
    if (!isValid) {
      throw new ForbiddenException('Invalid CSRF token');
    }

    // Generate new token after successful validation (double submit cookie pattern)
    const newToken = await this.csrfService.generateToken(sessionId);
    res.cookie('csrf_token', newToken, {
      httpOnly: false, // Client needs to read this
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    next();
  }
}