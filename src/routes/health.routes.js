const express = require('express');
const config = require('../config/env');

const router = express.Router();

// GET /api/v1/health - "is the server alive?" Used by humans, Docker and load balancers.
// Later milestones will add database / Redis status here.
router.get('/', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'ledgerlite',
    demoMode: config.demoMode,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
