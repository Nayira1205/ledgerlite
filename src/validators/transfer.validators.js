const Joi = require('joi');
const { LIMITS } = require('../utils/money');

// Only these three fields are accepted. Anything else (for example a "fromUserId" trying to
// send money from someone else's wallet) is rejected: the sender is ALWAYS the logged-in user.
const transferSchema = Joi.object({
  toEmail: Joi.string().trim().lowercase().email().max(254).required(),
  // `.strict()`: the string "100" is rejected instead of silently becoming the number 100.
  amountPaise: Joi.number()
    .strict()
    .integer()
    .min(LIMITS.MIN_TRANSFER_PAISE)
    .max(LIMITS.MAX_TRANSFER_PAISE)
    .required(),
  note: Joi.string().trim().max(140).allow('').optional(),
});

module.exports = { transferSchema };