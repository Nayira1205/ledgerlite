const request = require('supertest');
const app = require('../src/app');
const { connectTestDb, clearAllCollections, disconnectTestDb } = require('./helpers/db');
const { registerAndLogin } = require('./helpers/auth');
const { Wallet, Transaction, LedgerEntry } = require('../src/models');
const walletService = require('../src/services/wallet.service');
const { LIMITS } = require('../src/utils/money');

beforeAll(connectTestDb);
beforeEach(() => walletService.ensureFaucetWallet());
afterEach(clearAllCollections);
afterAll(disconnectTestDb);

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const transfer = (token, body) => request(app).post('/api/v1/transfers').set(auth(token)).send(body);
const balanceOf = async (token) =>
  (await request(app).get('/api/v1/wallet').set(auth(token))).body.wallet.balancePaise;

// Gives a user demo money through the real API, so each test starts from a known balance.
async function fundUser(token, amountPaise) {
  const res = await request(app)
    .post('/api/v1/wallet/demo-funds')
    .set(auth(token))
    .send({ amountPaise });
  expect(res.status).toBe(201);
}

// A fresh pair of users: Alice has 10,000 paise (Rs 100), Bob has nothing.
async function aliceAndBob(aliceBalance = 10000) {
  const alice = await registerAndLogin({ name: 'Alice' });
  const bob = await registerAndLogin({ name: 'Bob' });
  if (aliceBalance > 0) await fundUser(alice.token, aliceBalance);
  return { alice, bob };
}

describe('POST /api/v1/transfers - success', () => {
  it('moves money from the sender to the recipient', async () => {
    const { alice, bob } = await aliceAndBob(100000);

    const res = await transfer(alice.token, { toEmail: bob.email, amountPaise: 25000 });

    expect(res.status).toBe(201);
    expect(res.body.transaction.type).toBe('TRANSFER');
    expect(res.body.transaction.status).toBe('SUCCEEDED');
    expect(res.body.transaction.amountPaise).toBe(25000);
    expect(res.body.transaction.reference).toMatch(/^TXN-/);
    expect(res.body.wallet.balancePaise).toBe(75000); // the sender's new balance
    expect(await balanceOf(alice.token)).toBe(75000);
    expect(await balanceOf(bob.token)).toBe(25000);
  });

  it('writes a balanced DEBIT and CREDIT and never creates or destroys money', async () => {
    const { alice, bob } = await aliceAndBob(100000);

    const res = await transfer(alice.token, { toEmail: bob.email, amountPaise: 25000 });

    const entries = await LedgerEntry.find({ transactionId: res.body.transaction.id }).lean();
    const debit = entries.find((e) => e.direction === 'DEBIT');
    const credit = entries.find((e) => e.direction === 'CREDIT');
    const aliceWallet = await Wallet.findOne({ userId: alice.user.id });
    const bobWallet = await Wallet.findOne({ userId: bob.user.id });

    expect(entries).toHaveLength(2);
    expect(debit.amount).toBe(credit.amount);
    expect(String(debit.walletId)).toBe(String(aliceWallet._id));
    expect(String(credit.walletId)).toBe(String(bobWallet._id));
    expect(debit.balanceAfter).toBe(75000);
    expect(credit.balanceAfter).toBe(25000);

    // Faucet (-100000) + Alice (75000) + Bob (25000) = 0: nothing appeared or vanished.
    const [{ total }] = await Wallet.aggregate([{ $group: { _id: null, total: { $sum: '$balance' } } }]);
    expect(total).toBe(0);
  });

  it('accepts the recipient email in any letter case', async () => {
    const { alice, bob } = await aliceAndBob();

    const res = await transfer(alice.token, { toEmail: bob.email.toUpperCase(), amountPaise: 1000 });

    expect(res.status).toBe(201);
    expect(await balanceOf(bob.token)).toBe(1000);
  });

  it('allows sending the exact full balance', async () => {
    const { alice, bob } = await aliceAndBob(10000);

    const res = await transfer(alice.token, { toEmail: bob.email, amountPaise: 10000 });

    expect(res.status).toBe(201);
    expect(await balanceOf(alice.token)).toBe(0);
    expect(await balanceOf(bob.token)).toBe(10000);
  });

  it('stores the note on the transaction', async () => {
    const { alice, bob } = await aliceAndBob();

    const res = await transfer(alice.token, { toEmail: bob.email, amountPaise: 1000, note: 'lunch' });

    expect(res.status).toBe(201);
    expect(res.body.transaction.note).toBe('lunch');
  });
});

