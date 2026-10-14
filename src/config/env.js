// Loads environment variables from .env (if present) and validates them with Joi.
// If something is missing or wrong, the app refuses to start with a clear message,
// instead of failing mysteriously later.
require('dotenv').config({ quiet: true });
const Joi = require('joi');

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),
  // Demo funding is OFF unless explicitly enabled. It is simulated money, never a real deposit.
  DEMO_MODE: Joi.boolean().default(false),
  // Comma-separated list of browser origins allowed to call the API (CORS).
  CORS_ORIGINS: Joi.string().default('http://localhost:5173'),
}).unknown(true); // other variables on the machine (PATH, HOME, ...) are allowed

const { value, error } = schema.validate(process.env, { abortEarly: false });

if (error) {
  throw new Error(`Invalid environment configuration: ${error.message}`);
}

module.exports = {
  nodeEnv: value.NODE_ENV,
  isProduction: value.NODE_ENV === 'production',
  isTest: value.NODE_ENV === 'test',
  port: value.PORT,
  logLevel: value.LOG_LEVEL,
  demoMode: value.DEMO_MODE,
  corsOrigins: value.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
};
