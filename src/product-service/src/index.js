// ──────────────────────────────────────────────────────────────
// src/product-service/src/index.js — Server Entry Point
// Purpose: Start the product-service HTTP server.
// ──────────────────────────────────────────────────────────────

import { app } from './app.js';
import { config } from './config.js';
import { logger } from './lib/logger.js';

const PORT = config.PRODUCT_SERVICE_PORT;

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, 'product-service started');
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
