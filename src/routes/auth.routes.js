const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { registerSchema, loginSchema } = require('../validators/auth.validators');
const controller = require('../controllers/auth.controller');

const router = express.Router();

// POST /api/v1/auth/register
router.post('/register', validate(registerSchema), asyncHandler(controller.register));
// POST /api/v1/auth/login
router.post('/login', validate(loginSchema), asyncHandler(controller.login));

module.exports = router;
