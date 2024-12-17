import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { SessionService } from '../services/session.service';

@Injectable()
export class SessionMiddleware implements NestMiddleware {
  constructor(private readonly sessionService: SessionService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const sessionId = req.headers['session-id'] as string;

    if (!sessionId) {
      return next();
    }

    const session = await this.sessionService.getSession(sessionId);
    if (!session) {
      throw new UnauthorizedException('Invalid session');
    }

    req['session'] = session;
    next();
  }
}
