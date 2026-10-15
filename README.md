# LedgerLite

A **simulated INR digital wallet backend** built with Node.js, Express and MongoDB as a learning / portfolio project.

> **This is a demo.** There is no real money, no real bank, card or payment gateway. All funds are **demo funds** added through an explicitly enabled demo mode. Demo balances must never be treated as real deposits.

## Status

Milestone 2 (database and authentication) - code written, awaiting verification on the developer's machine. See the full design in [docs/MILESTONE-0-PLAN.md](docs/MILESTONE-0-PLAN.md).

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

## API so far (base path `/api/v1`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/health` | no | Liveness check |
| POST | `/auth/register` | no | Create an account `{name, email, password}` |
| POST | `/auth/login` | no | Returns a JWT `{token, tokenType, expiresIn, user}` |
| GET | `/me` | Bearer token | Current user |

Errors always look like `{"error":{"code","message","details"}}`.

## Tests

Auth tests need the database running (`npm run db:up`). They use a separate `ledgerlite_test` database and fixed test settings, never your `.env`.

## Project structure

```
src/
  app.js            Express app (no listening, so tests can use it)
  server.js         Starts the HTTP server
  config/           env.js (validated settings), db.js (MongoDB connection)
  models/           Mongoose schemas (User)
  routes/           URL -> handler mapping
  controllers/      HTTP in/out only
  services/         Business rules (register, login)
  middleware/       authenticate (JWT), validate (Joi), error handler
  validators/       Joi request schemas
  utils/            Logger, AppError, token (JWT), asyncHandler
tests/              Jest + Supertest tests
docs/               Design documents
```

## Roadmap

- [x] Milestone 0 - Requirements and design
- [x] Milestone 1 - Project setup and GitHub
- [ ] Milestone 2 - Database and authentication (code written, not yet verified)
- [ ] Milestone 3 - Wallet and ledger
- [ ] Milestone 4 - Idempotency, concurrency, API tests, OpenAPI
- [ ] Milestone 5 - Optional React interface
- [ ] Milestone 6 - Redis caching and rate limiting
- [ ] Milestone 7 - RabbitMQ notifications (outbox)
- [ ] Milestone 8 - Docker and CI
- [ ] Milestone 9 - AWS EC2 deployment and k6 performance tests

## Security notes

- Secrets live in `.env` (git-ignored). Only `.env.example` is committed.
- MongoDB, Redis and RabbitMQ must never be exposed to the public internet.
