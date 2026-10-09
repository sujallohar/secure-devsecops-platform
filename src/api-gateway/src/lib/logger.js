// ──────────────────────────────────────────────────────────────
// src/api-gateway/src/lib/logger.js
// Purpose: Pino logger for the API gateway.
// Security: Redacts authorization headers and credentials.
// ──────────────────────────────────────────────────────────────

import pino from 'pino';
import { config } from '../config.js';

export const logger = pino({
  name: 'api-gateway',
  level: config.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.body.password',
      'req.body.token',
      'password',
    ],
    censor: '[REDACTED]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
