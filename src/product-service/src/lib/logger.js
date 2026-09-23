// ──────────────────────────────────────────────────────────────
// src/product-service/src/lib/logger.js — Structured JSON Logger
// Purpose: Pino logger for product-service with sensitive field
//          redaction.
// Security: Never log tokens or credentials.
// ──────────────────────────────────────────────────────────────

import pino from 'pino';
import { config } from '../config.js';

export const logger = pino({
  name: 'product-service',
  level: config.LOG_LEVEL,
  redact: {
    paths: ['req.headers.authorization', 'password'],
    censor: '[REDACTED]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
