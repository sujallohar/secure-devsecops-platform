// ──────────────────────────────────────────────────────────────
// src/order-service/src/index.js — Server Entry Point
// Purpose: Start the order-service HTTP server.
// ──────────────────────────────────────────────────────────────

import { app } from './app.js';
import { config } from './config.js';
import { logger } from './lib/logger.js';

const PORT = config.ORDER_SERVICE_PORT;

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, 'order-service started');
});

function gracefulShutdown(signal) {
  logger.info({ signal }, 'Received shutdown signal, closing server');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
