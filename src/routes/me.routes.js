const express = require('express');
const { authenticate } = require('../middleware/auth');
const controller = require('../controllers/auth.controller');

const router = express.Router();

// GET /api/v1/me  (requires a valid Bearer token)
router.get('/', authenticate, controller.me);

module.exports = router;
