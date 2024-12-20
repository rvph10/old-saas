import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, AuthResponse } from '@/lib/api-client';
import { useRouter } from 'next/navigation';
import { RegisterInput } from '@/lib/validations/auth';

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
      // Explicitly type the race result as AuthResponse
      const result = await Promise.race<AuthResponse>([
        authApi.login(credentials),
        timeoutPromise(),
      ]);
      return result;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['user'], data.user);
      router.push('/dashboard');
    },
    onError: (error) => {
      console.error('Login error:', error);
    },
  });
}

export function useRegister() {
  const router = useRouter();

  return useMutation<any, Error, RegisterInput>({
    mutationFn: async (data) => {
      const result = await Promise.race<any>([
        authApi.register(data),
        timeoutPromise(),
      ]);
      return result;
    },
    onSuccess: () => {
      router.push('/auth/verify-email');
    },
    onError: (error) => {
      console.error('Register error:', error);
    },
  });
}

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation<any, Error, void>({
    mutationFn: async () => {
      const result = await Promise.race<any>([
        authApi.logout(),
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

export function useVerifyEmail() {
  return useMutation<any, Error, string>({
    mutationFn: async (token) => {
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
    mutationFn: async (email) => {
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
    mutationFn: async (email) => {
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
    mutationFn: async ({ token, password }) => {
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
  return useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const result = await Promise.race<any>([
        authApi.getCurrentUser(),
        timeoutPromise(),
      ]);
      return result.data;
    },
    retry: false,
  });
}

export function useTerminateSession() {
  const queryClient = useQueryClient();

  return useMutation<any, Error, string>({
    mutationFn: async (sessionId) => {
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
