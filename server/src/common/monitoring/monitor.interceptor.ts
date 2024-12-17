import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class MonitoringInterceptor implements NestInterceptor {
  private readonly logger = new Logger('APIMonitoring');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, path, ip, headers } = request;
    const userAgent = headers['user-agent'] || 'unknown';
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const endTime = Date.now();
          const duration = endTime - startTime;

          this.logger.log({
            type: 'API_CALL',
            method,
            path,
            duration: `${duration}ms`,
            ip,
            userAgent,
            userId: request.user?.id,
            statusCode: context.switchToHttp().getResponse().statusCode,
            timestamp: new Date().toISOString(),
          });
        },
        error: (error: Error) => {
          const endTime = Date.now();
          const duration = endTime - startTime;

          this.logger.error({
            type: 'API_ERROR',
            method,
            path,
            duration: `${duration}ms`,
            ip,
            userAgent,
            userId: request.user?.id,
            error: {
              name: error.name,
              message: error.message,
              stack: error.stack,
            },
            timestamp: new Date().toISOString(),
          });
        },
      }),
    );
  }
}
