"use client";

import { LoggerProvider } from "@/components/providers/logger-provider";
import { Header } from "./header";
import { Sidebar } from "./sidebar";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <LoggerProvider componentName="MainLayout">
      <div className="min-h-screen bg-gray-50">
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <Sidebar />

          {/* Main content area */}
          <div className="flex flex-1 flex-col">
            <Header />
            
            {/* Page content */}
            <main className="flex-1 p-6">
              {children}
            </main>
          </div>
        </div>
      </div>
    </LoggerProvider>
  );
}