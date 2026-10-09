// ──────────────────────────────────────────────────────────────
// src/api-gateway/src/middleware/auth.js — JWT Verification
// Purpose: Verify the JWT from the Authorization header and
//          forward the user's identity to backend services via
//          x-user-id and x-user-role headers.
// Security:
//   - Algorithm pinned to HS256 to prevent algorithm confusion
//     attacks (e.g. alg:none or RS256 → HS256 confusion).
//   - issuer and audience claims are verified to ensure the
//     token was issued by our user-service for our platform.
//   - Expired tokens are rejected (exp claim checked by jsonwebtoken).
//   - The JWT secret is loaded from an environment variable,
//     never hardcoded.
//
// TRUST ASSUMPTION: Backend services trust the x-user-id and
//   x-user-role headers set by this gateway. This means:
//   - If a request bypasses the gateway and reaches a service
//     directly, an attacker could forge these headers.
//   - In Kubernetes, NetworkPolicy restricts which pods can
//     talk to which, so direct access should be blocked.
//   - WEAKNESS: This trust model breaks if NetworkPolicy is
//     misconfigured or if an attacker compromises a pod that
//     is allowed to talk to the service. A stronger model would
//     use mutual TLS (mTLS) between services, but that adds
//     significant complexity (service mesh) beyond this project's
//     scope.
// ──────────────────────────────────────────────────────────────

import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

/**
 * Middleware: verify JWT and set identity headers.
 * Used on all proxied routes that require authentication.
 */
export function verifyJwt(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: { message: 'Authentication required. Provide a Bearer token.' },
    });
  }

  const token = authHeader.slice(7); // Remove 'Bearer ' prefix

  try {
    // Verify the token with pinned algorithm, issuer, and audience.
    // If any check fails, jwt.verify throws an error.
    const decoded = jwt.verify(token, config.JWT_SECRET, {
      algorithms: ['HS256'],          // pinned — blocks alg:none attack
      issuer: config.JWT_ISSUER,       // must match user-service's iss
      audience: config.JWT_AUDIENCE,   // must match user-service's aud
    });

    // Forward the verified identity to backend services.
    // Services read these headers instead of re-verifying the JWT.
    req.headers['x-user-id'] = decoded.sub;
    req.headers['x-user-role'] = decoded.role;
    req.headers['x-user-email'] = decoded.email;

    logger.debug({
      userId: decoded.sub,
      correlationId: req.correlationId,
    }, 'JWT verified successfully');

    next();
  } catch (err) {
    // Different JWT errors get the same 401 response to avoid
    // leaking information about why verification failed.
    logger.warn({
      error: err.message,
      correlationId: req.correlationId,
    }, 'JWT verification failed');

    return res.status(401).json({
      error: { message: 'Invalid or expired token' },
    });
  }
}
