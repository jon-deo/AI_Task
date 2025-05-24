import { EventEmitter } from 'events';

// Metrics collection and monitoring
export interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
}

export interface PerformanceMetric {
  operation: string;
  duration: number;
  success: boolean;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
  network: {
    bytesIn: number;
    bytesOut: number;
  };
  timestamp: Date;
}

export interface ApplicationMetrics {
  activeUsers: number;
  totalRequests: number;
  errorRate: number;
  averageResponseTime: number;
  queueSize: number;
  activeGenerations: number;
  timestamp: Date;
}

export class MetricsCollector extends EventEmitter {
  private metrics: Map<string, Metric[]> = new Map();
  private performanceMetrics: PerformanceMetric[] = [];
  private retentionPeriod = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    super();
    this.startCleanupInterval();
  }

  /**
   * Record a counter metric
   */
  incrementCounter(name: string, value: number = 1, tags?: Record<string, string>): void {
    this.recordMetric({
      name,
      value,
      timestamp: new Date(),
      tags,
      type: 'counter',
    });
  }

  /**
   * Record a gauge metric
   */
  recordGauge(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric({
      name,
      value,
      timestamp: new Date(),
      tags,
      type: 'gauge',
    });
  }

  /**
   * Record a histogram metric
   */
  recordHistogram(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric({
      name,
      value,
      timestamp: new Date(),
      tags,
      type: 'histogram',
    });
  }

  /**
   * Time an operation
   */
  async timeOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = Date.now();
    let success = false;
    
    try {
      const result = await fn();
      success = true;
      return result;
    } finally {
      const duration = Date.now() - startTime;
      
      this.recordPerformance({
        operation,
        duration,
        success,
        timestamp: new Date(),
        metadata,
      });

      this.recordMetric({
        name: `operation.${operation}.duration`,
        value: duration,
        timestamp: new Date(),
        tags: { success: success.toString() },
        type: 'timer',
      });
    }
  }

  /**
   * Record a performance metric
   */
  recordPerformance(metric: PerformanceMetric): void {
    this.performanceMetrics.push(metric);
    this.emit('performance', metric);
    
    // Keep only recent metrics
    const cutoff = Date.now() - this.retentionPeriod;
    this.performanceMetrics = this.performanceMetrics.filter(
      m => m.timestamp.getTime() > cutoff
    );
  }

  /**
   * Record a generic metric
   */
  private recordMetric(metric: Metric): void {
    const existing = this.metrics.get(metric.name) || [];
    existing.push(metric);
    this.metrics.set(metric.name, existing);
    
    this.emit('metric', metric);
  }

  /**
   * Get metrics by name
   */
  getMetrics(name: string, since?: Date): Metric[] {
    const metrics = this.metrics.get(name) || [];
    
    if (since) {
      return metrics.filter(m => m.timestamp >= since);
    }
    
    return metrics;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(operation?: string, since?: Date): PerformanceMetric[] {
    let metrics = this.performanceMetrics;
    
    if (operation) {
      metrics = metrics.filter(m => m.operation === operation);
    }
    
    if (since) {
      metrics = metrics.filter(m => m.timestamp >= since);
    }
    
    return metrics;
  }

  /**
   * Get aggregated metrics
   */
  getAggregatedMetrics(name: string, since?: Date): {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  } {
    const metrics = this.getMetrics(name, since);
    const values = metrics.map(m => m.value).sort((a, b) => a - b);
    
    if (values.length === 0) {
      return {
        count: 0,
        sum: 0,
        avg: 0,
        min: 0,
        max: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      };
    }
    
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    
    return {
      count: values.length,
      sum,
      avg,
      min: values[0],
      max: values[values.length - 1],
      p50: this.percentile(values, 0.5),
      p95: this.percentile(values, 0.95),
      p99: this.percentile(values, 0.99),
    };
  }

  /**
   * Calculate percentile
   */
  private percentile(values: number[], p: number): number {
    const index = Math.ceil(values.length * p) - 1;
    return values[Math.max(0, index)];
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000); // Clean up every hour
  }

  /**
   * Clean up old metrics
   */
  private cleanup(): void {
    const cutoff = Date.now() - this.retentionPeriod;
    
    for (const [name, metrics] of this.metrics.entries()) {
      const filtered = metrics.filter(m => m.timestamp.getTime() > cutoff);
      this.metrics.set(name, filtered);
    }
  }
}

// Global metrics collector instance
export const metricsCollector = new MetricsCollector();

// Application-specific metrics
export class ApplicationMonitor {
  private systemMetricsInterval?: NodeJS.Timeout;
  private applicationMetricsInterval?: NodeJS.Timeout;

  constructor(private collector: MetricsCollector) {}

  /**
   * Start monitoring
   */
  start(): void {
    this.startSystemMetrics();
    this.startApplicationMetrics();
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.systemMetricsInterval) {
      clearInterval(this.systemMetricsInterval);
    }
    
