const walletService = require('../services/wallet.service');

// GET /api/v1/wallet - the logged-in user's wallet and balance.
// The user id comes from the verified token (req.user), never from the URL or body,
// so a user can only ever read their OWN wallet.
async function getWallet(req, res) {
  const wallet = await walletService.ensureUserWallet(req.user._id);
  res.status(200).json({ wallet });
}

// POST /api/v1/wallet/demo-funds - add SIMULATED money to your own wallet.
async function demoFund(req, res) {
  const { transaction, toWallet } = await walletService.demoFund({
    userId: req.user._id,
    amountPaise: req.body.amountPaise,
  });
  res.status(201).json({ transaction, wallet: toWallet });
}

module.exports = { getWallet, demoFund };