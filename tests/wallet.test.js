const request = require('supertest');
const app = require('../src/app');
const { connectTestDb, clearAllCollections, disconnectTestDb } = require('./helpers/db');
const { registerAndLogin } = require('./helpers/auth');
const { Wallet } = require('../src/models');
const walletService = require('../src/services/wallet.service');

beforeAll(connectTestDb);
afterEach(clearAllCollections);
afterAll(disconnectTestDb);

const getWallet = (token) => request(app).get('/api/v1/wallet').set('Authorization', `Bearer ${token}`);

describe('wallet creation', () => {
  it('registration creates a wallet with a zero balance', async () => {
    const { user } = await registerAndLogin();

    // Checked directly in the database, before anyone has called GET /wallet.
    expect(await Wallet.countDocuments({ userId: user.id })).toBe(1);
  });

  it('GET /wallet creates a missing wallet instead of failing', async () => {
    const { token, user } = await registerAndLogin();
    await Wallet.deleteMany({ userId: user.id });

    const res = await getWallet(token);

    expect(res.status).toBe(200);
    expect(await Wallet.countDocuments({ userId: user.id })).toBe(1);
  });

  it('ensureUserWallet is safe when called many times at once', async () => {
    const { user } = await registerAndLogin();

    const wallets = await Promise.all(
      Array.from({ length: 5 }, () => walletService.ensureUserWallet(user.id))
    );

    expect(new Set(wallets.map((w) => String(w._id))).size).toBe(1);
    expect(await Wallet.countDocuments({ userId: user.id })).toBe(1);
  });

  it('ensureFaucetWallet creates exactly one faucet wallet, even when called at once', async () => {
    await Promise.all(Array.from({ length: 5 }, () => walletService.ensureFaucetWallet()));

    expect(await Wallet.countDocuments({ type: 'SYSTEM_DEMO_FAUCET' })).toBe(1);
  });
});

describe('GET /api/v1/wallet', () => {
  it('returns the balance in paise, formatted rupees and a demo flag', async () => {
    const { token } = await registerAndLogin();

    const res = await getWallet(token);

    expect(res.status).toBe(200);
    expect(res.body.wallet.balancePaise).toBe(0);
    expect(res.body.wallet.balanceFormatted).toBe('\u20B90.00');
    expect(res.body.wallet.currency).toBe('INR');
    expect(res.body.wallet.isDemo).toBe(true);
  });

  it('requires a logged-in user', async () => {
    const res = await request(app).get('/api/v1/wallet');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('gives each user their own wallet', async () => {
    const alice = await registerAndLogin();
    const bob = await registerAndLogin();

    const aliceWallet = (await getWallet(alice.token)).body.wallet;
    const bobWallet = (await getWallet(bob.token)).body.wallet;

    expect(aliceWallet.id).not.toBe(bobWallet.id);
    expect(aliceWallet.userId).toBe(alice.user.id);
    expect(bobWallet.userId).toBe(bob.user.id);
  });
});