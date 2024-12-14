import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as promClient from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly register: promClient.Registry;
  private httpRequestDuration: promClient.Histogram;
  private httpRequestTotal: promClient.Counter;

  constructor(private config: ConfigService) {
    this.register = new promClient.Registry();
    promClient.collectDefaultMetrics({ register: this.register });
  }

  onModuleInit() {
    this.initializeMetrics();
  }

  private initializeMetrics() {
    this.httpRequestDuration = new promClient.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.5, 1, 2, 5],
    });

    this.httpRequestTotal = new promClient.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
    });

    this.register.registerMetric(this.httpRequestDuration);
    this.register.registerMetric(this.httpRequestTotal);
  }

  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
  ) {
    this.httpRequestDuration
      .labels(method, route, statusCode.toString())
      .observe(duration);
    this.httpRequestTotal.labels(method, route, statusCode.toString()).inc();
  }

  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }
}
