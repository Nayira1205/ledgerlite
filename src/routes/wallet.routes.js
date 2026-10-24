const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { demoFundSchema } = require('../validators/wallet.validators');
const controller = require('../controllers/wallet.controller');

const router = express.Router();

// Every wallet route requires a logged-in user. This runs BEFORE validation,
// so anonymous callers get 401 and never see validation details.
router.use(authenticate);

// GET /api/v1/wallet
router.get('/', asyncHandler(controller.getWallet));

// POST /api/v1/wallet/demo-funds
router.post('/demo-funds', validate(demoFundSchema), asyncHandler(controller.demoFund));

module.exports = router;