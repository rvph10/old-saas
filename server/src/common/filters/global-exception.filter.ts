import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
  } from '@nestjs/common';
  import { Request, Response } from 'express';
  import { AppError } from '../errors/custom-errors';
  
  @Catch()
  export class GlobalExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(GlobalExceptionFilter.name);
  
    catch(exception: Error, host: ArgumentsHost) {
      const ctx = host.switchToHttp();
      const response = ctx.getResponse<Response>();
      const request = ctx.getRequest<Request>();
  
      let status = HttpStatus.INTERNAL_SERVER_ERROR;
      let message = 'Internal server error';
      let code = 'INTERNAL_SERVER_ERROR';
      let details = null;
  
      if (exception instanceof AppError) {
        status = exception.httpStatus;
        message = exception.message;
        code = exception.code;
        details = exception.details;
      } else if (exception instanceof HttpException) {
        status = exception.getStatus();
        message = exception.message;
      }
  
      // Log the error
      this.logger.error(
        `${request.method} ${request.url}`,
        {
          error: exception,
          stack: exception.stack,
          body: request.body,
          params: request.params,
          query: request.query,
        },
      );
  
      // Send response
      response.status(status).json({
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        message,
        code,
        details,
      });
    }
  }