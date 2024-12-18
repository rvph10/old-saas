type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogMessage {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: any;
}

export class Logger {
  private static instance: Logger;
  private logQueue: LogMessage[] = [];
  private readonly MAX_QUEUE_SIZE = 100;

  private constructor() {
    window.addEventListener('unload', () => this.flush());
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private log(level: LogLevel, message: string, data?: any) {
    const logMessage = {
      level,
      message,
      timestamp: new Date().toISOString(),
      data,
    };

    // Add to queue
    this.logQueue.push(logMessage);

    // Trim queue if it gets too large
    if (this.logQueue.length > this.MAX_QUEUE_SIZE) {
      this.logQueue.shift();
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console[level](message, data);
    }
  }

  debug(message: string, data?: any) {
    this.log('debug', message, data);
  }

  info(message: string, data?: any) {
    this.log('info', message, data);
  }

  warn(message: string, data?: any) {
    this.log('warn', message, data);
  }

  error(message: string, error?: Error | unknown) {
    this.log('error', message, {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : error,
    });
  }

  flush() {
    // Here you could send logs to your backend or analytics service
    if (this.logQueue.length > 0) {
      // Example: Send to backend
      // fetch('/api/logs', {
      //   method: 'POST',
      //   body: JSON.stringify(this.logQueue),
      // });
      this.logQueue = [];
    }
  }
}

export const logger = Logger.getInstance();