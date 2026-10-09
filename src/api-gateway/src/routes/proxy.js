// ──────────────────────────────────────────────────────────────
// src/api-gateway/src/routes/proxy.js — Proxy Routes
// Purpose: Route incoming API requests to the appropriate backend
//          service. The gateway is the single entry point for all
//          client requests.
// Security:
//   - /api/users/register and /api/users/login are public but
//     rate-limited (login has a stricter limit).
//   - All other routes require a valid JWT (verifyJwt middleware).
//   - The gateway strips the /api/users prefix before forwarding
//     to the backend service, so services don't see the gateway's
//     routing structure.
//   - The proxy forwards the correlation ID and identity headers.
// ──────────────────────────────────────────────────────────────

import { Router } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from '../config.js';
import { verifyJwt } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rate-limit.js';
import { logger } from '../lib/logger.js';
import { forwardedRequestsTotal } from '../lib/metrics.js';

export const router = Router();

// ── Helper: create a proxy to a backend service ─────────────
function createProxy(target, pathRewrite, serviceName = 'unknown') {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite,
    // Forward correlation ID and identity headers
    on: {
      proxyReq: (proxyReq, req) => {
        if (req.correlationId) {
          proxyReq.setHeader('X-Correlation-ID', req.correlationId);
        }
        if (req.headers['x-user-id']) {
          proxyReq.setHeader('x-user-id', req.headers['x-user-id']);
        }
        if (req.headers['x-user-role']) {
          proxyReq.setHeader('x-user-role', req.headers['x-user-role']);
        }
      },
      proxyRes: (proxyRes) => {
        forwardedRequestsTotal.inc({
          target_service: serviceName,
          status: proxyRes.statusCode ? proxyRes.statusCode.toString() : '200',
        });
      },
      error: (err, req, res) => {
        forwardedRequestsTotal.inc({
          target_service: serviceName,
          status: '502',
        });
        logger.error({ err, target }, 'Proxy error');
        if (!res.headersSent) {
          res.status(502).json({
            error: { message: 'Service unavailable' },
          });
        }
      },
    },
  });
}

// ── Public routes (no JWT required) ─────────────────────────

// Registration: rate-limited but no auth required
router.post(
  '/api/users/register',
  createProxy(config.USER_SERVICE_URL, { '^/api/users': '' }, 'user-service')
);

// Login: stricter rate limit, no auth required
router.post(
  '/api/users/login',
  loginLimiter,
  createProxy(config.USER_SERVICE_URL, { '^/api/users': '' }, 'user-service')
);

// ── Authenticated routes ────────────────────────────────────

// User routes (except register/login, handled above)
router.use(
  '/api/users',
  verifyJwt,
  createProxy(config.USER_SERVICE_URL, { '^/api/users': '' }, 'user-service')
);

// Product routes
router.use(
  '/api/products',
  verifyJwt,
  createProxy(config.PRODUCT_SERVICE_URL, { '^/api/products': '' }, 'product-service')
);

// Order routes
router.use(
  '/api/orders',
  verifyJwt,
  createProxy(config.ORDER_SERVICE_URL, { '^/api/orders': '' }, 'order-service')
);

