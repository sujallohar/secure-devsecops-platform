// ──────────────────────────────────────────────────────────────
// src/user-service/src/app.js — Express Application Setup
// Purpose: Configure the Express app with all middleware and
//          routes. Separated from index.js so tests can import
//          the app without starting the HTTP server.
// Security: helmet sets security headers, CORS restricts origins,
//           JSON body parsing has a size limit to prevent DoS.
// ──────────────────────────────────────────────────────────────

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { checkDbHealth } from './lib/db.js';
import { correlationId } from './middleware/correlation-id.js';
import { errorHandler } from './middleware/error-handler.js';
import { router as userRoutes } from './routes/user-routes.js';

export const app = express();

// ── Security middleware ─────────────────────────────────────

// helmet sets various HTTP security headers:
//   X-Content-Type-Options: nosniff (prevents MIME sniffing)
//   X-Frame-Options: SAMEORIGIN (prevents clickjacking)
//   Strict-Transport-Security (forces HTTPS)
//   etc.
// Threat mitigated: common HTTP header-based attacks.
app.use(helmet());

// CORS allowlist: only accept requests from the configured
// frontend origin. Prevents a malicious site from making
// authenticated requests on behalf of a logged-in user.
// Threat mitigated: cross-origin request forgery (CWE-352).
app.use(cors({
  origin: config.CORS_ALLOWED_ORIGINS.split(','),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
}));

// ── Request parsing ─────────────────────────────────────────

// Limit JSON body size to 10KB to prevent large-payload DoS.
// Threat mitigated: denial of service via oversized payloads.
app.use(express.json({ limit: '10kb' }));

// ── Observability middleware ────────────────────────────────

// Correlation ID for distributed tracing
app.use(correlationId);

// Structured HTTP request logging with pino
app.use(pinoHttp({
  logger,
  // Attach correlation ID to every log line for this request
  customProps: (req) => ({
    correlationId: req.correlationId,
  }),
  // Redact authorization header from request logs
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      correlationId: req.raw?.correlationId,
    }),
  },
}));

// ── Health and readiness probes ─────────────────────────────
// These endpoints are NOT behind authentication because
// Kubernetes needs to call them to manage pod lifecycle.

// GET /health — liveness probe. Returns 200 if the process is
// alive. Does NOT check dependencies — a failed DB connection
// should not cause a pod restart, just mark it as unready.
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'healthy', service: 'user-service' });
});

// GET /ready — readiness probe. Returns 200 only if the service
// can actually handle requests (DB is reachable). Kubernetes
// removes unready pods from the Service's endpoint list.
app.get('/ready', async (_req, res) => {
  const dbHealthy = await checkDbHealth();
  if (dbHealthy) {
    res.status(200).json({ status: 'ready', service: 'user-service' });
  } else {
    res.status(503).json({ status: 'not ready', service: 'user-service' });
  }
});

// ── Application routes ──────────────────────────────────────
app.use('/', userRoutes);

// ── Error handling ──────────────────────────────────────────
// Must be registered LAST. Catches all errors from routes above.
app.use(errorHandler);
