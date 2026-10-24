const crypto = require('crypto');
const mongoose = require('mongoose');
const { isValidPaise } = require('../utils/money');

const TRANSACTION_TYPES = Object.freeze({
  TRANSFER: 'TRANSFER',
  DEMO_FUNDING: 'DEMO_FUNDING',
});

const TRANSACTION_STATUSES = Object.freeze({
  PENDING: 'PENDING', // reserved for asynchronous flows; not used by v1 transfers
  SUCCEEDED: 'SUCCEEDED', // money moved and the ledger is written
  FAILED: 'FAILED',
});

// `immutable: true` means a field cannot be changed after the record is created.
// A financial record that can be quietly edited later is not a reliable record.
const transactionSchema = new mongoose.Schema(
  {
    reference: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      default: () => `TXN-${crypto.randomUUID()}`,
    },
    type: { type: String, enum: Object.values(TRANSACTION_TYPES), required: true, immutable: true },
    status: { type: String, enum: Object.values(TRANSACTION_STATUSES), required: true },
    amount: {
      type: Number,
      required: true,
      immutable: true,
      validate: { validator: isValidPaise, message: 'amount must be a positive whole number of paise' },
    },
    fromWalletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', required: true, immutable: true },
    toWalletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', required: true, immutable: true },
    initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    note: { type: String, trim: true, maxlength: 140 },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = String(ret._id);
        ret.amountPaise = ret.amount;
        delete ret._id;
        delete ret.__v;
        delete ret.amount;
        return ret;
      },
    },
  }
);

// Defence in depth: the transfer service already blocks self-transfers, but the model
// refuses them too, so a future bug cannot create one.
transactionSchema.pre('validate', function checkDifferentWallets() {
  if (this.fromWalletId && this.toWalletId && this.fromWalletId.equals(this.toWalletId)) {
    this.invalidate('toWalletId', 'must be different from fromWalletId');
  }
});

// Indexes make "show my history, newest first" fast later (Milestone 4).
transactionSchema.index({ fromWalletId: 1, createdAt: -1 });
transactionSchema.index({ toWalletId: 1, createdAt: -1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
module.exports.TRANSACTION_TYPES = TRANSACTION_TYPES;
module.exports.TRANSACTION_STATUSES = TRANSACTION_STATUSES;