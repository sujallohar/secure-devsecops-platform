// ──────────────────────────────────────────────────────────────
// src/order-service/src/middleware/correlation-id.js
// Purpose: Attach correlation ID for distributed tracing.
// Security: Validates UUID format to prevent log injection.
// ──────────────────────────────────────────────────────────────

import { randomUUID } from 'node:crypto';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function correlationId(req, res, next) {
  const clientId = req.headers['x-correlation-id'];
  const id = (clientId && UUID_REGEX.test(clientId)) ? clientId : randomUUID();
  req.correlationId = id;
  res.setHeader('X-Correlation-ID', id);
  next();
}
