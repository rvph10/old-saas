import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class ErrorHandlingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ErrorHandlingMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const cleanup = () => {
      res.removeListener('close', cleanup);
      res.removeListener('error', cleanup);
    };

    res.on('close', cleanup);
    res.on('error', (err) => {
      cleanup();
      this.logger.error('Response error:', err);
    });

    try {
      next();
    } catch (err) {
      cleanup();
      next(err);
    }
  }
}