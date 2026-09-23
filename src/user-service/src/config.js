// ──────────────────────────────────────────────────────────────
// src/user-service/src/config.js — Environment Configuration
// Purpose: Validate all required environment variables at startup
//          using zod. The process exits immediately if any required
//          variable is missing or invalid. This prevents the service
//          from starting in a misconfigured state.
// Security: No defaults for secrets (JWT_SECRET, DB password).
// ──────────────────────────────────────────────────────────────

import { z } from 'zod';

// Define the schema for all required environment variables.
// zod validates types and provides clear error messages if
// a variable is missing or has an invalid format.
const envSchema = z.object({
  // Server
  USER_SERVICE_PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database — no defaults for credentials (security requirement)
  POSTGRES_HOST: z.string().min(1, 'POSTGRES_HOST is required'),
  POSTGRES_PORT: z.coerce.number().default(5432),
  USERS_DB_NAME: z.string().min(1, 'USERS_DB_NAME is required'),
  USERS_DB_USER: z.string().min(1, 'USERS_DB_USER is required'),
  USERS_DB_PASSWORD: z.string().min(1, 'USERS_DB_PASSWORD is required'),

  // JWT — no defaults for the signing secret
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ISSUER: z.string().default('secure-devsecops-platform'),
  JWT_AUDIENCE: z.string().default('secure-devsecops-platform'),
  JWT_EXPIRY: z.string().default('15m'),

  // Logging
  LOG_LEVEL: z.string().default('info'),

  // CORS
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:8080'),
});

/**
 * Parse and validate environment variables.
 * Exits with code 1 if validation fails — the service must not
 * start with missing or invalid configuration.
 */
function loadConfig() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    // Log errors to stderr (pino not yet initialised at this point)
    console.error('❌ Environment validation failed:');
    for (const issue of result.error.issues) {
      console.error(`   ${issue.path.join('.')}: ${issue.message}`);
    }
    console.error('\nCopy .env.example to .env and fill in all required values.');
    process.exit(1);
  }

  return Object.freeze(result.data);
}

export const config = loadConfig();
