// Business rules for wallets: creating them, looking them up, and demo funding.
const { Wallet } = require('../models');
const config = require('../config/env');
const AppError = require('../utils/AppError');
const withTransaction = require('../utils/withTransaction');
const { LIMITS, isValidPaise } = require('../utils/money');
const ledgerService = require('./ledger.service');

const { WALLET_TYPES } = Wallet;

// Returns the user's wallet, creating it (with a zero balance) if it does not exist yet.
//
// This is an "upsert": find-or-create in ONE atomic database operation, so it is safe
// to call many times, even at the same moment. The unique index on userId guarantees there
// can never be two wallets for one user. If two calls race and the database rejects one
// with a duplicate-key error (11000), we simply read the wallet the other call created.
async function ensureUserWallet(userId) {
  try {
    return await Wallet.findOneAndUpdate(
      { userId },
      { $setOnInsert: { type: WALLET_TYPES.USER, balance: 0, currency: 'INR' } },
      { upsert: true, new: true }
    );
  } catch (err) {
    if (err.code === 11000) {
      return Wallet.findOne({ userId });
    }
    throw err;
  }
}

// Same idea for the single system "demo faucet" wallet: the source of all demo money.
// Called when the server starts, and by tests.
async function ensureFaucetWallet() {
  try {
    return await Wallet.findOneAndUpdate(
      { type: WALLET_TYPES.SYSTEM_DEMO_FAUCET },
      { $setOnInsert: { balance: 0, currency: 'INR' } },
      { upsert: true, new: true }
    );
  } catch (err) {
    if (err.code === 11000) {
      return Wallet.findOne({ type: WALLET_TYPES.SYSTEM_DEMO_FAUCET });
    }
    throw err;
  }
}

// Adds SIMULATED money to a user's wallet. This is not a real deposit: the money comes
// from the system faucet wallet, so the ledger still balances (faucet goes down, user goes up).
async function demoFund({ userId, amountPaise }) {
  if (!config.demoMode) {
    throw new AppError(403, 'DEMO_MODE_DISABLED', 'Demo funding is disabled on this server');
  }
  if (!isValidPaise(amountPaise) || amountPaise > LIMITS.MAX_DEMO_FUND_PAISE) {
    throw new AppError(400, 'INVALID_AMOUNT', 'Amount is outside the allowed demo funding range');
  }

  const [userWallet, faucetWallet] = await Promise.all([
    ensureUserWallet(userId),
    ensureFaucetWallet(),
  ]);

  return withTransaction((session) =>
    ledgerService.postTransaction(session, {
      type: ledgerService.TRANSACTION_TYPES.DEMO_FUNDING,
      fromWalletId: faucetWallet._id,
      toWalletId: userWallet._id,
      amountPaise,
      initiatedBy: userId,
      note: 'Demo funds (simulated, not a real deposit)',
      enforceSenderBalance: false, // only the faucet may go negative
    })
  );
}

module.exports = { ensureUserWallet, ensureFaucetWallet, demoFund };