'use client';

import { useAuth } from '@/app/context/AuthContext';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { RoleType } from '@/types/auth';

interface NavItem {
  href: string;
  label: string;
  roles?: RoleType[];
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/orders', label: 'Orders' },
  { href: '/menu', label: 'Menu' },
  { 
    href: '/admin/settings', 
    label: 'Settings',
    roles: ['admin'] 
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const isActiveLink = (href: string) => pathname === href;
  const canAccessLink = (item: NavItem) => 
    !item.roles || (user?.role?.name && item.roles.includes(user.role.name as RoleType));

  return (
    <div className="w-64 bg-gray-50 dark:bg-gray-900 min-h-screen p-4">
      <nav className="space-y-2">
        {navItems.map((item) => 
          canAccessLink(item) && (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-4 py-2 rounded-md transition-colors ${
                isActiveLink(item.href)
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800'
              }`}
            >
              {item.label}
            </Link>
          )
        )}
      </nav>
    </div>
  );
}