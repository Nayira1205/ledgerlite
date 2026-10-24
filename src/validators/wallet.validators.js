const Joi = require('joi');
const { LIMITS } = require('../utils/money');

// `.strict()` turns OFF Joi's automatic conversion, so the string "100" is rejected
// instead of being quietly turned into the number 100. Money input must be exact.
const demoFundSchema = Joi.object({
  amountPaise: Joi.number()
    .strict()
    .integer()
    .min(LIMITS.MIN_TRANSFER_PAISE)
    .max(LIMITS.MAX_DEMO_FUND_PAISE)
    .required(),
});

module.exports = { demoFundSchema };