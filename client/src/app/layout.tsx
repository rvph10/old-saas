import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/providers/query-provider';
import { Toaster } from '@/components/ui/toaster';
import { RefreshTokenHandler } from '@/components/auth/refresh-token';
import { OfflineWrapper } from '@/components/layout/offline-wrapper';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Nibblix - Restaurant Management System',
  description: 'A comprehensive solution for managing restaurant operations',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <QueryProvider>
          <OfflineWrapper>
            {children}
            <Toaster />
            <RefreshTokenHandler />
          </OfflineWrapper>
        </QueryProvider>
      </body>
    </html>
  );
}
