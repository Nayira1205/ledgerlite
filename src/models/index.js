// One place that loads every model, so `require('./models')` registers them all.
const User = require('./user.model');
const Wallet = require('./wallet.model');
const Transaction = require('./transaction.model');
const LedgerEntry = require('./ledgerEntry.model');

// Creates each collection and its indexes BEFORE we serve requests.
// This matters for MongoDB transactions: collections and unique indexes should already
// exist when a transaction starts, instead of being created in the middle of one.
async function initModels() {
  await Promise.all([User, Wallet, Transaction, LedgerEntry].map((model) => model.init()));
}

module.exports = { User, Wallet, Transaction, LedgerEntry, initModels };