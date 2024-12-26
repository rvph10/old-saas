export interface HealthCheckResult {
  status: 'ok' | 'error';
  error?: string;
}

export interface MemoryHealthCheck {
  status: 'ok';
  heap: number;
  rss: number;
}

export interface HealthStatus {
  status: 'ok' | 'error';
  checks: {
    database: HealthCheckResult;
    redis: HealthCheckResult;
    memory: MemoryHealthCheck;
    uptime: number;
  };
  timestamp: string;
}
