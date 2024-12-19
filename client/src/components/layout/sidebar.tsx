'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LoggerProvider } from '@/components/providers/logger-provider';
import { cn } from '@/utils/cn';
import {
  LayoutDashboard,
  Utensils,
  Table,
  Package,
  Users,
  Settings,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Orders', href: '/dashboard/orders', icon: Utensils },
  { name: 'Tables', href: '/dashboard/tables', icon: Table },
  { name: 'Inventory', href: '/dashboard/inventory', icon: Package },
  { name: 'Staff', href: '/dashboard/staff', icon: Users },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <LoggerProvider componentName="Sidebar">
      <div className="flex h-full w-64 flex-col border-r border-gray-200 bg-white">
        <div className="flex flex-1 flex-col overflow-y-auto pb-4 pt-5">
          <nav className="mt-5 flex-1 space-y-1 px-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'group flex items-center rounded-md px-2 py-2 text-sm font-medium',
                    isActive
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                  )}
                >
                  <Icon
                    className={cn(
                      'mr-3 h-5 w-5 flex-shrink-0',
                      isActive
                        ? 'text-gray-900'
                        : 'text-gray-400 group-hover:text-gray-500',
                    )}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </LoggerProvider>
  );
}
