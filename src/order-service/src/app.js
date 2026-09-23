// ──────────────────────────────────────────────────────────────
// src/order-service/src/app.js — Express Application Setup
// Purpose: Configure Express for order-service.
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
import { router as orderRoutes } from './routes/order-routes.js';

export const app = express();

app.use(helmet());
app.use(cors({
  origin: config.CORS_ALLOWED_ORIGINS.split(','),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
}));
app.use(express.json({ limit: '10kb' }));
app.use(correlationId);
app.use(pinoHttp({
  logger,
  customProps: (req) => ({ correlationId: req.correlationId }),
}));

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'healthy', service: 'order-service' });
});

app.get('/ready', async (_req, res) => {
  const dbHealthy = await checkDbHealth();
  if (dbHealthy) {
    res.status(200).json({ status: 'ready', service: 'order-service' });
  } else {
    res.status(503).json({ status: 'not ready', service: 'order-service' });
  }
});

app.use('/', orderRoutes);
app.use(errorHandler);
