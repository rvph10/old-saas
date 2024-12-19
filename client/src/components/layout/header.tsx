"use client";

import { useLogger } from "@/hooks/useLogger";
import { LoggerProvider } from "@/components/providers/logger-provider";

export function Header() {
  const logger = useLogger("Header");

  return (
    <LoggerProvider componentName="Header">
      <header className="border-b border-gray-200 bg-white">
        <div className="flex h-16 items-center justify-between px-4">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <span className="text-xl font-bold text-gray-900">Nibblix</span>
          </div>

          {/* Right side elements */}
          <div className="flex items-center space-x-4">
            {/* Profile dropdown can be added here later */}
            <span className="text-sm text-gray-700">Admin</span>
          </div>
        </div>
      </header>
    </LoggerProvider>
  );
}