import { Injectable, Logger } from '@nestjs/common';
import { performance } from 'perf_hooks';

@Injectable()
export class PerformanceService {
  private readonly logger = new Logger('Performance');
  private metrics: Map<string, number[]> = new Map();
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();

  trackMetric(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name).push(value);
  }

  async measureAsync<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await operation();
      const duration = performance.now() - start;
      this.trackMetric(name, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.trackMetric(`${name}_error`, duration);
      throw error;
    }
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }

  getMetricsSummary() {
    const summary = {
      timers: {},
      counters: {},
      gauges: {},
    };

    // Process timers
    this.metrics.forEach((values, name) => {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      summary.timers[name] = {
        average: avg.toFixed(2),
        min: Math.min(...values).toFixed(2),
        max: Math.max(...values).toFixed(2),
        count: values.length,
        p95: this.calculatePercentile(values, 95).toFixed(2),
      };
    });

    // Add counters and gauges
    summary.counters = Object.fromEntries(this.counters);
    summary.gauges = Object.fromEntries(this.gauges);

    return summary;
  }

  incrementCounter(name: string) {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + 1);
  }

  setGauge(name: string, value: number) {
    this.gauges.set(name, value);
  }

  clearMetrics() {
    this.metrics.clear();
  }
}
