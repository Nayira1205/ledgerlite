const mongoose = require('mongoose');
const { isValidPaise } = require('../utils/money');

const DIRECTIONS = Object.freeze({ DEBIT: 'DEBIT', CREDIT: 'CREDIT' });

// The LEDGER is the permanent record of every change to every wallet.
// Each transaction writes exactly two entries: a DEBIT on one wallet and a CREDIT on the
// other, for the same amount. So for every transaction: total credits - total debits = 0.
// All fields are immutable: ledger entries are never edited, only added.
const ledgerEntrySchema = new mongoose.Schema(
  {
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: true, immutable: true },
    walletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', required: true, immutable: true },
    direction: { type: String, enum: Object.values(DIRECTIONS), required: true, immutable: true },
    amount: {
      type: Number,
      required: true,
      immutable: true,
      validate: { validator: isValidPaise, message: 'amount must be a positive whole number of paise' },
    },
    // The wallet's balance right after this entry. Lets us audit the balance history.
    // Can be negative only for the faucet wallet.
    balanceAfter: {
      type: Number,
      required: true,
      immutable: true,
      validate: { validator: Number.isSafeInteger, message: 'balanceAfter must be a whole number' },
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc, ret) {
        ret.id = String(ret._id);
        ret.amountPaise = ret.amount;
        ret.balanceAfterPaise = ret.balanceAfter;
        delete ret._id;
        delete ret.__v;
        delete ret.amount;
        delete ret.balanceAfter;
        return ret;
      },
    },
  }
);

ledgerEntrySchema.index({ transactionId: 1 });
ledgerEntrySchema.index({ walletId: 1, createdAt: -1 });

const LedgerEntry = mongoose.model('LedgerEntry', ledgerEntrySchema);

module.exports = LedgerEntry;
module.exports.DIRECTIONS = DIRECTIONS;