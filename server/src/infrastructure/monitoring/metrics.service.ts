import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as promClient from 'prom-client';

interface MetricLabels {
  [key: string]: string | number;
}

@Injectable()
export class MetricsService implements OnModuleInit {
  private static instance: MetricsService | null = null;
  private readonly register: promClient.Registry;
  private httpRequestDuration: promClient.Histogram;
  private httpRequestTotal: promClient.Counter;
  private errorCounter: promClient.Counter;
  private customCounters: Map<string, promClient.Counter> = new Map();

  constructor(private config: ConfigService) {
    if (!MetricsService.instance) {
      this.register = new promClient.Registry();
      promClient.collectDefaultMetrics({ register: this.register });
      MetricsService.instance = this;
    }
    return MetricsService.instance;
  }

  onModuleInit() {
    if (!this.httpRequestDuration) {
      this.initializeMetrics();
    }
  }

  private initializeMetrics() {
    try {
      // Initialize error counter
      this.errorCounter = new promClient.Counter({
        name: 'app_errors_total',
        help: 'Total number of errors by type',
        labelNames: ['error_type', 'path', 'status_code'],
        registers: [this.register],
      });

      this.httpRequestDuration = new promClient.Histogram({
        name: 'http_request_duration_seconds',
        help: 'Duration of HTTP requests in seconds',
        labelNames: ['method', 'route', 'status_code'],
        buckets: [0.1, 0.5, 1, 2, 5],
        registers: [this.register],
      });

      this.httpRequestTotal = new promClient.Counter({
        name: 'http_requests_total',
        help: 'Total number of HTTP requests',
        labelNames: ['method', 'route', 'status_code'],
        registers: [this.register],
      });
    } catch (error) {
      // Log error but don't throw to prevent app crash
      console.error('Error initializing metrics:', error);
    }
  }

  private getOrCreateCounter(
    name: string,
    labels?: string[],
  ): promClient.Counter {
    const counterName = `app_${name}_total`;

    if (!this.customCounters.has(counterName)) {
      try {
        const counter = new promClient.Counter({
          name: counterName,
          help: `Total number of ${name}`,
          labelNames: labels || [],
          registers: [this.register],
        });
        this.customCounters.set(counterName, counter);
      } catch (error) {
        // If counter already exists, try to get it from the registry
        const existingCounter = this.register.getSingleMetric(counterName);
        if (existingCounter) {
          this.customCounters.set(
            counterName,
            existingCounter as promClient.Counter,
          );
        } else {
          console.error(`Error creating counter ${counterName}:`, error);
        }
      }
    }

    return this.customCounters.get(counterName);
  }

  incrementCounter(name: string, labels?: MetricLabels) {
    try {
      const counter = this.getOrCreateCounter(
        name,
        labels ? Object.keys(labels) : undefined,
      );

      if (counter) {
        if (labels) {
          counter.inc(labels);
        } else {
          counter.inc();
        }
      }
    } catch (error) {
      console.error(`Error incrementing counter ${name}:`, error);
    }
  }

  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
  ) {
    try {
      if (this.httpRequestDuration) {
        this.httpRequestDuration
          .labels(method, route, statusCode.toString())
          .observe(duration);
      }
      if (this.httpRequestTotal) {
        this.httpRequestTotal
          .labels(method, route, statusCode.toString())
          .inc();
      }
    } catch (error) {
      console.error('Error recording HTTP request:', error);
    }
  }

  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  clearRegistry() {
    this.register.clear();
  }
}
