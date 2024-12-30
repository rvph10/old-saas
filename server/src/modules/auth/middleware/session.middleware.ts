import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { SessionService } from '@modules/session/services';

@Injectable()
export class SessionMiddleware implements NestMiddleware {
  constructor(private readonly sessionService: SessionService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      const sessionId = req.headers['session-id'] as string;

      if (!sessionId) {
        return next();
      }

      const session = await this.sessionService.getSession(sessionId);
      if (!session) {
        throw new UnauthorizedException('Invalid session');
      }

      (req as any).session = session;

      next();
    } catch (error) {
      next(error);
    }
  }
}
