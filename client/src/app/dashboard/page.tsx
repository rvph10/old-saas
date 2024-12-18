import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { RoleGuard } from '@/components/auth/RoleGuard';

export default function DashboardPage() {
  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        
        <RoleGuard roles={['admin']}>
          <div className="bg-yellow-100 p-4 rounded">
            Admin-only content
          </div>
        </RoleGuard>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Dashboard content */}
        </div>
      </div>
    </ProtectedLayout>
  );
}