describe('POST /api/v1/transfers - rejected, and NOTHING changes', () => {
  it('refuses when the balance is too low, and moves no money', async () => {
    const { alice, bob } = await aliceAndBob(10000);

    const res = await transfer(alice.token, { toEmail: bob.email, amountPaise: 20000 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INSUFFICIENT_FUNDS');
    expect(await balanceOf(alice.token)).toBe(10000);
    expect(await balanceOf(bob.token)).toBe(0);
    expect(await Transaction.countDocuments({ type: 'TRANSFER' })).toBe(0);
  });

  it('refuses a transfer to yourself', async () => {
    const { alice } = await aliceAndBob();

    const res = await transfer(alice.token, { toEmail: alice.email, amountPaise: 1000 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('SELF_TRANSFER');
    expect(await balanceOf(alice.token)).toBe(10000);
  });

  it('refuses an unknown recipient', async () => {
    const { alice } = await aliceAndBob();

    const res = await transfer(alice.token, { toEmail: 'nobody@example.com', amountPaise: 1000 });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('RECIPIENT_NOT_FOUND');
    expect(await balanceOf(alice.token)).toBe(10000);
  });

  it.each([
    ['zero', { amountPaise: 0 }],
    ['negative', { amountPaise: -100 }],
    ['fractional', { amountPaise: 100.5 }],
    ['a string', { amountPaise: '100' }],
    ['below the minimum', { amountPaise: LIMITS.MIN_TRANSFER_PAISE - 1 }],
    ['above the maximum', { amountPaise: LIMITS.MAX_TRANSFER_PAISE + 1 }],
    ['null', { amountPaise: null }],
    ['missing', {}],
  ])('rejects an amount that is %s', async (_label, amountPart) => {
    const { alice, bob } = await aliceAndBob();

    const res = await transfer(alice.token, { toEmail: bob.email, ...amountPart });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await balanceOf(alice.token)).toBe(10000);
    expect(await balanceOf(bob.token)).toBe(0);
  });

  it.each([
    ['an invalid recipient email', { toEmail: 'not-an-email', amountPaise: 1000 }],
    ['a missing recipient', { amountPaise: 1000 }],
  ])('rejects %s', async (_label, body) => {
    const { alice } = await aliceAndBob();

    const res = await transfer(alice.token, body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('does not let the caller choose the sender', async () => {
    const { alice, bob } = await aliceAndBob();

    const res = await transfer(bob.token, {
      toEmail: bob.email,
      amountPaise: 1000,
      fromUserId: alice.user.id, // an attempt to spend Alice's money
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await balanceOf(alice.token)).toBe(10000);
  });

  it('rejects a note longer than 140 characters', async () => {
    const { alice, bob } = await aliceAndBob();

    const res = await transfer(alice.token, {
      toEmail: bob.email,
      amountPaise: 1000,
      note: 'x'.repeat(141),
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('requires a logged-in user', async () => {
    const res = await request(app)
      .post('/api/v1/transfers')
      .send({ toEmail: 'bob@example.com', amountPaise: 1000 });

    expect(res.status).toBe(401);
  });

  it('rolls back the debit when the recipient would exceed the maximum balance', async () => {
    const { alice, bob } = await aliceAndBob(10000);
    await Wallet.updateOne({ userId: bob.user.id }, { balance: LIMITS.MAX_BALANCE_PAISE - 100 });

    const res = await transfer(alice.token, { toEmail: bob.email, amountPaise: 200 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('BALANCE_LIMIT_EXCEEDED');
    // Alice was debited first, then the credit failed. The debit must have been undone.
    expect(await balanceOf(alice.token)).toBe(10000);
    expect(await Transaction.countDocuments({ type: 'TRANSFER' })).toBe(0);
  });
});

describe('simultaneous transfers', () => {
  it('can never spend more than the balance, however many requests arrive at once', async () => {
    const { alice, bob } = await aliceAndBob(10000);

    // Five requests of 4,000 paise at the same moment. Alice can afford exactly two.
    const results = await Promise.all(
      Array.from({ length: 5 }, () => transfer(alice.token, { toEmail: bob.email, amountPaise: 4000 }))
    );

    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 201, 422, 422, 422]);
    expect(await balanceOf(alice.token)).toBe(2000);
    expect(await balanceOf(bob.token)).toBe(8000);
    expect(await Transaction.countDocuments({ type: 'TRANSFER' })).toBe(2);
  });
});