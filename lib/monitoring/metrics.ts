/**
 * Application Metrics and Monitoring
 *
 * Tracks key performance and business metrics
 */

interface MetricData {
  timestamp: number;
  value: number;
  tags?: Record<string, string>;
}

class MetricsCollector {
  private metrics: Map<string, MetricData[]> = new Map();

  /**
   * Record a metric value
   */
  record(name: string, value: number, tags?: Record<string, string>): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    this.metrics.get(name)!.push({
      timestamp: Date.now(),
      value,
      tags,
    });

    // Keep only last 1000 data points per metric
    const data = this.metrics.get(name)!;
    if (data.length > 1000) {
      data.shift();
    }

    // Send to external monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      this.sendToMonitoring(name, value, tags);
    }
  }

  /**
   * Increment a counter
   */
  increment(name: string, tags?: Record<string, string>): void {
    this.record(name, 1, tags);
  }

  /**
   * Record timing (in milliseconds)
   */
  timing(name: string, durationMs: number, tags?: Record<string, string>): void {
    this.record(name, durationMs, { ...tags, unit: 'ms' });
  }

  /**
   * Send to external monitoring service
   */
  private sendToMonitoring(name: string, value: number, tags?: Record<string, string>): void {
    // Option 1: Vercel Analytics
    // (automatically collected if @vercel/analytics installed)

    // Option 2: Datadog
    if (process.env.DATADOG_API_KEY) {
      // Would use @datadog/browser-rum or statsd
      console.log(`[DATADOG] ${name}: ${value}`, tags);
    }

    // Option 3: Custom endpoint
    if (process.env.METRICS_ENDPOINT) {
      fetch(process.env.METRICS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metric: name,
          value,
          tags,
          timestamp: Date.now(),
        }),
      }).catch(err => {
        console.error('Failed to send metric:', err);
      });
    }
  }

  /**
   * Get metric summary
   */
  getSummary(name: string): { count: number; avg: number; min: number; max: number } | null {
    const data = this.metrics.get(name);
    if (!data || data.length === 0) return null;

    const values = data.map(d => d.value);
    return {
      count: values.length,
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }
}

// Singleton instance
export const metrics = new MetricsCollector();

/**
 * Common metrics to track
 */
export const MetricNames = {
  // Jobs
  JOB_CREATED: 'job.created',
  JOB_APPROVED: 'job.approved',
  JOB_REJECTED: 'job.rejected',
  JOB_CANCELLED: 'job.cancelled',
  JOB_DURATION: 'job.duration_ms',

  // Payments
  WALLET_CREDITED: 'wallet.credited',
  ESCROW_LOCKED: 'escrow.locked',
  ESCROW_RELEASED: 'escrow.released',
  PAYMENT_AMOUNT: 'payment.amount_usd',

  // Security
  SECRETS_BLOCKED: 'security.secrets_blocked',
  WEBHOOK_SIGNATURE_FAILED: 'security.webhook_signature_failed',
  RATE_LIMIT_EXCEEDED: 'security.rate_limit_exceeded',
  AUTH_FAILED: 'security.auth_failed',

  // Performance
  API_RESPONSE_TIME: 'api.response_time_ms',
  DB_QUERY_TIME: 'db.query_time_ms',
  STRIPE_API_TIME: 'stripe.api_time_ms',

  // Workers
  WORKER_REGISTERED: 'worker.registered',
  WORKER_NOTIFIED: 'worker.notified',
  WORKER_DELIVERY: 'worker.delivery',
};

/**
 * Middleware to track API response times
 */
export function trackResponseTime(
  endpoint: string,
  method: string,
  startTime: number
): void {
  const duration = Date.now() - startTime;
  metrics.timing(MetricNames.API_RESPONSE_TIME, duration, {
    endpoint,
    method,
  });
}
