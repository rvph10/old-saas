import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/lib/api-client';
import { useRouter } from 'next/navigation';

export function useLogin() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      queryClient.setQueryData(['user'], data.user);
      //router.push('/dashboard');
    },
    onError: (error) => {
      console.error('Login error:', error);
    }
  });
}

export function useRegister() {
  const router = useRouter();

  return useMutation({
    mutationFn: authApi.register,
    onSuccess: () => {
      router.push('/auth/verify-email');
    },
  });
}

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      queryClient.clear();
      router.push('/auth/login');
    },
  });
}

export function useVerifyEmail() {
  const router = useRouter();

  return useMutation({
    mutationFn: authApi.verifyEmail,
    onSuccess: () => {
      router.push('/auth/login');
    },
  });
}

export function useUser() {
  return useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const response = await authApi.getCurrentUser();
      return response.data;
    },
    retry: false,
  });
}

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: authApi.requestPasswordReset,
  });
}

export function useResetPassword() {
  const router = useRouter();

  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      authApi.resetPassword(token, password),
    onSuccess: () => {
      router.push('/auth/login');
    },
  });
}

export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const response = await authApi.getSessions();
      return response.data;
    },
  });
}

export function useTerminateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authApi.terminateSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

export function useLogoutAllDevices() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: authApi.logoutAllDevices,
    onSuccess: () => {
      queryClient.clear();
      router.push('/auth/login');
    },
  });
}