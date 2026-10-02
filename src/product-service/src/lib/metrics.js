// ──────────────────────────────────────────────────────────────
// src/product-service/src/lib/metrics.js — Prometheus Observability
// Purpose: Collect HTTP and business metrics using prom-client.
// Security (Threat T17): /metrics is exposed on a dedicated
//          internal port (9092) not routed through ingress.
// ──────────────────────────────────────────────────────────────

import http from 'node:http';
import client from 'prom-client';
import { logger } from './logger.js';

export const register = new client.Registry();

client.collectDefaultMetrics({ register, prefix: 'nodejs_' });

export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests processed',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

export const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

// Service-specific business metric: Product queries / views
export const productsQueriedTotal = new client.Counter({
  name: 'products_queried_total',
  help: 'Total number of product catalogue queries',
  labelNames: ['action', 'status'],
  registers: [register],
});

export function metricsMiddleware(req, res, next) {
  const start = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const duration = diff[0] + diff[1] / 1e9;

    const route = req.baseUrl + (req.route?.path || req.path || 'unknown');
    const method = req.method;
    const status = res.statusCode ? res.statusCode.toString() : '500';

    httpRequestsTotal.inc({ method, route, status });
    httpRequestDurationSeconds.observe({ method, route, status }, duration);
  });

  next();
}

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
