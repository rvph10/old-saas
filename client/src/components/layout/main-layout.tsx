'use client';

import { LoggerProvider } from '@/components/providers/logger-provider';
import { Header } from './header';
import { Sidebar } from './sidebar';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Button } from '../ui/button';
import { Menu } from 'lucide-react';

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <LoggerProvider componentName="MainLayout">
      <div className="flex min-h-screen bg-gray-50">
        {/* Mobile sidebar */}
        <div
          className={`fixed inset-0 z-50 bg-black/80 lg:hidden ${
            sidebarOpen ? 'block' : 'hidden'
          }`}
          onClick={() => setSidebarOpen(false)}
        />

        {/* Sidebar */}
        <div
          className={`fixed inset-y-0 z-50 w-64 transform bg-white transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Sidebar />
        </div>

        {/* Main content */}
        <div className="flex flex-1 flex-col">
          <Header>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle sidebar</span>
            </Button>
          </Header>

          <main className="flex-1 overflow-y-auto p-6">
            {/* Breadcrumbs could go here */}
            <nav className="mb-6 text-sm text-muted-foreground">
              {pathname
                .split('/')
                .filter(Boolean)
                .map((segment) => (
                  <span key={segment} className="capitalize">
                    {segment}
                  </span>
                ))}
            </nav>

            {/* Page content */}
            {children}
          </main>
        </div>
      </div>
    </LoggerProvider>
  );
}