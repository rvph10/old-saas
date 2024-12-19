import { useCallback } from 'react';
import { logger } from '@/utils/logger';

export const useLogger = (component: string) => {
  const logWithComponent = useCallback(
    (level: 'info' | 'warn' | 'error' | 'debug', message: string) => {
      const componentMessage = `[${component}] ${message}`;
      logger[level](componentMessage, { timestamp: true });
    },
    [component]
  );

  return {
    info: (message: string) => logWithComponent('info', message),
    warn: (message: string) => logWithComponent('warn', message),
    error: (message: string | Error) => logger.error(message),
    debug: (message: string) => logWithComponent('debug', message),
  };
};