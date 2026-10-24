// Business logic for accounts. Controllers handle HTTP; this file handles the rules.
const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const AppError = require('../utils/AppError');
const config = require('../config/env');
const walletService = require('./wallet.service');
const { signToken } = require('../utils/token');

// A real bcrypt hash of a throwaway password. When a login email does not exist we still
// compare against this, so "unknown email" and "wrong password" take about the same time.
// Otherwise an attacker could measure response times to discover which emails are registered.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', config.bcryptRounds);

async function register({ name, email, password }) {
  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);

  let user;
  try {
    user = await User.create({ name, email, passwordHash });
  } catch (err) {
    // 11000 = MongoDB "duplicate key": the unique email index rejected the insert.
    // Checking this (instead of "find, then insert") is safe when two requests race.
    if (err.code === 11000) {
      throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
    }
    throw err;
  }

  // Every user gets a wallet with a zero balance. If this step ever failed, the user would
  // exist without a wallet, but GET /wallet creates a missing wallet, so it heals itself.
  await walletService.ensureUserWallet(user._id);
  return user;
}

async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');
  const passwordMatches = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);

  // One generic message for both failures: never reveal which part was wrong.
  if (!user || !passwordMatches) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  return { token: signToken(user._id), user };
}

module.exports = { register, login };
