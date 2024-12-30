'use client';

import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from './ui/alert';
import { AlertCircle } from 'lucide-react';
import { Button } from './ui/button';

export function ConnectionStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [isServerAvailable, setIsServerAvailable] = useState(true);

  useEffect(() => {
    // Check browser online status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check server availability
    const checkServer = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/health`,
        );
        setIsServerAvailable(response.ok);
      } catch {
        setIsServerAvailable(false);
      }
    };

    const interval = setInterval(checkServer, 30000); // Check every 30 seconds
    checkServer(); // Initial check

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  if (!isOnline || !isServerAvailable) {
    return (
      <Alert
        variant="destructive"
        className="fixed bottom-4 right-4 w-auto max-w-md"
      >
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {!isOnline ? (
            'You are offline. Please check your internet connection.'
          ) : (
            <>
              Unable to connect to server.
              <Button
                variant="link"
                onClick={() => window.location.reload()}
                className="h-auto px-2"
              >
                Retry
              </Button>
            </>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
