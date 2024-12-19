// src/app/dashboard/page.tsx
"use client";

import { LoggerProvider } from "@/components/providers/logger-provider";
import { 
  Users, 
  Utensils, 
  Table, 
  AlertCircle,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Clock
} from "lucide-react";

// Card Component
function StatCard({ 
  title, 
  value, 
  description, 
  icon: Icon 
}: { 
  title: string; 
  value: string | number; 
  description: string;
  icon: any;
}) {
  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="mt-2 text-3xl font-bold">{value}</p>
          <p className="mt-1 text-sm text-gray-600">{description}</p>
        </div>
        <div className="rounded-full bg-gray-100 p-3">
          <Icon className="h-6 w-6 text-gray-600" />
        </div>
      </div>
    </div>
  );
}

// Alert Component
function Alert({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
      <AlertCircle className="h-5 w-5" />
      {message}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <LoggerProvider componentName="DashboardPage">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <span className="text-sm text-gray-600">Last updated: just now</span>
        </div>

        {/* Alerts */}
        <div className="space-y-2">
          <Alert message="3 tables need cleanup" />
          <Alert message="Low stock alert: Tomatoes, Onions" />
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Today's Orders"
            value={147}
            description="12% increase from yesterday"
            icon={Utensils}
          />
          <StatCard
            title="Active Tables"
            value="24/32"
            description="75% capacity"
            icon={Table}
          />
          <StatCard
            title="Staff on Duty"
            value={12}
            description="3 in kitchen, 9 in service"
            icon={Users}
          />
          <StatCard
            title="Today's Revenue"
            value="$3,240"
            description="Updated in real-time"
            icon={DollarSign}
          />
        </div>

        {/* Recent Activity */}
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {/* Recent Orders */}
          <div className="rounded-lg border bg-white p-6">
            <h2 className="text-lg font-semibold">Recent Orders</h2>
            <div className="mt-4 space-y-4">
              {[1, 2, 3].map((order) => (
                <div key={order} className="flex items-center justify-between border-b pb-4">
                  <div className="flex items-center gap-4">
                    <div className="rounded-full bg-gray-100 p-2">
                      <ShoppingCart className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">Order #{1000 + order}</p>
                      <p className="text-sm text-gray-600">Table 12 • $84.00</p>
                    </div>
                  </div>
                  <span className="text-sm text-gray-600">2m ago</span>
                </div>
              ))}
            </div>
          </div>

          {/* Staff Activity */}
          <div className="rounded-lg border bg-white p-6">
            <h2 className="text-lg font-semibold">Staff Activity</h2>
            <div className="mt-4 space-y-4">
              {[1, 2, 3].map((activity) => (
                <div key={activity} className="flex items-center justify-between border-b pb-4">
                  <div className="flex items-center gap-4">
                    <div className="rounded-full bg-gray-100 p-2">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">John Doe</p>
                      <p className="text-sm text-gray-600">Started shift</p>
                    </div>
                  </div>
                  <span className="text-sm text-gray-600">5m ago</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </LoggerProvider>
  );
}