import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, AuthResponse } from '@/lib/api-client';
import { useRouter } from 'next/navigation';
import { RegisterInput } from '@/lib/validations/auth';
import axios from 'axios';
import React from 'react';

const TIMEOUT_DURATION = 10000;

const timeoutPromise = (): Promise<never> => {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error('Request timeout: Server is not responding'));
    }, TIMEOUT_DURATION);
  });
};

export function useLogin() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation<AuthResponse, Error, { username: string; password: string }>({
    mutationFn: async (credentials) => {
      const result = await Promise.race<AuthResponse>([
        authApi.login(credentials),
        timeoutPromise(),
      ]);
      
      // Store sessionId if provided
      if (result.sessionId) {
        localStorage.setItem('sessionId', result.sessionId);
      }

      return result;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['user'], data.user);
      router.push('/dashboard');
    },
  });
}

export function useRegister() {
  const router = useRouter();

  return useMutation<any, Error, RegisterInput>({
    mutationFn: async (data: { email: string; username: string; confirmPassword: string; password: string; firstName?: string; lastName?: string; }) => {
      const result = await Promise.race<any>([
        authApi.register(data),
        timeoutPromise(),
      ]);
      return result;
    },
    onSuccess: () => {
      router.push('/auth/verify-email');
    },
    onError: (error: any) => {
      console.error('Register error:', error);
    },
  });
}

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: async () => {
      const sessionId = localStorage.getItem('sessionId');
      if (!sessionId) throw new Error('No active session');

      await authApi.logout();
      localStorage.removeItem('sessionId');
      
      // Clear cookies by setting expired date
      document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
      document.cookie = 'refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
      document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    },
    onSuccess: () => {
      queryClient.clear();
      router.push('/auth/login');
    },
  });
}

export function useVerifyEmail() {
  return useMutation<any, Error, string>({
    mutationFn: async (token: string) => {
      const result = await Promise.race<any>([
        authApi.verifyEmail(token),
        timeoutPromise(),
      ]);
      return result;
    },
  });
}

export function useResendVerification() {
  return useMutation<any, Error, string>({
    mutationFn: async (email: string) => {
      const result = await Promise.race<any>([
        authApi.resendVerification(email),
        timeoutPromise(),
      ]);
      return result;
    },
  });
}

export function useRequestPasswordReset() {
  return useMutation<any, Error, string>({
    mutationFn: async (email: string) => {
      const result = await Promise.race<any>([
        authApi.requestPasswordReset(email),
        timeoutPromise(),
      ]);
      return result;
    },
  });
}

export function useResetPassword() {
  const router = useRouter();

  return useMutation<any, Error, { token: string; password: string }>({
    mutationFn: async ({ token, password }: { token: string; password: string }) => {
      const result = await Promise.race<any>([
        authApi.resetPassword(token, password),
        timeoutPromise(),
      ]);
      return result;
    },
    onSuccess: () => {
      router.push('/auth/login');
    },
  });
}

export function useUser() {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      try {
        const result = await Promise.race<any>([
          authApi.getCurrentUser(),
          timeoutPromise(),
        ]);
        return result.data;
      } catch (error) {
        // If error is 401 (unauthorized), return null instead of throwing
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          return null;
        }
        throw error;
      }
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    retry: false,
  });
}

export function useUserEffect() {
  const queryClient = useQueryClient();
  const { data } = useUser();

  React.useEffect(() => {
    if (data) {
      queryClient.setQueryData(['user'], data);
    }
  }, [data, queryClient]);
}

export function useTerminateSession() {
  const queryClient = useQueryClient();

  return useMutation<any, Error, string>({
    mutationFn: async (sessionId: string) => {
      const result = await Promise.race<any>([
        authApi.terminateSession(sessionId),
        timeoutPromise(),
      ]);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

export function useLogoutAllDevices() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation<any, Error, void>({
    mutationFn: async () => {
      const result = await Promise.race<any>([
        authApi.logoutAllDevices(),
        timeoutPromise(),
      ]);
      return result;
    },
    onSuccess: () => {
      queryClient.clear();
      router.push('/auth/login');
    },
  });
}
