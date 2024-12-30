'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLogout, useUser } from '@/hooks/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut, Settings, User } from 'lucide-react';

export function UserAccountNav() {
  const router = useRouter();
  const { data: user, isLoading } = useUser();
  const logout = useLogout();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout.mutateAsync();
      router.push('/auth/login');
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (isLoading) {
    return (
      <Button variant="ghost" size="sm" className="text-sm">
        Loading...
      </Button>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <User className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Unknown User</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex flex-col items-end">
        <p className="text-sm font-medium">
          {user.firstName
            ? `${user.firstName} ${user.lastName}`
            : user.username}
        </p>
        <p className="text-xs text-muted-foreground">{user.email}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings">
            <Settings className="h-4 w-4" />
            <span className="sr-only">Settings</span>
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          <LogOut className="h-4 w-4" />
          <span className="sr-only">Sign out</span>
        </Button>
      </div>
    </div>
  );
}
