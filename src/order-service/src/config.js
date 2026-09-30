// ──────────────────────────────────────────────────────────────
// src/order-service/src/config.js — Environment Configuration
// Purpose: Validate required environment variables at startup.
// Security: No defaults for credentials. Requires PRODUCT_SERVICE_URL
//           for inter-service communication.
// ──────────────────────────────────────────────────────────────

import { z } from 'zod';

const envSchema = z.object({
  ORDER_SERVICE_PORT: z.coerce.number().default(3003),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  POSTGRES_HOST: z.string().min(1, 'POSTGRES_HOST is required'),
  POSTGRES_PORT: z.coerce.number().default(5432),
  ORDERS_DB_NAME: z.string().min(1, 'ORDERS_DB_NAME is required'),
  ORDERS_DB_USER: z.string().min(1, 'ORDERS_DB_USER is required'),
  ORDERS_DB_PASSWORD: z.string().min(1, 'ORDERS_DB_PASSWORD is required'),

  // URL of product-service for price/stock validation
  PRODUCT_SERVICE_URL: z.string().url('PRODUCT_SERVICE_URL must be a valid URL'),

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
