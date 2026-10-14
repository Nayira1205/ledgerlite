// Entry point: starts the HTTP server.
const app = require('./app');
const config = require('./config/env');
const logger = require('./utils/logger');

const server = app.listen(config.port, () => {
  logger.info(
    { port: config.port, env: config.nodeEnv, demoMode: config.demoMode },
    'LedgerLite API listening (simulated demo wallet - no real money)'
  );
});

// Graceful shutdown: stop accepting new requests, let current ones finish, then exit.
function shutdown(signal) {
  logger.info({ signal }, 'Shutting down');
  server.close(() => process.exit(0));
  // Safety net: force exit if something hangs.
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
