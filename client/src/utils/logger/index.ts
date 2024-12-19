type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LoggerOptions {
  timestamp?: boolean;
  level?: LogLevel;
}

class Logger {
  private static instance: Logger;
  private isDevelopment: boolean;

  private constructor() {
    // Check if window is defined to ensure we're on client side
    this.isDevelopment =
      typeof window !== 'undefined' && process.env.NODE_ENV === 'development';
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatMessage(
    message: string,
    level: LogLevel,
    options?: LoggerOptions,
  ): string {
    const timestamp = options?.timestamp ? `[${new Date().toISOString()}]` : '';
    return `${timestamp} [${level.toUpperCase()}] ${message}`;
  }

  private log(
    level: LogLevel,
    message: string | Error,
    options?: LoggerOptions,
  ) {
    // Early return if we're not in browser or not in development
    if (!this.isDevelopment || typeof window === 'undefined') return;

    const formattedMessage = this.formatMessage(
      message instanceof Error ? message.message : message,
      level,
      options,
    );

    switch (level) {
      case 'info':
        console.info(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'error':
        console.error(formattedMessage);
        if (message instanceof Error) {
          console.error(message.stack);
        }
        break;
      case 'debug':
        console.debug(formattedMessage);
        break;
    }
  }

  info(message: string, options?: LoggerOptions) {
    this.log('info', message, options);
  }

  warn(message: string, options?: LoggerOptions) {
    this.log('warn', message, options);
  }

  error(message: string | Error, options?: LoggerOptions) {
    this.log('error', message, options);
  }

  debug(message: string, options?: LoggerOptions) {
    this.log('debug', message, options);
  }

  group(label: string, fn: () => void) {
    if (!this.isDevelopment || typeof window === 'undefined') return;
    console.group(label);
    fn();
    console.groupEnd();
  }
}

export const logger = Logger.getInstance();
