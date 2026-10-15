// Runs BEFORE every test file (see "setupFiles" in package.json).
// Tests use these fixed values and never read your personal .env file, so they behave
// the same on every machine. The test database is a separate database from development.
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.DEMO_MODE = 'true';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.MONGODB_URI =
  process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/ledgerlite_test?replicaSet=rs0';
process.env.JWT_SECRET = 'test-only-secret-test-only-secret-1234567890';
process.env.JWT_EXPIRES_IN = '1h';
process.env.BCRYPT_ROUNDS = '4'; // low cost = fast tests (production default is 12)
