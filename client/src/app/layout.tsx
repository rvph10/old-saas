import type { Metadata } from "next";
import { AuthProvider } from "./context/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoggerInitializer } from "@/components/LoggerInitializer";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import "./globals.css";

export const metadata: Metadata = {
  title: "Nibblix",
  description: "Restaurant Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className='antialiased'>
        <ErrorBoundary>
          <LoggerInitializer />
          <AuthProvider>{children}</AuthProvider>
          <ToastContainer />
        </ErrorBoundary>
      </body>
    </html>
  );
}