import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { QueryProvider } from "@/providers/query-provider"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Nibblix - Restaurant Management System",
  description: "A comprehensive solution for managing restaurant operations",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <QueryProvider>
          {children}
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  )
}