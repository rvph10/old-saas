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

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(@Inject(MetricsService) private metricsService: MetricsService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const timestamp = new Date().toISOString();

    let errorResponse: any;

    if (exception instanceof AppError) {
      errorResponse = this.handleAppError(exception);
    } else if (exception instanceof HttpException) {
      errorResponse = this.handleHttpException(exception);
    } else {
      errorResponse = this.handleUnknownError(exception as Error);
    }

    // Add common fields
    errorResponse = {
      ...errorResponse,
      timestamp,
      path: request.url,
      method: request.method,
    };

    // Log error
    this.logError(request, errorResponse, exception);

    // Track metrics
    this.trackErrorMetrics(errorResponse.statusCode, request.path);

    // Send response
    response.status(errorResponse.statusCode).json(errorResponse);
  }

  private handleAppError(error: AppError) {
    return {
      statusCode: error.httpStatus,
      message: error.message,
      code: error.code,
      details: error.details,
      context: error.context,
    };
  }

  private handleHttpException(exception: HttpException) {
    const response = exception.getResponse();
    const status = exception.getStatus();

    if (typeof response === 'object') {
      return {
        statusCode: status,
        ...(response as object),
      };
    }

    return {
      statusCode: status,
      message: response,
    };
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
