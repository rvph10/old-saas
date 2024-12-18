'use client';

import { useEffect } from 'react';
import { logger } from '@/lib/logger';

export function LoggerInitializer() {
  useEffect(() => {
    return logger.initialize();
  }, []);

  return null;
}