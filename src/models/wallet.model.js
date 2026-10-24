const mongoose = require('mongoose');
const { LIMITS, formatInr } = require('../utils/money');

const WALLET_TYPES = Object.freeze({
  USER: 'USER',
  SYSTEM_DEMO_FAUCET: 'SYSTEM_DEMO_FAUCET',
});

const walletSchema = new mongoose.Schema(
  {
    // Every normal wallet belongs to exactly one user. The system faucet wallet has no user.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      // `unique` = the DATABASE refuses a second wallet for the same user.
      // `sparse` = wallets WITHOUT a userId (the faucet) are left out of this index.
      unique: true,
      sparse: true,
      required() {
        return this.type === WALLET_TYPES.USER;
      },
    },
    type: {
      type: String,
      enum: Object.values(WALLET_TYPES),
      default: WALLET_TYPES.USER,
      required: true,
    },
    // Balance in INTEGER PAISE. Never rupees, never decimals.
    balance: {
      type: Number,
      default: 0,
      required: true,
      validate: {
        validator(value) {
          if (!Number.isSafeInteger(value)) return false;
          // Normal wallets can never be negative or above the limit.
          // Only the faucet is allowed to go negative (it is the source of demo money).
          if (this.type === WALLET_TYPES.USER) {
            return value >= 0 && value <= LIMITS.MAX_BALANCE_PAISE;
          }
          return true;
        },
        message: 'balance must be a whole number of paise within the allowed range',
      },
    },
    currency: { type: String, enum: ['INR'], default: 'INR', required: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = String(ret._id);
        ret.balancePaise = ret.balance;
        ret.balanceFormatted = formatInr(ret.balance);
        ret.isDemo = true; // LedgerLite is a simulation: balances are never real money
        delete ret._id;
        delete ret.__v;
        delete ret.balance;
        return ret;
      },
    },
  }
);

// There must be exactly ONE faucet wallet. This index only applies to faucet wallets,
// so a second faucet is rejected by the database itself, even in a race.
walletSchema.index(
  { type: 1 },
  { unique: true, partialFilterExpression: { type: WALLET_TYPES.SYSTEM_DEMO_FAUCET } }
);

const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;
module.exports.WALLET_TYPES = WALLET_TYPES;