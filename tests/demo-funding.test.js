const request = require('supertest');
const app = require('../src/app');
const config = require('../src/config/env');
const { connectTestDb, clearAllCollections, disconnectTestDb } = require('./helpers/db');
const { registerAndLogin } = require('./helpers/auth');
const { Wallet, Transaction, LedgerEntry } = require('../src/models');
const walletService = require('../src/services/wallet.service');
const { LIMITS } = require('../src/utils/money');

beforeAll(connectTestDb);
// The faucet wallet is created when the server starts; tests create it themselves.
beforeEach(() => walletService.ensureFaucetWallet());
afterEach(async () => {
  config.demoMode = true; // some tests switch demo mode off; always switch it back on
  await clearAllCollections();
});
afterAll(disconnectTestDb);

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const fund = (token, body) => request(app).post('/api/v1/wallet/demo-funds').set(auth(token)).send(body);
const myBalance = async (token) =>
  (await request(app).get('/api/v1/wallet').set(auth(token))).body.wallet.balancePaise;
const faucetBalance = async () => (await Wallet.findOne({ type: 'SYSTEM_DEMO_FAUCET' })).balance;

describe('POST /api/v1/wallet/demo-funds', () => {
  it('adds demo funds and returns the transaction and the new balance', async () => {
    const { token } = await registerAndLogin();

    const res = await fund(token, { amountPaise: 50000 });

    expect(res.status).toBe(201);
    expect(res.body.transaction.type).toBe('DEMO_FUNDING');
    expect(res.body.transaction.status).toBe('SUCCEEDED');
    expect(res.body.transaction.amountPaise).toBe(50000);
    expect(res.body.transaction.reference).toMatch(/^TXN-/);
    expect(res.body.wallet.balancePaise).toBe(50000);
    expect(await myBalance(token)).toBe(50000);
  });

  it('writes balanced ledger entries and keeps the total money in the system at zero', async () => {
    const { token, user } = await registerAndLogin();

    const res = await fund(token, { amountPaise: 50000 });

    const entries = await LedgerEntry.find({ transactionId: res.body.transaction.id }).lean();
    const debit = entries.find((e) => e.direction === 'DEBIT');
    const credit = entries.find((e) => e.direction === 'CREDIT');
    const userWallet = await Wallet.findOne({ userId: user.id });

    expect(entries).toHaveLength(2);
    expect(debit.amount).toBe(50000);
    expect(credit.amount).toBe(50000);
    expect(debit.balanceAfter).toBe(-50000); // the faucet went down...
    expect(credit.balanceAfter).toBe(50000); // ...and the user went up
    expect(String(credit.walletId)).toBe(String(userWallet._id));
    expect(await faucetBalance()).toBe(-50000);

    // Money is never created or destroyed: all wallet balances add up to exactly zero.
    const [{ total }] = await Wallet.aggregate([{ $group: { _id: null, total: { $sum: '$balance' } } }]);
    expect(total).toBe(0);
  });

  it('accumulates over several fundings, each with its own reference', async () => {
    const { token } = await registerAndLogin();

    const first = await fund(token, { amountPaise: 50000 });
    const second = await fund(token, { amountPaise: 25000 });

    expect(await myBalance(token)).toBe(75000);
    expect(second.body.transaction.reference).not.toBe(first.body.transaction.reference);
  });

  it('is refused when demo mode is switched off, and changes nothing', async () => {
    const { token } = await registerAndLogin();
    config.demoMode = false;

    const res = await fund(token, { amountPaise: 50000 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('DEMO_MODE_DISABLED');
    expect(await myBalance(token)).toBe(0);
    expect(await Transaction.countDocuments()).toBe(0);
  });

  it.each([
    ['zero', { amountPaise: 0 }],
    ['negative', { amountPaise: -100 }],
    ['fractional', { amountPaise: 100.5 }],
    ['a string', { amountPaise: '100' }],
    ['below the minimum', { amountPaise: LIMITS.MIN_TRANSFER_PAISE - 1 }],
    ['above the per-request limit', { amountPaise: LIMITS.MAX_DEMO_FUND_PAISE + 1 }],
    ['null', { amountPaise: null }],
    ['missing', {}],
  ])('rejects an amount that is %s', async (_label, body) => {
    const { token } = await registerAndLogin();

    const res = await fund(token, body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await myBalance(token)).toBe(0);
  });

  it('requires a logged-in user', async () => {
    const res = await request(app).post('/api/v1/wallet/demo-funds').send({ amountPaise: 50000 });

    expect(res.status).toBe(401);
  });

  it('rolls back EVERYTHING when the wallet would exceed the maximum balance', async () => {
    const { token, user } = await registerAndLogin();
    await Wallet.updateOne({ userId: user.id }, { balance: LIMITS.MAX_BALANCE_PAISE - 100 });

    const res = await fund(token, { amountPaise: 200 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('BALANCE_LIMIT_EXCEEDED');
    // The faucet was debited before the credit failed. The transaction must have undone that.
    expect(await faucetBalance()).toBe(0);
    expect(await Transaction.countDocuments()).toBe(0);
    expect(await LedgerEntry.countDocuments()).toBe(0);
  });

  it('handles several simultaneous fundings without losing any', async () => {
    const { token } = await registerAndLogin();

    const results = await Promise.all(
      Array.from({ length: 5 }, () => fund(token, { amountPaise: 10000 }))
    );

    expect(results.map((r) => r.status)).toEqual([201, 201, 201, 201, 201]);
    expect(await myBalance(token)).toBe(50000);
    expect(await faucetBalance()).toBe(-50000);
    expect(await Transaction.countDocuments()).toBe(5);
    expect(await LedgerEntry.countDocuments()).toBe(10);
  });
});