import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  Inject,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppError } from '../errors/custom-errors';
import { MetricsService } from '../monitoring/metrics.service';
import { ErrorResponse } from '../interfaces/error-response.interface';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(@Inject(MetricsService) private metricsService: MetricsService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let errorResponse: ErrorResponse;

    if (exception instanceof AppError) {
      errorResponse = this.handleAppError(exception);
    } else if (exception instanceof HttpException) {
      errorResponse = this.handleHttpException(exception);
    } else {
      errorResponse = {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        timestamp: new Date().toISOString(),
        details: process.env.NODE_ENV === 'development' ? 
          { error: exception instanceof Error ? exception.message : 'Unknown error' } : 
          undefined
      };
    }

    errorResponse.path = request.url;

    // Log error
    this.logError(request, errorResponse, exception);

    // Track metrics
    this.trackErrorMetrics(Number(errorResponse.code), request.path);

    response
      .status(this.getHttpStatus(exception))
      .json(errorResponse);
  }

  private handleAppError(error: AppError) {
    return {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message,
      details: error.details,
      timestamp: new Date().toISOString()
    };
  }

  private handleHttpException(exception: HttpException): ErrorResponse {
    const response = exception.getResponse();
    return {
      code: exception instanceof AppError ? exception.code : 'HTTP_ERROR',
      message: typeof response === 'string' ? response : (response as any).message,
      details: typeof response === 'object' ? response : undefined,
      timestamp: new Date().toISOString()
    };
  }

  private getHttpStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    if (exception instanceof AppError) {
      return exception.httpStatus || 500;
    }
    return 500;
  }

  private handleUnknownError(error: Error) {
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: error.message,
    };
  }

  private logError(
    request: Request,
    errorResponse: any,
    originalError: unknown,
  ) {
    this.logger.error(`${request.method} ${request.url}`, {
      error: errorResponse,
      stack: originalError instanceof Error ? originalError.stack : undefined,
      body: request.body,
      params: request.params,
      query: request.query,
      headers: this.sanitizeHeaders(request.headers),
    });
  }

  private sanitizeHeaders(headers: any) {
    const sanitized = { ...headers };
    delete sanitized.authorization;
    delete sanitized.cookie;
    return sanitized;
  }

  private trackErrorMetrics(statusCode: number, path: string) {
    this.metricsService.incrementCounter('errors_total', {
      status_code: statusCode,
      path: path,
    });
  }
}
