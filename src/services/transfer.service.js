// Wallet-to-wallet transfers. This file decides WHETHER a transfer is allowed;
// the ledger service does the actual, atomic movement of money.
const { User } = require('../models');
const AppError = require('../utils/AppError');
const withTransaction = require('../utils/withTransaction');
const { LIMITS, isValidPaise } = require('../utils/money');
const walletService = require('./wallet.service');
const ledgerService = require('./ledger.service');

// `sender` is the logged-in user (from the verified token), never taken from the request body.
async function transfer({ sender, toEmail, amountPaise, note }) {
  // The API already validated these. Money code re-checks anyway.
  if (
    !isValidPaise(amountPaise) ||
    amountPaise < LIMITS.MIN_TRANSFER_PAISE ||
    amountPaise > LIMITS.MAX_TRANSFER_PAISE
  ) {
    throw new AppError(400, 'INVALID_AMOUNT', 'Amount is outside the allowed transfer range');
  }

  const recipientEmail = toEmail.trim().toLowerCase();

  // Cheap check first: no database lookup needed to know this is a transfer to yourself.
  if (recipientEmail === sender.email) {
    throw new AppError(422, 'SELF_TRANSFER', 'You cannot transfer money to yourself');
  }

  const recipient = await User.findOne({ email: recipientEmail });
  if (!recipient) {
    throw new AppError(404, 'RECIPIENT_NOT_FOUND', 'No account found for that email');
  }
  if (recipient._id.equals(sender._id)) {
    throw new AppError(422, 'SELF_TRANSFER', 'You cannot transfer money to yourself');
  }

  const [senderWallet, recipientWallet] = await Promise.all([
    walletService.ensureUserWallet(sender._id),
    walletService.ensureUserWallet(recipient._id),
  ]);

  // Everything below happens in ONE database transaction: debit, credit, the transaction
  // record and both ledger entries are all saved together, or none of them is.
  return withTransaction((session) =>
    ledgerService.postTransaction(session, {
      type: ledgerService.TRANSACTION_TYPES.TRANSFER,
      fromWalletId: senderWallet._id,
      toWalletId: recipientWallet._id,
      amountPaise,
      initiatedBy: sender._id,
      note: note || undefined,
      enforceSenderBalance: true, // the sender can NEVER spend more than they have
    })
  );
}

module.exports = { transfer };