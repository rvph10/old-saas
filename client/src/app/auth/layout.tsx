import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute requireAuth={false}>
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </ProtectedRoute>
  );
}