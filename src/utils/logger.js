// One shared logger for the whole app. pino writes structured JSON logs
// (easy to search in Docker/EC2). In development we pretty-print them for humans.
const pino = require('pino');
const config = require('../config/env');

const options = {
  level: config.isTest ? 'silent' : config.logLevel,
  // Never log credentials if a request ever contains them.
  redact: ['req.headers.authorization', 'req.headers.cookie'],
};

if (config.nodeEnv === 'development') {
  options.transport = { target: 'pino-pretty', options: { colorize: true } };
}

module.exports = pino(options);
