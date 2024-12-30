'use client';

import { useLogger } from '@/hooks/useLogger';
import { LoggerProvider } from '@/components/providers/logger-provider';
import { UserAccountNav } from '../user-account-nav';

interface HeaderProps {
  children?: React.ReactNode;
}

export function Header({ children }: HeaderProps) {
  const logger = useLogger('Header');

  return (
    <LoggerProvider componentName="Header">
      <header className="border-b border-gray-200 bg-white">
        <div className="flex h-16 items-center justify-between px-4">
          {/* Left side with mobile menu button if provided */}
          <div className="flex items-center">
            {children}
            <span className="ml-2 text-xl font-bold text-gray-900">
              Nibblix
            </span>
          </div>

          {/* Right side with user account navigation */}
          <UserAccountNav />
        </div>
      </header>
    </LoggerProvider>
  );
}
