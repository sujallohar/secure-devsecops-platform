// ──────────────────────────────────────────────────────────────
// src/user-service/src/middleware/correlation-id.js
// Purpose: Attach a unique correlation ID to every incoming
//          request. This ID is included in all log lines and
//          returned in the response header, allowing end-to-end
//          tracing of a request across services and log systems.
// Security: The correlation ID is generated server-side using
//           crypto.randomUUID(). We accept a client-provided
//           X-Correlation-ID only if it matches a UUID format,
//           to prevent log injection attacks.
// ──────────────────────────────────────────────────────────────

import { randomUUID } from 'node:crypto';

// UUID v4 format validation to prevent log injection
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function correlationId(req, res, next) {
  // Accept a valid client-provided correlation ID for distributed
  // tracing, or generate a new one.
  const clientId = req.headers['x-correlation-id'];
  const id = (clientId && UUID_REGEX.test(clientId))
    ? clientId
    : randomUUID();

  req.correlationId = id;
  res.setHeader('X-Correlation-ID', id);

  next();
}
