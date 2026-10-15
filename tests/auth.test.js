const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const config = require('../src/config/env');
const { connectDb, disconnectDb } = require('../src/config/db');
const User = require('../src/models/user.model');

const validUser = {
  name: 'Alice Example',
  email: 'alice@example.com',
  password: 'correct-horse-battery',
};

const register = (body = validUser) => request(app).post('/api/v1/auth/register').send(body);
const login = (body) => request(app).post('/api/v1/auth/login').send(body);

beforeAll(async () => {
  // Safety: these tests DELETE users. Refuse to run against anything but a *_test database.
  if (!/_test(\?|$)/.test(config.mongodbUri)) {
    throw new Error('Refusing to run: MONGODB_URI must point to a database ending in _test');
  }
  await connectDb();
  await User.init(); // make sure the unique email index exists before we test it
  await User.deleteMany({});
});

afterEach(async () => {
  await User.deleteMany({});
});

afterAll(async () => {
  await disconnectDb();
});

describe('POST /api/v1/auth/register', () => {
  it('creates an account and never returns secrets', async () => {
    const res = await register();

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('alice@example.com');
    expect(res.body.user.id).toBeDefined();
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.user.password).toBeUndefined();
  });

  it('normalises the email to lowercase', async () => {
    const res = await register({ ...validUser, email: '  Alice@Example.COM ' });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('alice@example.com');
  });

  it('stores only a bcrypt hash, never the password', async () => {
    await register();
    const stored = await User.findOne({ email: validUser.email }).select('+passwordHash');

    expect(stored.passwordHash).not.toBe(validUser.password);
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('rejects a duplicate email (case-insensitive) with 409', async () => {
    await register();
    const res = await register({ ...validUser, email: 'ALICE@example.com' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('lets only one of two simultaneous registrations win', async () => {
    const results = await Promise.all([register(), register()]);
    const statuses = results.map((r) => r.status).sort();

    expect(statuses).toEqual([201, 409]);
    expect(await User.countDocuments({ email: validUser.email })).toBe(1);
  });

  it('rejects an invalid email with 400 and field details', async () => {
    const res = await register({ ...validUser, email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].field).toBe('email');
  });

  it('rejects a too-short password with 400', async () => {
    const res = await register({ ...validUser, password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('password');
  });

  it('rejects unknown fields such as role', async () => {
    const res = await register({ ...validUser, role: 'admin' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a request with no body', async () => {
    const res = await request(app).post('/api/v1/auth/register');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await register();
  });

  it('returns a token and the user for correct credentials', async () => {
    const res = await login({ email: validUser.email, password: validUser.password });

    expect(res.status).toBe(200);
    expect(res.body.tokenType).toBe('Bearer');
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user.email).toBe(validUser.email);
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects a wrong password with 401', async () => {
    const res = await login({ email: validUser.email, password: 'wrong-password-here' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('gives the SAME error for an unknown email (no user enumeration)', async () => {
    const wrongPassword = await login({ email: validUser.email, password: 'wrong-password-here' });
    const unknownEmail = await login({ email: 'nobody@example.com', password: 'whatever-123' });

    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  });
});

describe('GET /api/v1/me (protected route)', () => {
  const tokenFor = async () => {
    await register();
    const res = await login({ email: validUser.email, password: validUser.password });
    return res.body.token;
  };

  it('returns the current user for a valid token', async () => {
    const token = await tokenFor();
    const res = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(validUser.email);
  });

  it('rejects a request with no Authorization header', async () => {
    const res = await request(app).get('/api/v1/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a garbage token', async () => {
    const res = await request(app).get('/api/v1/me').set('Authorization', 'Bearer not.a.jwt');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('rejects an expired token', async () => {
    await register();
    const user = await User.findOne({ email: validUser.email });
    const expired = jwt.sign(
      { sub: String(user._id), exp: Math.floor(Date.now() / 1000) - 60 },
      config.jwtSecret
    );
    const res = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${expired}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('rejects a token signed with a different secret', async () => {
    await register();
    const user = await User.findOne({ email: validUser.email });
    const forged = jwt.sign({ sub: String(user._id) }, 'some-other-secret-that-is-long-enough-1234');
    const res = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${forged}`);

    expect(res.status).toBe(401);
  });

  it('rejects a valid token whose user no longer exists', async () => {
    const token = await tokenFor();
    await User.deleteMany({});
    const res = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });
});
