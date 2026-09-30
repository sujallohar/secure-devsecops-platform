// ──────────────────────────────────────────────────────────────
// src/api-gateway/src/app.js — Express Application Setup
// Purpose: Configure the API gateway with security middleware,
//          rate limiting, proxy routes, and health probes.
// Security: helmet, CORS allowlist, rate limiting, JWT verification.
// ──────────────────────────────────────────────────────────────

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { correlationId } from './middleware/correlation-id.js';
import { generalLimiter } from './middleware/rate-limit.js';
import { errorHandler } from './middleware/error-handler.js';
import { router as proxyRoutes } from './routes/proxy.js';

export const app = express();

// Security headers configured with hardened CSP
// Addresses threat: XSS, clickjacking, MIME sniffing, unauthorized embedding
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  },
  frameguard: { action: 'deny' },
}));

// Additional defense-in-depth headers
// Addresses threat: browser hardware/sensor leakage, sensitive response caching in intermediate proxies
app.use((_req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
  );
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// CORS allowlist
app.use(cors({
  origin: config.CORS_ALLOWED_ORIGINS.split(','),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
}));

// Correlation ID for tracing
app.use(correlationId);

// General rate limiting (all routes)
app.use(generalLimiter);

// Structured logging
app.use(pinoHttp({
  logger,
  customProps: (req) => ({ correlationId: req.correlationId }),
}));

// Health and readiness probes (no auth required)
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'healthy', service: 'api-gateway' });
});

app.get('/ready', (_req, res) => {
  // The gateway has no database, so readiness = liveness.
  // It depends on backend services being reachable, but
  // we don't check that here — a failing proxy returns 502.
  res.status(200).json({ status: 'ready', service: 'api-gateway' });
});

// Gateway info probe / root
app.get('/', (_req, res) => {
  res.status(200).json({
    service: 'api-gateway',
    status: 'operational',
    version: '1.0.0',
  });
});

// Proxy routes
app.use('/', proxyRoutes);

// 404 handler for unmatched routes (ensures JSON response and preserves hardened security headers)
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: 'Not found',
      ...(req.correlationId && { correlationId: req.correlationId }),
    },
  });
});

// Error handler (must be last)
app.use(errorHandler);
