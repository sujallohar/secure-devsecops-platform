// ──────────────────────────────────────────────────────────────
// src/api-gateway/src/middleware/rate-limit.js — Rate Limiting
// Purpose: Limit the number of requests per IP to prevent brute-
//          force attacks and denial-of-service.
// Security:
//   - General rate limit: 100 requests per 15 minutes (per IP)
//   - Login rate limit: 10 requests per 15 minutes (stricter)
//     Threat mitigated: credential stuffing / brute-force login
//     attacks (CWE-307).
//   - Limitation: This is per-instance rate limiting using an
//     in-memory store. In a multi-replica deployment, each pod
//     has its own counter, so the effective limit is multiplied
//     by the number of replicas. A production system would use
//     Redis-backed rate limiting for distributed coordination.
// ──────────────────────────────────────────────────────────────

import rateLimit from 'express-rate-limit';
import { config } from '../config.js';

/**
 * General rate limiter for all API requests.
 * 100 requests per 15-minute window per IP.
 */
export const generalLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,   // Return RateLimit-* headers
  legacyHeaders: false,     // Disable X-RateLimit-* headers
  message: {
    error: { message: 'Too many requests, please try again later' },
  },
});

/**
 * Stricter rate limiter for login endpoint.
 * 10 requests per 15-minute window per IP.
 * Threat mitigated: brute-force password guessing (CWE-307).
 */
export const loginLimiter = rateLimit({
  windowMs: config.LOGIN_RATE_LIMIT_WINDOW_MS,
  max: config.LOGIN_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { message: 'Too many login attempts, please try again later' },
  },
});
