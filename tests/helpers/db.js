// Shared database helpers for tests that need MongoDB.
const mongoose = require('mongoose');
const config = require('../../src/config/env');
const { connectDb, disconnectDb } = require('../../src/config/db');
const { initModels } = require('../../src/models');

function assertTestDatabase() {
  // Safety: tests DELETE data. Refuse to run against anything but a *_test database.
  if (!/_test(\?|$)/.test(config.mongodbUri)) {
    throw new Error('Refusing to run: MONGODB_URI must point to a database ending in _test');
  }
}

async function connectTestDb() {
  assertTestDatabase();
  await connectDb();
  await initModels(); // make sure collections and unique indexes exist
}

// Empties every collection but keeps the indexes.
async function clearAllCollections() {
  assertTestDatabase();
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}

module.exports = { connectTestDb, clearAllCollections, disconnectTestDb: disconnectDb };