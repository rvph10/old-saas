import { ConsoleLogger, Injectable } from '@nestjs/common';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

@Injectable()
export class CustomLoggerService extends ConsoleLogger {
  private winston: winston.Logger;

  constructor() {
    super();
    this.initializeWinston();
  }

  private initializeWinston() {
    const fileFormat = winston.format.combine(winston.format.json());

    this.winston = winston.createLogger({
      level: 'info',
      format: fileFormat,
      transports: [
        new winston.transports.DailyRotateFile({
          filename: 'logs/error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          maxSize: '20m',
          maxFiles: '14d',
        }),
        new winston.transports.DailyRotateFile({
          filename: 'logs/combined-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d',
        }),
      ],
    });

    if (process.env.NODE_ENV !== 'production') {
      this.winston.add(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
          ),
        }),
      );
    }
  }

  log(message: any, context?: string) {
    this.winston.info(message, { context });
    super.log(message, context);
  }

  error(message: any, stack?: string, context?: string) {
    this.winston.error(message, { stack, context });
    super.error(message, stack, context);
  }

  warn(message: any, context?: string) {
    this.winston.warn(message, { context });
    super.warn(message, context);
  }

  debug(message: any, context?: string) {
    this.winston.debug(message, { context });
    super.debug(message, context);
  }

  verbose(message: any, context?: string) {
    this.winston.verbose(message, { context });
    super.verbose(message, context);
  }
}
