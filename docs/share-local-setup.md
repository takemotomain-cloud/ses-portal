# SES Portal Shared Handoff

This repository is currently intended to be shared as source code plus setup notes.

## What Is Shared

- Source code in this ZIP
- `docker-compose.yml`
- Example environment files:
  - `apps/api/.env.example`
  - `apps/web/.env.example`

## What Is Not Shared Automatically

- Running Docker containers
- Local PostgreSQL data
- `.env` / `.env.local`
- `node_modules`

## Recommended Local Setup

1. Install dependencies at the repository root.
2. Copy environment files locally.
3. Start Docker services.
4. Start API and web locally.

## Local Environment Values

### API

Create `apps/api/.env` with at least:

```env
DATABASE_URL="postgresql://ses_dev:ses_dev_password@localhost:5433/ses_portal?schema=public"
JWT_SECRET="local-dev-jwt-secret-change-in-production-must-be-at-least-64-chars-long-for-security"
JWT_EXPIRY="24h"
PORT=3001
NODE_ENV="development"
CORS_ORIGIN="http://localhost:3002"
REDIS_URL="redis://localhost:6379"
ENCRYPTION_KEY="local-dev-encryption-key-change-in-prod"
```

### Web

Create `apps/web/.env.local` with at least:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXTAUTH_URL=http://localhost:3002
NEXTAUTH_SECRET=local-dev-nextauth-secret
```

## Docker

Start Docker services:

```bash
docker compose up -d
```

This project exposes PostgreSQL on `localhost:5433` to avoid collisions with a host PostgreSQL already using `5432`.

## Run Locally

API:

```bash
cd apps/api
node_modules/.bin/nest start --watch
```

Web:

```bash
cd apps/web
NEXTAUTH_URL=http://localhost:3002 node_modules/.bin/next dev --port 3002
```

## Before Pushing To GitHub

Run a secret check from the repository root:

```bash
npm run check:secrets
```

This scans tracked files for obvious API keys and private key material before sharing the branch.

## Preview URLs

- Web: `http://localhost:3002`
- API: `http://localhost:3001`
- Swagger: `http://localhost:3001/api/docs`

## Test Login Accounts

- Admin: `k.yamamoto@example.com` / `ChangeMe123!`
- Employee: `ses-staff@example.com` / `ChangeMe123!`
- Manager: `manager@example.com` / `ChangeMe123!`
- Member: `member@example.com` / `ChangeMe123!`

## Notes

- The Docker database already contains seeded development data.
- If login fails, confirm the API is connected to `localhost:5433`, not a host PostgreSQL on `5432`.
