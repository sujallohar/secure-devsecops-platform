// ──────────────────────────────────────────────────────────────
// src/product-service/src/config.js — Environment Configuration
// Purpose: Validate required environment variables at startup.
// Security: No defaults for database credentials.
// ──────────────────────────────────────────────────────────────

import { z } from 'zod';

const envSchema = z.object({
  PRODUCT_SERVICE_PORT: z.coerce.number().default(3002),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  POSTGRES_HOST: z.string().min(1, 'POSTGRES_HOST is required'),
  POSTGRES_PORT: z.coerce.number().default(5432),
  PRODUCTS_DB_NAME: z.string().min(1, 'PRODUCTS_DB_NAME is required'),
  PRODUCTS_DB_USER: z.string().min(1, 'PRODUCTS_DB_USER is required'),
  PRODUCTS_DB_PASSWORD: z.string().min(1, 'PRODUCTS_DB_PASSWORD is required'),

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
