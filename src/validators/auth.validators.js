const Joi = require('joi');

// Joi rejects unknown fields by default. That matters: a client cannot sneak in
// extra fields like { "role": "admin" } and have them saved.

// bcrypt only uses the first 72 bytes of a password, so we cap the length there.
const password = Joi.string().min(8).max(72).required();
const email = Joi.string().trim().lowercase().email().max(254).required();

const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(60).required(),
  email,
  password,
});

// Login does not enforce a minimum length: we only check the credentials.
const loginSchema = Joi.object({
  email,
  password: Joi.string().max(72).required(),
});

module.exports = { registerSchema, loginSchema };
