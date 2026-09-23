// ──────────────────────────────────────────────────────────────
// src/product-service/src/lib/db.js — PostgreSQL Connection Pool
// Purpose: Pool connected to productsdb using product_svc role.
// Security: Least-privilege role with CONNECT on productsdb only.
// ──────────────────────────────────────────────────────────────

import pg from 'pg';
import { config } from '../config.js';
import { logger } from './logger.js';

const { Pool } = pg;

export const pool = new Pool({
  host: config.POSTGRES_HOST,
  port: config.POSTGRES_PORT,
  database: config.PRODUCTS_DB_NAME,
  user: config.PRODUCTS_DB_USER,
  password: config.PRODUCTS_DB_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected database pool error');
});

export async function checkDbHealth() {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    return true;
  } catch (err) {
    logger.error({ err }, 'Database health check failed');
    return false;
  } finally {
    client.release();
  }
}
