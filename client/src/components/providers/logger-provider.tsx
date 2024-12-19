'use client';

import { useLogger } from '@/hooks/useLogger';
import { useEffect } from 'react';

export function LoggerProvider({
  children,
  componentName,
}: {
  children: React.ReactNode;
  componentName: string;
}) {
  const logger = useLogger(componentName);

  useEffect(() => {
    logger.info('Component mounted');
    return () => {
      logger.info('Component unmounted');
    };
  }, [logger]);

  return <>{children}</>;
}
