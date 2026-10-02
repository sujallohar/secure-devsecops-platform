// ──────────────────────────────────────────────────────────────
// src/api-gateway/src/lib/metrics.js — Prometheus Observability
// Purpose: Collect HTTP and business metrics using prom-client.
// Security (Threat T17): /metrics is exposed on a dedicated
//          internal port (9090) that is NEVER routed through Ingress.
//          This prevents attackers from mapping internal routes,
//          observing system performance, or conducting DoS on the
//          metrics registry.
// ──────────────────────────────────────────────────────────────

import http from 'node:http';
import client from 'prom-client';
import { logger } from './logger.js';

// Dedicated Prometheus registry
export const register = new client.Registry();

// Collect Node.js process metrics (GC, event loop, memory, CPU)
client.collectDefaultMetrics({ register, prefix: 'nodejs_' });

// 1. Standard HTTP requests counter
export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests processed',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

// 2. Standard HTTP request duration histogram
export const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

// 3. Service-specific business metric: Forwarded requests by upstream service
export const forwardedRequestsTotal = new client.Counter({
  name: 'api_gateway_forwarded_requests_total',
  help: 'Total number of requests forwarded to upstream services',
  labelNames: ['target_service', 'status'],
  registers: [register],
});

/**
 * Express middleware to record request counts and duration.
 */
export function metricsMiddleware(req, res, next) {
  const start = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const duration = diff[0] + diff[1] / 1e9;

    // Normalize route to avoid high cardinality
    const route = req.baseUrl + (req.route?.path || req.path || 'unknown');
    const method = req.method;
    const status = res.statusCode ? res.statusCode.toString() : '500';

    httpRequestsTotal.inc({ method, route, status });
    httpRequestDurationSeconds.observe({ method, route, status }, duration);
  });

  next();
}

/**
 * Dedicated internal HTTP server for Prometheus scraping.
 * Threat T17 Mitigation: Bound to a separate port not exposed to external ingress.
 */
let metricsServer = null;

export function startMetricsServer(port) {
  metricsServer = http.createServer(async (req, res) => {
    if (req.url === '/metrics' && req.method === 'GET') {
      try {
        res.setHeader('Content-Type', register.contentType);
        res.end(await register.metrics());
      } catch (err) {
        logger.error({ err }, 'Error generating Prometheus metrics');
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    } else {
      res.statusCode = 404;
      res.end('Not Found');
    }
  });

  metricsServer.listen(port, () => {
    logger.info({ port }, 'Internal Prometheus metrics server listening');
  });

  return metricsServer;
}

export function stopMetricsServer() {
  if (metricsServer) {
    metricsServer.close();
  }
}
