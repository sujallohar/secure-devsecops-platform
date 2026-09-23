// ──────────────────────────────────────────────────────────────
// src/product-service/src/middleware/error-handler.js
// Purpose: Centralised error handler for product-service.
// Security: Never leaks stack traces or SQL errors to clients.
// ──────────────────────────────────────────────────────────────

import { logger } from '../lib/logger.js';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  logger.error({
    err,
    correlationId: req.correlationId,
    method: req.method,
    url: req.originalUrl,
  }, 'Unhandled error');

  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    error: {
      message: statusCode === 500 ? 'Internal server error' : err.message,
      ...(req.correlationId && { correlationId: req.correlationId }),
    },
  });
}
