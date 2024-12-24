'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';

export function RefreshTokenHandler() {
  const router = useRouter();
  const { toast } = useToast();

  const refreshToken = useCallback(async () => {
    try {
      await authApi.refreshToken();
    } catch (error) {
      console.error('Token refresh failed:', error);
      toast({
        title: 'Session Expired',
        description: 'Please login again',
        variant: 'destructive',
      });
      router.push('/auth/login');
    }
  }, [router, toast]);

  useEffect(() => {
    // Initial refresh
    refreshToken();

    // Set up interval for token refresh
    const interval = setInterval(refreshToken, 14 * 60 * 1000); // 14 minutes

    return () => clearInterval(interval);
  }, [refreshToken]);

  return null;
}