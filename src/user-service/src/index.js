// ──────────────────────────────────────────────────────────────
// src/user-service/src/index.js — Server Entry Point
// Purpose: Start the HTTP server. Config validation (config.js)
//          runs on import — if any required env var is missing,
//          the process exits before the server starts.
// ──────────────────────────────────────────────────────────────

import { app } from './app.js';
import { config } from './config.js';
import { logger } from './lib/logger.js';

const PORT = config.USER_SERVICE_PORT;

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, 'user-service started');
});

// Graceful shutdown: close the server and DB pool when the
// process receives a termination signal (e.g. from Kubernetes
// sending SIGTERM during a rolling update).
function gracefulShutdown(signal) {
  logger.info({ signal }, 'Received shutdown signal, closing server');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
