'use client';

import { useAuth } from '@/app/context/AuthContext';
import { ReactNode } from 'react';
import type { RoleType } from '@/types/auth';

interface RoleGuardProps {
  children: ReactNode;
  roles: RoleType[];
  fallback?: ReactNode;
}

export function RoleGuard({ children, roles, fallback = null }: RoleGuardProps) {
    const { user } = useAuth();
  
    if (!user?.role?.name || !roles.includes(user.role.name)) {
      return <>{fallback}</>;
    }
  
    return <>{children}</>;
  }