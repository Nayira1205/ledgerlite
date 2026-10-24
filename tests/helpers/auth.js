// Test helper: registers a brand-new user through the real API and logs them in.
const request = require('supertest');
const app = require('../../src/app');

let counter = 0;

async function registerAndLogin(overrides = {}) {
  counter += 1;
  const credentials = {
    name: 'Test User',
    email: `user${counter}-${Date.now()}@example.com`,
    password: 'correct-horse-battery',
    ...overrides,
  };

  const registered = await request(app).post('/api/v1/auth/register').send(credentials);
  if (registered.status !== 201) {
    throw new Error(`register failed: ${registered.status} ${JSON.stringify(registered.body)}`);
  }

  const loggedIn = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: credentials.email, password: credentials.password });

  return { token: loggedIn.body.token, user: registered.body.user, email: credentials.email };
}

module.exports = { registerAndLogin };