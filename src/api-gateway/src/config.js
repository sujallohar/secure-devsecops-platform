// ──────────────────────────────────────────────────────────────
// src/api-gateway/src/config.js — Environment Configuration
// Purpose: Validate all required env vars for the API gateway.
// Security: JWT_SECRET has no default — must be explicitly set.
// ──────────────────────────────────────────────────────────────

import { z } from 'zod';

const envSchema = z.object({
  API_GATEWAY_PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // JWT verification — must match the user-service's signing config
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ISSUER: z.string().default('secure-devsecops-platform'),
  JWT_AUDIENCE: z.string().default('secure-devsecops-platform'),

  // Upstream service URLs
  USER_SERVICE_URL: z.string().url('USER_SERVICE_URL must be a valid URL'),
  PRODUCT_SERVICE_URL: z.string().url('PRODUCT_SERVICE_URL must be a valid URL'),
  ORDER_SERVICE_URL: z.string().url('ORDER_SERVICE_URL must be a valid URL'),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),        // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),         // 100 per window
  LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),   // 15 minutes
  LOGIN_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(10),    // 10 per window (stricter)

  LOG_LEVEL: z.string().default('info'),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:8080'),
});

function loadConfig() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Environment validation failed:');
    for (const issue of result.error.issues) {
      console.error(`   ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  return Object.freeze(result.data);
}

export const config = loadConfig();
