'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { RoleType, User } from '@/types/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  roles?: RoleType[];
}

export function ProtectedRoute({
  children,
  requireAuth = true,
  roles = [],
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading) {
      if (requireAuth && !isAuthenticated) {
        router.push(`/auth/login?from=${encodeURIComponent(pathname)}`);
      }

      if (roles.length > 0 && (!user?.role?.name || !roles.includes(user.role.name))) {
        router.push('/unauthorized');
      }
    }
  }, [isLoading, isAuthenticated, user, requireAuth, roles, router, pathname]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (requireAuth && !isAuthenticated) {
    return null;
  }

  if (roles.length > 0 && (!user?.role?.name || !roles.includes(user.role.name))) {
    return null;
  }

  return <>{children}</>;
}