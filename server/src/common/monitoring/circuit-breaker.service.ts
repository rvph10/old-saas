import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private state: Map<string, CircuitState> = new Map();

  async executeWithBreaker<T>(
    name: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    if (this.isOpen(name)) {
      throw new Error('Circuit is open');
    }

    try {
      const result = await operation();
      this.recordSuccess(name);
      return result;
    } catch (error) {
      this.recordFailure(name);
      throw error;
    }
  }

  private isOpen(name: string): boolean {
    const circuit = this.state.get(name);
    if (!circuit) return false;

    return (
      circuit.failures >= circuit.threshold &&
      Date.now() - circuit.lastFailure < circuit.resetTimeout
    );
  }

  private recordSuccess(name: string) {
    const circuit = this.state.get(name);
    if (circuit) {
      circuit.failures = 0;
    }
  }

  private recordFailure(name: string) {
    const circuit = this.state.get(name) || this.createCircuit();
    circuit.failures++;
    circuit.lastFailure = Date.now();
    this.state.set(name, circuit);
  }

  private createCircuit(): CircuitState {
    return {
      failures: 0,
      threshold: 5,
      resetTimeout: 60000,
      lastFailure: 0,
    };
  }
}

interface CircuitState {
  failures: number;
  threshold: number;
  resetTimeout: number;
  lastFailure: number;
}
