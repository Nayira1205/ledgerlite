const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { transferSchema } = require('../validators/transfer.validators');
const controller = require('../controllers/transfer.controller');

const router = express.Router();

// Logged-in users only. Authentication runs BEFORE validation.
router.use(authenticate);

// POST /api/v1/transfers
router.post('/', validate(transferSchema), asyncHandler(controller.createTransfer));

module.exports = router;