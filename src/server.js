// Entry point: connects to MongoDB, then starts the HTTP server.
const app = require('./app');
const config = require('./config/env');
const logger = require('./utils/logger');
const { initModels } = require('./models');
const { connectDb, disconnectDb } = require('./config/db');
const { ensureFaucetWallet } = require('./services/wallet.service');

let server;

async function start() {
  await connectDb();
  await initModels();
  await ensureFaucetWallet();
  server = app.listen(config.port, () => {
    logger.info(
      { port: config.port, env: config.nodeEnv, demoMode: config.demoMode },
      'LedgerLite API listening (simulated demo wallet - no real money)'
    );
  });
}

// Graceful shutdown: stop accepting new requests, let current ones finish,
// close the database connection, then exit.
function shutdown(signal) {
  logger.info({ signal }, 'Shutting down');
  // Safety net: force exit if something hangs.
  setTimeout(() => process.exit(1), 10000).unref();
  const closeDb = () => disconnectDb().finally(() => process.exit(0));
  if (server) {
    server.close(closeDb);
  } else {
    closeDb();
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start().catch((err) => {
  logger.fatal({ err }, 'Failed to start. Is MongoDB running? (npm run db:up)');
  process.exit(1);
});
