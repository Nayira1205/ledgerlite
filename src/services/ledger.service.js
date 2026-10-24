// The ledger: the ONE place in the codebase that moves money between wallets.
// Demo funding and transfers both use it, so the rules cannot drift apart.
const { Wallet, Transaction, LedgerEntry } = require('../models');
const AppError = require('../utils/AppError');
const { LIMITS, isValidPaise } = require('../utils/money');

const { TRANSACTION_TYPES, TRANSACTION_STATUSES } = Transaction;
const { DIRECTIONS } = LedgerEntry;

// Moves `amountPaise` from one wallet to another and records it.
// MUST be called inside withTransaction(), and `session` must be that transaction's session.
// If anything below throws, the caller's transaction is aborted and NOTHING is saved.
async function postTransaction(
  session,
  { type, fromWalletId, toWalletId, amountPaise, initiatedBy, note, enforceSenderBalance }
) {
  // Defence in depth: the API already validated this, but money code never trusts its callers.
  if (!isValidPaise(amountPaise)) {
    throw new AppError(400, 'INVALID_AMOUNT', 'Amount must be a positive whole number of paise');
  }

  // STEP 1 - DEBIT the sender, in a single atomic update.
  // The condition `balance >= amount` is part of the update itself, so the database checks
  // and subtracts in one indivisible step. Two requests can never both spend the same money.
  // (Reading the balance first and subtracting afterwards would be a race condition.)
  // The faucet is the only sender allowed to go negative, so it skips the check.
  const debitFilter = { _id: fromWalletId };
  if (enforceSenderBalance) {
    debitFilter.balance = { $gte: amountPaise };
  }
  const debited = await Wallet.findOneAndUpdate(
    debitFilter,
    { $inc: { balance: -amountPaise } },
    { new: true, session } // `new: true` returns the wallet AFTER the update
  );
  if (!debited) {
    throw new AppError(422, 'INSUFFICIENT_FUNDS', 'Insufficient balance for this amount');
  }

  // STEP 2 - CREDIT the receiver, again atomically, refusing to exceed the maximum balance.
  const credited = await Wallet.findOneAndUpdate(
    { _id: toWalletId, balance: { $lte: LIMITS.MAX_BALANCE_PAISE - amountPaise } },
    { $inc: { balance: amountPaise } },
    { new: true, session }
  );
  if (!credited) {
    // Throwing here undoes STEP 1 as well: that is what the transaction is for.
    throw new AppError(422, 'BALANCE_LIMIT_EXCEEDED', 'This would exceed the maximum wallet balance');
  }

  // STEP 3 - RECORD the transaction (one row describing what happened).
  const [transaction] = await Transaction.create(
    [
      {
        type,
        status: TRANSACTION_STATUSES.SUCCEEDED,
        amount: amountPaise,
        fromWalletId,
        toWalletId,
        initiatedBy,
        note,
      },
    ],
    { session }
  );

  // STEP 4 - WRITE the two ledger entries: one DEBIT and one CREDIT of the same amount.
  // `balanceAfter` is the wallet balance right after each change, so history can be audited.
  await LedgerEntry.create(
    [
      {
        transactionId: transaction._id,
        walletId: fromWalletId,
        direction: DIRECTIONS.DEBIT,
        amount: amountPaise,
        balanceAfter: debited.balance,
      },
      {
        transactionId: transaction._id,
        walletId: toWalletId,
        direction: DIRECTIONS.CREDIT,
        amount: amountPaise,
        balanceAfter: credited.balance,
      },
    ],
    { session, ordered: true }
  );

  return { transaction, fromWallet: debited, toWallet: credited };
}

module.exports = { postTransaction, TRANSACTION_TYPES };