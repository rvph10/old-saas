'use client';

import { useEffect, useState } from 'react';
import { ConnectionStatus } from '../connection-status';

export function OfflineWrapper({ children }: { children: React.ReactNode }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null;
  }

  return (
    <>
      {children}
      <ConnectionStatus />
    </>
  );
}
