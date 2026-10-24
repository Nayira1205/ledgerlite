// Builds the Express app but does NOT start listening. Keeping this separate from
// server.js lets tests (Supertest) use the app without opening a real network port.
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const pinoHttp = require('pino-http');

const config = require('./config/env');
const logger = require('./utils/logger');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const meRoutes = require('./routes/me.routes');
const walletRoutes = require('./routes/wallet.routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet()); // sets safer HTTP headers
app.use(cors({ origin: config.corsOrigins }));
app.use(express.json({ limit: '10kb' })); // small limit: our requests are tiny
app.use(pinoHttp({ logger })); // logs one line per request

app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/me', meRoutes);
app.use('/api/v1/wallet', walletRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;