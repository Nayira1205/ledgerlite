# LedgerLite

A **simulated INR digital wallet backend** built with Node.js, Express and MongoDB as a learning / portfolio project.

> **This is a demo.** There is no real money, no real bank, card or payment gateway. All funds are **demo funds** added through an explicitly enabled demo mode. Demo balances must never be treated as real deposits.

## Status

Milestone 3 (wallets, ledger, demo funding and transfers) is complete: 101 automated tests pass. See the full design in [docs/MILESTONE-0-PLAN.md](docs/MILESTONE-0-PLAN.md).

## Requirements

- Node.js 20 or newer (developed on v22)
- npm
- Docker Desktop (runs the local MongoDB replica set)

## Quick start

```bash
npm install
cp .env.example .env      # then set JWT_SECRET in .env (see the comment inside)
npm run db:up             # starts MongoDB (one-node replica set) in Docker
npm run dev               # starts the API with auto-restart
```

Check it works:

```bash
curl http://localhost:3000/api/v1/health
# {"status":"ok","service":"ledgerlite","demoMode":true,...}
```

## Scripts

| Command | What it does |
|---------|--------------|
| `npm start` | Start the server |
| `npm run dev` | Start with auto-restart on file changes |
| `npm run lint` | Check code style and obvious mistakes (ESLint) |
| `npm test` | Run the tests (Jest + Supertest) |
| `npm run check` | Lint, then tests |
| `npm run db:up` | Start the local MongoDB replica set (Docker) |
| `npm run db:down` | Stop it (data is kept in a Docker volume) |

## API (base path `/api/v1`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/health` | no | Liveness check |
| POST | `/auth/register` | no | Create an account `{name, email, password}` |
| POST | `/auth/login` | no | Returns a JWT `{token, tokenType, expiresIn, user}` |
| GET | `/me` | Bearer token | Current user |
| GET | `/wallet` | Bearer token | Your wallet and balance |
| POST | `/wallet/demo-funds` | Bearer token | Add **demo** money `{amountPaise}` (only when `DEMO_MODE=true`) |
| POST | `/transfers` | Bearer token | Send money to another user `{toEmail, amountPaise, note?}` |

Send the token as `Authorization: Bearer <token>`.

All money is in **integer paise** (100 paise = Rs 1). Errors always look like `{"error":{"code","message","details"}}`.

### How money moves

- Every movement is one **database transaction**: debit, credit, the transaction record and two ledger entries are saved together, or none are.
- The debit only succeeds if `balance >= amount` inside the same update, so simultaneous requests can never overspend.
- Each transaction has a DEBIT and a CREDIT ledger entry. Demo money comes from a special faucet wallet (the only wallet allowed to go negative), so all balances always add up to zero.

## Tests

Tests need the database running (`npm run db:up`). They use a separate `ledgerlite_test` database and fixed test settings, never your `.env`.

## Project structure

```
src/
  app.js            Express app (no listening, so tests can use it)
  server.js         Starts the HTTP server
  config/           env.js (validated settings), db.js (MongoDB connection)
  models/           Mongoose schemas (User, Wallet, Transaction, LedgerEntry)
  routes/           URL -> handler mapping
  controllers/      HTTP in/out only
  services/         Business rules (auth, wallet, ledger, transfer)
  middleware/       authenticate (JWT), validate (Joi), error handler
  validators/       Joi request schemas
  utils/            Logger, AppError, token (JWT), money, withTransaction
tests/              Jest + Supertest tests
docs/               Design documents
```

## Roadmap

- [x] Milestone 0 - Requirements and design
- [x] Milestone 1 - Project setup and GitHub
- [x] Milestone 2 - Database and authentication
- [x] Milestone 3 - Wallet and ledger (demo funding, atomic transfers)
- [ ] Milestone 4 - Idempotency, transaction history (pagination), more concurrency tests, OpenAPI
- [ ] Milestone 5 - Optional React interface
- [ ] Milestone 6 - Redis caching and rate limiting
- [ ] Milestone 7 - RabbitMQ notifications (outbox)
- [ ] Milestone 8 - Docker and CI
- [ ] Milestone 9 - AWS EC2 deployment and k6 performance tests

## Known limitations (planned)

- A client that retries a transfer after a timeout could send it twice. Idempotency keys arrive in Milestone 4.
- No history endpoints yet (Milestone 4).
- No rate limiting yet (Milestone 6). Until then, the "recipient not found" response lets a logged-in user check whether an email is registered.

## Security notes

- Secrets live in `.env` (git-ignored). Only `.env.example` is committed.
- MongoDB, Redis and RabbitMQ must never be exposed to the public internet.