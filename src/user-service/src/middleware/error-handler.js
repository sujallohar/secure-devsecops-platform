// ──────────────────────────────────────────────────────────────
// src/user-service/src/middleware/error-handler.js
// Purpose: Centralised error handler for Express. All unhandled
//          errors pass through here. It logs the real error for
//          debugging but returns a generic message to the client.
// Security: NEVER leaks stack traces, SQL errors, or internal
//           paths in HTTP responses. Threat mitigated: information
//           disclosure (CWE-209) that could help an attacker
//           understand the internal architecture.
// ──────────────────────────────────────────────────────────────

import { logger } from '../lib/logger.js';

/**
 * Express error-handling middleware (4 arguments required).
 * Must be registered LAST in the middleware chain.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  // Log the full error internally for debugging.
  // The correlation ID (set by correlation-id middleware) links
  // this log entry to the specific request that caused it.
  logger.error({
    err,
    correlationId: req.correlationId,
    method: req.method,
    url: req.originalUrl,
  }, 'Unhandled error');

  // Determine the status code: use err.statusCode if set by
  // our route handlers, otherwise default to 500.
  const statusCode = err.statusCode || 500;

  // Return a generic error message to the client.
  // The real error details stay in the server logs only.
  const response = {
    error: {
      message: statusCode === 500
        ? 'Internal server error'  // never reveal 500 details
        : err.message,             // 4xx errors can show the message
      ...(req.correlationId && { correlationId: req.correlationId }),
    },
  };

  res.status(statusCode).json(response);
}
