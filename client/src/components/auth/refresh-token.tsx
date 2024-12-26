'use client';

import { useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { authApi } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';

const publicPaths = ['/', '/auth/login', '/auth/register', '/auth/verify-email', '/auth/verify-email/request'];

export function RefreshTokenHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const refreshToken = useCallback(async () => {
    if (publicPaths.includes(pathname)) return;
    
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
  }, [router, toast, pathname]);

  useEffect(() => {
    refreshToken();
    const interval = setInterval(refreshToken, 14 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refreshToken]);

  return null;
}