// ──────────────────────────────────────────────────────────────
// src/order-service/src/lib/logger.js
// Purpose: Pino logger for order-service.
// Security: Redacts tokens and credentials from logs.
// ──────────────────────────────────────────────────────────────

import pino from 'pino';
import { config } from '../config.js';

export const logger = pino({
  name: 'order-service',
  level: config.LOG_LEVEL,
  redact: {
    paths: ['req.headers.authorization', 'password'],
    censor: '[REDACTED]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
