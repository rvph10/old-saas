type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogMessage {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: any;
}

class Logger {
  private static instance: Logger;
  private logQueue: LogMessage[] = [];
  private readonly MAX_QUEUE_SIZE = 100;
  private isInitialized = false;

  private constructor() {
    // Initialize in useEffect instead
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  initialize() {
    if (this.isInitialized) return;
    
    if (typeof window !== 'undefined') {
      const cleanup = () => this.flush();
      window.addEventListener('unload', cleanup);
      this.isInitialized = true;
      
      return () => {
        window.removeEventListener('unload', cleanup);
        this.isInitialized = false;
      };
    }
  }

  private log(level: LogLevel, message: string, data?: any) {
    const logMessage = {
      level,
      message,
      timestamp: new Date().toISOString(),
      data,
    };

    if (process.env.NODE_ENV === 'development') {
      console[level](message, data);
    }

    this.logQueue.push(logMessage);

    if (this.logQueue.length > this.MAX_QUEUE_SIZE) {
      this.logQueue.shift();
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

  private flush() {
    if (this.logQueue.length > 0) {
      // Implement your log flushing logic here
      this.logQueue = [];
    }
  }
}

export const logger = Logger.getInstance();