    if (this.applicationMetricsInterval) {
      clearInterval(this.applicationMetricsInterval);
    }
  }

  /**
   * Start collecting system metrics
   */
  private startSystemMetrics(): void {
    this.systemMetricsInterval = setInterval(async () => {
      try {
        const metrics = await this.collectSystemMetrics();
        
        this.collector.recordGauge('system.cpu', metrics.cpu);
        this.collector.recordGauge('system.memory', metrics.memory);
        this.collector.recordGauge('system.disk', metrics.disk);
        this.collector.recordGauge('system.network.bytes_in', metrics.network.bytesIn);
        this.collector.recordGauge('system.network.bytes_out', metrics.network.bytesOut);
      } catch (error) {
        console.warn('Failed to collect system metrics:', error);
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Start collecting application metrics
   */
  private startApplicationMetrics(): void {
    this.applicationMetricsInterval = setInterval(async () => {
      try {
        const metrics = await this.collectApplicationMetrics();
        
        this.collector.recordGauge('app.active_users', metrics.activeUsers);
        this.collector.recordGauge('app.total_requests', metrics.totalRequests);
        this.collector.recordGauge('app.error_rate', metrics.errorRate);
        this.collector.recordGauge('app.avg_response_time', metrics.averageResponseTime);
        this.collector.recordGauge('app.queue_size', metrics.queueSize);
        this.collector.recordGauge('app.active_generations', metrics.activeGenerations);
      } catch (error) {
        console.warn('Failed to collect application metrics:', error);
      }
    }, 60000); // Every minute
  }

  /**
   * Collect system metrics
   */
  private async collectSystemMetrics(): Promise<SystemMetrics> {
    // In a real implementation, you would use libraries like 'os' or 'systeminformation'
    // For now, return mock data
    return {
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      disk: Math.random() * 100,
      network: {
        bytesIn: Math.floor(Math.random() * 1000000),
        bytesOut: Math.floor(Math.random() * 1000000),
      },
      timestamp: new Date(),
    };
  }

  /**
   * Collect application metrics
   */
  private async collectApplicationMetrics(): Promise<ApplicationMetrics> {
    // In a real implementation, you would collect these from your application state
    // For now, return mock data
    return {
      activeUsers: Math.floor(Math.random() * 1000),
      totalRequests: Math.floor(Math.random() * 10000),
      errorRate: Math.random() * 5,
      averageResponseTime: Math.random() * 1000,
      queueSize: Math.floor(Math.random() * 50),
      activeGenerations: Math.floor(Math.random() * 10),
      timestamp: new Date(),
    };
  }
}

// Health check system
export interface HealthCheck {
  name: string;
  check: () => Promise<{ healthy: boolean; message?: string; details?: any }>;
  timeout: number;
  critical: boolean;
}

export class HealthChecker {
  private checks: Map<string, HealthCheck> = new Map();

  /**
   * Register a health check
   */
  register(check: HealthCheck): void {
    this.checks.set(check.name, check);
  }

  /**
   * Run all health checks
   */
  async runAll(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, {
      status: 'healthy' | 'unhealthy';
      message?: string;
      details?: any;
      duration: number;
    }>;
  }> {
    const results: Record<string, any> = {};
    let hasUnhealthy = false;
    let hasDegraded = false;

    for (const [name, check] of this.checks.entries()) {
      const startTime = Date.now();
      
      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Health check timeout')), check.timeout);
        });

        const result = await Promise.race([check.check(), timeoutPromise]) as any;
        
        results[name] = {
          status: result.healthy ? 'healthy' : 'unhealthy',
          message: result.message,
          details: result.details,
          duration: Date.now() - startTime,
        };

        if (!result.healthy) {
          if (check.critical) {
            hasUnhealthy = true;
          } else {
            hasDegraded = true;
          }
        }
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Health check failed',
          duration: Date.now() - startTime,
        };

        if (check.critical) {
          hasUnhealthy = true;
        } else {
          hasDegraded = true;
        }
      }
    }

    const overall = hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy';

    return { overall, checks: results };
  }
}

// Global instances
export const applicationMonitor = new ApplicationMonitor(metricsCollector);
export const healthChecker = new HealthChecker();

// Setup monitoring
export function setupMonitoring(): void {
  // Start application monitoring
  applicationMonitor.start();

  // Register basic health checks
  healthChecker.register({
    name: 'database',
    check: async () => {
      // In real implementation, check database connection
      return { healthy: true, message: 'Database is healthy' };
    },
    timeout: 5000,
    critical: true,
  });

  healthChecker.register({
    name: 'redis',
    check: async () => {
      // In real implementation, check Redis connection
      return { healthy: true, message: 'Redis is healthy' };
    },
    timeout: 3000,
    critical: false,
  });

  // Log metrics periodically
  setInterval(() => {
    const since = new Date(Date.now() - 5 * 60 * 1000); // Last 5 minutes
    const requestMetrics = metricsCollector.getAggregatedMetrics('http.requests', since);
    const errorMetrics = metricsCollector.getAggregatedMetrics('http.errors', since);
    
    console.log('Metrics Summary (last 5 minutes):', {
      requests: requestMetrics,
      errors: errorMetrics,
    });
  }, 5 * 60 * 1000); // Every 5 minutes
}
