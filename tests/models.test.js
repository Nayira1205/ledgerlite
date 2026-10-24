const mongoose = require('mongoose');
const { connectTestDb, clearAllCollections, disconnectTestDb } = require('./helpers/db');
const { Wallet, Transaction, LedgerEntry } = require('../src/models');
const { LIMITS } = require('../src/utils/money');

const oid = () => new mongoose.Types.ObjectId();

beforeAll(connectTestDb);
afterEach(clearAllCollections);
afterAll(disconnectTestDb);

describe('Wallet model', () => {
  it('defaults to a zero INR balance for a user wallet', async () => {
    const wallet = await Wallet.create({ userId: oid() });

    expect(wallet.balance).toBe(0);
    expect(wallet.type).toBe('USER');
    expect(wallet.currency).toBe('INR');
  });

  it('shows paise, a formatted rupee value and the demo flag in JSON', async () => {
    const wallet = await Wallet.create({ userId: oid(), balance: 12345 });
    const json = wallet.toJSON();

    expect(json.balancePaise).toBe(12345);
    expect(json.balanceFormatted).toBe('\u20B9123.45');
    expect(json.isDemo).toBe(true);
    expect(json.balance).toBeUndefined();
  });

  it('rejects a fractional balance', async () => {
    await expect(new Wallet({ userId: oid(), balance: 10.5 }).validate()).rejects.toThrow();
  });

  it('rejects a negative balance on a user wallet', async () => {
    await expect(new Wallet({ userId: oid(), balance: -1 }).validate()).rejects.toThrow();
  });

  it('rejects a balance above the maximum on a user wallet', async () => {
    const tooMuch = LIMITS.MAX_BALANCE_PAISE + 1;
    await expect(new Wallet({ userId: oid(), balance: tooMuch }).validate()).rejects.toThrow();
  });

  it('allows only one wallet per user (enforced by the database)', async () => {
    const userId = oid();
    await Wallet.create({ userId });

    await expect(Wallet.create({ userId })).rejects.toMatchObject({ code: 11000 });
  });

  it('requires a userId for a user wallet', async () => {
    await expect(new Wallet({ type: 'USER' }).validate()).rejects.toThrow();
  });

  it('allows only one faucet wallet (enforced by the database)', async () => {
    await Wallet.create({ type: 'SYSTEM_DEMO_FAUCET' });

    await expect(Wallet.create({ type: 'SYSTEM_DEMO_FAUCET' })).rejects.toMatchObject({ code: 11000 });
  });

  it('lets the faucet balance go negative', async () => {
    const faucet = await Wallet.create({ type: 'SYSTEM_DEMO_FAUCET', balance: -500 });

    expect(faucet.balance).toBe(-500);
  });
});

describe('Transaction model', () => {
  const validTransaction = () => ({
    type: 'TRANSFER',
    status: 'SUCCEEDED',
    amount: 500,
    fromWalletId: oid(),
    toWalletId: oid(),
    initiatedBy: oid(),
  });

  it('generates a unique reference for each transaction', async () => {
    const first = await Transaction.create(validTransaction());
    const second = await Transaction.create(validTransaction());

    expect(first.reference).toMatch(/^TXN-/);
    expect(second.reference).not.toBe(first.reference);
  });

  it.each([
    ['zero', 0],
    ['negative', -5],
    ['fractional', 10.5],
  ])('rejects a %s amount', async (_label, amount) => {
    await expect(new Transaction({ ...validTransaction(), amount }).validate()).rejects.toThrow();
  });

  it('rejects a transaction from a wallet to itself', async () => {
    const walletId = oid();
    const tx = new Transaction({ ...validTransaction(), fromWalletId: walletId, toWalletId: walletId });

    await expect(tx.validate()).rejects.toThrow();
  });

  it('ignores attempts to change the amount after creation (immutable)', async () => {
    const tx = await Transaction.create(validTransaction());

    tx.amount = 999999;
    await tx.save();
    const reloaded = await Transaction.findById(tx._id);

    expect(reloaded.amount).toBe(500);
  });
});

describe('LedgerEntry model', () => {
  it('rejects an unknown direction', async () => {
    const entry = new LedgerEntry({
      transactionId: oid(),
      walletId: oid(),
      direction: 'SIDEWAYS',
      amount: 500,
      balanceAfter: 500,
    });

    await expect(entry.validate()).rejects.toThrow();
  });
});