// MongoDB connection (through Mongoose).
const mongoose = require('mongoose');
const config = require('./env');
const logger = require('../utils/logger');

// Build indexes (like the unique email index) automatically while developing.
// In production you would create indexes deliberately, not on every start.
mongoose.set('autoIndex', !config.isProduction);

async function connectDb() {
  // Fail fast (5s) if the database is not reachable, instead of hanging.
  await mongoose.connect(config.mongodbUri, {
    serverSelectionTimeoutMS: 5000,
    // Workaround for a driver 7.6+ bug under Jest (NODE-7832): hand the driver `os` explicitly.
    runtimeAdapters: { os: require('os') },
  });
  logger.info('MongoDB connected');
}

async function disconnectDb() {
  await mongoose.disconnect();
}

module.exports = { connectDb, disconnectDb };
