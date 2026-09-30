// ──────────────────────────────────────────────────────────────
// src/user-service/src/lib/logger.js — Structured JSON Logger
// Purpose: Create a pino logger instance for structured JSON
//          logging. Every log line includes the service name
//          and is machine-parseable for aggregation by Loki.
// Security: Never log passwords, tokens, or full request bodies
//           containing credentials. The serializers below redact
//           sensitive fields from request/response logs.
// ──────────────────────────────────────────────────────────────

import pino from 'pino';
import { config } from '../config.js';

export const logger = pino({
  name: 'user-service',
  level: config.LOG_LEVEL,

  // Redact sensitive fields from logs.
  // Threat mitigated: credential exposure in log files (CWE-532).
  // If an attacker gains access to log storage, they should not
  // find passwords or tokens.
  redact: {
    paths: [
      'req.headers.authorization',  // JWT tokens
      'req.body.password',           // plaintext passwords
      'req.body.token',              // any token field
      'password',                    // top-level password fields
    ],
    censor: '[REDACTED]',
  },

  // Use ISO timestamp format for consistency across services
  timestamp: pino.stdTimeFunctions.isoTime,
});
