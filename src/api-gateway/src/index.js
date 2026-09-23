// ──────────────────────────────────────────────────────────────
// src/api-gateway/src/index.js — Server Entry Point
// Purpose: Start the API gateway HTTP server.
// ──────────────────────────────────────────────────────────────

import { app } from './app.js';
import { config } from './config.js';
import { logger } from './lib/logger.js';

const PORT = config.API_GATEWAY_PORT;

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, 'api-gateway started');
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
