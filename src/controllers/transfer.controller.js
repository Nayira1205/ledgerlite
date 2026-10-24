const transferService = require('../services/transfer.service');

// POST /api/v1/transfers - send demo money to another user, identified by email.
// Responds with the transaction and the SENDER's new wallet balance.
async function createTransfer(req, res) {
  const { transaction, fromWallet } = await transferService.transfer({
    sender: req.user,
    toEmail: req.body.toEmail,
    amountPaise: req.body.amountPaise,
    note: req.body.note,
  });
  res.status(201).json({ transaction, wallet: fromWallet });
}

module.exports = { createTransfer };