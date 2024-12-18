'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Navbar } from '@/components/ui/Navbar';
import { Sidebar } from '@/components/ui/Sidebar';
import { RoleType } from '@/types/auth';

interface ProtectedLayoutProps {
    children: React.ReactNode;
    roles?: RoleType[];
  }
  
  export function ProtectedLayout({ children, roles }: ProtectedLayoutProps) {
    return (
      <ProtectedRoute roles={roles}>
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <div className="flex flex-1">
            <Sidebar />
            <main className="flex-1 p-6">{children}</main>
          </div>
        </div>
      </ProtectedRoute>
    );
  }