// ──────────────────────────────────────────────────────────────
// src/user-service/src/lib/db.js — PostgreSQL Connection Pool
// Purpose: Create and export a pg Pool connected to the usersdb
//          database using the service-specific role (user_svc).
// Security: Connection uses the least-privilege user_svc role,
//           which has CONNECT on usersdb only. If this service
//           is compromised, the attacker cannot access productsdb
//           or ordersdb — the database enforces this, not the app.
// ──────────────────────────────────────────────────────────────

import pg from 'pg';
import { config } from '../config.js';
import { logger } from './logger.js';

const { Pool } = pg;

export let pool = new Pool({
  host: config.POSTGRES_HOST,
  port: config.POSTGRES_PORT,
  database: config.USERS_DB_NAME,
  user: config.USERS_DB_USER,
  password: config.USERS_DB_PASSWORD,

  // Connection pool settings
  max: 10,                // max simultaneous connections
  idleTimeoutMillis: 30000,  // close idle connections after 30s
  connectionTimeoutMillis: 5000, // fail fast if DB is unreachable
});

export function setTestPool(testPool) {
  pool = testPool;
}

// Log pool errors (e.g. connection drops) without crashing
pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected database pool error');
});

/**
 * Health check: attempt a simple query to verify DB connectivity.
 * Used by the /ready endpoint to report readiness to Kubernetes.
 */
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
