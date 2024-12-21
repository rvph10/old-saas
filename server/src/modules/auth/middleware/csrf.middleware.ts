import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request & { cookies: any }, res: Response, next: NextFunction) {
    // Generate CSRF token if not exists
    if (!req.cookies['XSRF-TOKEN']) {
      const csrfToken = crypto.randomBytes(32).toString('hex');
      res.cookie('XSRF-TOKEN', csrfToken, {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });
    }

    // Verify CSRF token for non-GET requests
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const csrfToken = req.cookies['XSRF-TOKEN'];
      const headerToken = req.headers['x-xsrf-token'];

      if (!csrfToken || !headerToken || csrfToken !== headerToken) {
        throw new UnauthorizedException('Invalid CSRF token');
      }
    }

    next();
  }
}