'use client';

import { LoggerProvider } from '@/components/providers/logger-provider';
import {
  Users,
  Utensils,
  Table as TableIcon,
  AlertCircle,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Clock,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const revenueData = [
  { name: 'Mon', value: 2400 },
  { name: 'Tue', value: 1398 },
  { name: 'Wed', value: 9800 },
  { name: 'Thu', value: 3908 },
  { name: 'Fri', value: 4800 },
  { name: 'Sat', value: 3800 },
  { name: 'Sun', value: 4300 },
];

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: any;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-6">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold">{value}</p>
            {trend && (
              <span
                className={`text-sm ${
                  trend.isPositive ? 'text-green-500' : 'text-red-500'
                }`}
              >
                {trend.isPositive ? '+' : '-'}
                {trend.value}%
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="rounded-full bg-primary/10 p-3">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  return (
    <LoggerProvider componentName="DashboardPage">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Last updated: {new Date().toLocaleTimeString()}
          </p>
        </div>

        {/* Alerts */}
        <div className="space-y-2">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>3 tables need cleanup</AlertDescription>
          </Alert>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Low stock alert: Tomatoes, Onions
            </AlertDescription>
          </Alert>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Today's Orders"
            value={147}
            description="Total orders today"
            icon={Utensils}
            trend={{ value: 12, isPositive: true }}
          />
          <StatCard
            title="Active Tables"
            value="24/32"
            description="75% capacity"
            icon={TableIcon}
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
            trend={{ value: 8, isPositive: true }}
          />
        </div>

        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Revenue Overview</h2>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Activity Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Recent Orders</h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3].map((order) => (
                  <div
                    key={order}
                    className="flex items-center justify-between border-b pb-4 last:border-0"
                  >
                    <div className="flex items-center gap-4">
                      <div className="rounded-full bg-primary/10 p-2">
                        <ShoppingCart className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Order #{1000 + order}</p>
                        <p className="text-sm text-muted-foreground">
                          Table 12 • $84.00
                        </p>
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      2m ago
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Staff Activity</h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3].map((activity) => (
                  <div
                    key={activity}
                    className="flex items-center justify-between border-b pb-4 last:border-0"
                  >
                    <div className="flex items-center gap-4">
                      <div className="rounded-full bg-primary/10 p-2">
                        <Clock className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">John Doe</p>
                        <p className="text-sm text-muted-foreground">
                          Started shift
                        </p>
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      5m ago
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </LoggerProvider>
  );
}
