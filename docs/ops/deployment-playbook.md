# NIT Supply Chain V2 -- Deployment Playbook

> Last updated: 2026-03-12
> Service: `nit-scs-v2` | Monorepo: pnpm workspace

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Environment Variables](#2-environment-variables)
3. [Local Development Setup](#3-local-development-setup)
4. [Docker Build and Run](#4-docker-build-and-run)
5. [Render Deployment](#5-render-deployment)
6. [Database Migration Strategy](#6-database-migration-strategy)
7. [Rollback Procedures](#7-rollback-procedures)
8. [Post-Deployment Verification Checklist](#8-post-deployment-verification-checklist)

---

## 1. Prerequisites

### Required Software

| Software | Minimum Version | Purpose |
|----------|----------------|---------|
| Node.js | 20.x LTS | Runtime (matches Dockerfile `node:20-alpine`) |
| pnpm | 9.x | Package manager (workspace support) |
| PostgreSQL | 15.x | Primary database |
| Redis | 7.x | Rate limiting, caching, token blacklist, scheduler locks |
| Docker | 24.x | Container builds |
| Git | 2.x | Version control |

### Optional Software

| Software | Purpose |
|----------|---------|
| Prisma Studio | Visual database browser (`npx prisma studio`) |
| jq | JSON processing for health check scripts |
| Sentry CLI | Source map uploads for error tracking |

### Accounts and Services

| Service | Required | Purpose |
|---------|----------|---------|
| Render | Production hosting | Web service + managed PostgreSQL |
| Upstash | Recommended | Managed Redis (free tier: 10k commands/day) |
| Sentry | Optional | Error monitoring and performance tracing |
| Resend | Optional | Transactional email delivery |

---

## 2. Environment Variables

### Required Variables

| Variable | Example | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db` | PostgreSQL connection string. Append `?connection_limit=20&pool_timeout=10` for production. |
| `JWT_SECRET` | (32+ character random string) | Secret for signing JWT access tokens. Must be at least 32 characters. |
| `JWT_REFRESH_SECRET` | (32+ character random string) | Secret for signing JWT refresh tokens. Must be at least 32 characters. |

### Optional Variables with Defaults

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | HTTP server listen port |
| `NODE_ENV` | `development` | Environment: `development`, `production`, or `test` |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed CORS origin. In production, set to your frontend URL. |
| `JWT_EXPIRES_IN` | `15m` | Access token expiry (e.g., `15m`, `1h`) |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token expiry (e.g., `7d`, `30d`) |
| `LOG_LEVEL` | `debug` (dev) / `info` (prod) | Pino log level: `debug`, `info`, `warn`, `error` |

### Optional Integration Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL. Use `rediss://` for TLS (Upstash). Falls back to in-memory when unavailable. |
| `SENTRY_DSN` | (none) | Sentry DSN for error tracking. Enables Sentry when set. |
| `RESEND_API_KEY` | (none) | Resend API key for email delivery. |
| `RESEND_FROM_EMAIL` | (none) | Sender email address (e.g., `noreply@yourdomain.com`). |
| `RESEND_FROM_NAME` | `NIT Logistics` | Display name for outgoing emails. |
| `RESEND_WEBHOOK_SECRET` | (none) | Webhook signing secret for Resend delivery events. |
| `VAPID_PUBLIC_KEY` | (auto-generated in dev) | Web Push VAPID public key. |
| `VAPID_PRIVATE_KEY` | (auto-generated in dev) | Web Push VAPID private key. |
| `VAPID_SUBJECT` | `mailto:admin@nit-scs.com` | VAPID subject (contact email). |
| `AI_ENABLED` | `false` | Set to `true` to enable the optional AI module. |
| `SEED_ADMIN_PASSWORD` | `Admin@2026!` | Admin user password for database seeding. |

### Frontend Variables (Vite)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:4000/api/v1` | Backend API base URL |
| `VITE_WS_URL` | `http://localhost:4000` | Socket.IO WebSocket URL |
| `VITE_SENTRY_DSN` | (none) | Frontend Sentry DSN |

### Generating Secrets

```bash
# Generate a random JWT secret (64 chars)
openssl rand -base64 48

# Generate VAPID keys
cd packages/backend
node -e "const wp = require('web-push'); const k = wp.generateVAPIDKeys(); console.log(JSON.stringify(k, null, 2))"
```

---

## 3. Local Development Setup

### Step 1: Clone and Install

```bash
git clone <repository-url> V2
cd V2
pnpm install
```

### Step 2: Start Infrastructure

```bash
# Start PostgreSQL and Redis via Docker Compose
docker compose up -d

# Verify services are running
docker compose ps
# postgres: healthy on port 5433
# redis: healthy on port 6379
```

Note: PostgreSQL is mapped to port `5433` (not the default 5432) to avoid conflicts with any locally installed PostgreSQL.

### Step 3: Configure Environment

```bash
cp .env.example .env
# Edit .env if needed -- defaults work for local development
```

### Step 4: Initialize Database

```bash
cd packages/backend

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed the database
pnpm prisma:seed
```

### Step 5: Start Development Servers

```bash
# Terminal 1: Backend (port 4000, hot-reload via tsx)
cd packages/backend
pnpm dev

# Terminal 2: Frontend (port 3000, Vite HMR)
cd packages/frontend
pnpm dev
```

### Step 6: Verify

- Backend API: `http://localhost:4000/api/health`
- Frontend: `http://localhost:3000`
- API Docs (Swagger): `http://localhost:4000/api/docs`
- Prisma Studio: `cd packages/backend && npx prisma studio`

### Default Login Credentials

| Email | Password | Role |
|-------|----------|------|
| `admin@nit-scs.com` | `Admin@2026!` | admin |

---

## 4. Docker Build and Run

### Build the Image

The Dockerfile uses a multi-stage build:

1. **deps** -- installs all pnpm dependencies with frozen lockfile
2. **build** -- compiles shared, frontend, and backend packages
3. **runtime** -- minimal Alpine image with compiled output only

```bash
# From the repository root
docker build -t nit-scs-v2 -f packages/backend/Dockerfile .
```

Build arguments:

| Arg | Description |
|-----|-------------|
| `RENDER_GIT_COMMIT` | Git commit SHA, embedded in Sentry release tag |

```bash
docker build --build-arg RENDER_GIT_COMMIT=$(git rev-parse HEAD) \
  -t nit-scs-v2 -f packages/backend/Dockerfile .
```

### Run the Container

```bash
docker run -d --name nit-scs \
  -p 4000:4000 \
  -e DATABASE_URL="postgresql://nit_admin:nit_scs_dev_2026@host.docker.internal:5433/nit_scs" \
  -e JWT_SECRET="$(openssl rand -base64 48)" \
  -e JWT_REFRESH_SECRET="$(openssl rand -base64 48)" \
  -e REDIS_URL="redis://host.docker.internal:6379" \
  -e NODE_ENV=production \
  -e CORS_ORIGIN="http://localhost:3000" \
  nit-scs-v2
```

### Container Details

- Runs as non-root user (`nodejs:1001`)
- Writable upload directory at `/app/packages/backend/uploads`
- Exposes port `4000`
- Health check runs every 30 seconds via `wget`
- Startup script (`start.sh`): migration -> seed -> server start

---

## 5. Render Deployment

### Infrastructure (render.yaml)

The `render.yaml` blueprint defines:

- **Web Service** (`nit-scs-v2`): Docker-based, health check at `/api/health`
- **Database** (`nit-scs-v2-db`): PostgreSQL, database name `nit_scs`, user `nit_admin`

### Initial Setup

1. Connect the repository to Render
2. Create a new Blueprint Instance from `render.yaml`
3. Render auto-creates the web service and PostgreSQL database
4. `DATABASE_URL` is auto-injected from the managed database
5. `JWT_SECRET` and `JWT_REFRESH_SECRET` are auto-generated

### Required Manual Configuration

After blueprint deployment, set these in the Render dashboard:

| Variable | Where to Get It |
|----------|----------------|
| `CORS_ORIGIN` | Your frontend URL (e.g., `https://nit-scs-v2.onrender.com`) |
| `REDIS_URL` | Upstash console -> Database -> REST URL (use `rediss://` URL) |
| `SENTRY_DSN` | Sentry project settings -> Client Keys |

### Deploy Workflow

1. Push to `main` branch triggers automatic deploy
2. Render builds Docker image (multi-stage, ~5 min)
3. Container starts with `start.sh`:
   - Runs `prisma migrate deploy`
   - Runs seed script (idempotent)
   - Starts Express server
4. Render health check hits `/api/health`
5. Once healthy, traffic switches to new instance (zero-downtime)

### Monitoring Deploys

```bash
# View recent deploys
# Render Dashboard > Services > nit-scs-v2 > Events

# View logs in real-time
# Render Dashboard > Services > nit-scs-v2 > Logs
```

---

## 6. Database Migration Strategy

### Development Workflow

1. Edit `packages/backend/prisma/schema.prisma`
2. Create and apply migration:
   ```bash
   cd packages/backend
   npx prisma migrate dev --name descriptive_migration_name
   ```
3. Prisma generates a migration file in `prisma/migrations/<timestamp>_<name>/migration.sql`
4. Review the generated SQL
5. Commit both the schema change and migration file

### Production Deployment

Migrations run automatically during container startup via `start.sh`:

```bash
npx prisma migrate deploy
```

This applies only pending migrations that have not yet been recorded in the `_prisma_migrations` table. It is safe to run repeatedly.

### Migration Safety Rules

- Never use `prisma db push` in production (it skips migration history)
- Never manually modify a migration file after it has been applied
- Test migrations against a staging database before production deploy
- For destructive changes (column removal, type changes), use a two-phase approach:
  1. Phase 1: Deploy code that handles both old and new schema
  2. Phase 2: Deploy the migration that removes the old column

### Handling Failed Migrations

If `prisma migrate deploy` fails during startup:

1. The container exits with code 1
2. Render marks the deploy as failed and keeps the previous version running
3. Check the deploy logs for the error message
4. Fix the migration SQL or schema
5. Re-deploy

To manually fix a partially applied migration:

```bash
# Check migration status
cd packages/backend
DATABASE_URL="<production-url>" npx prisma migrate status

# If a migration is marked as failed, resolve it:
DATABASE_URL="<production-url>" npx prisma migrate resolve --applied "<migration_name>"
# or
DATABASE_URL="<production-url>" npx prisma migrate resolve --rolled-back "<migration_name>"
```

### Current Migration History

```
prisma/migrations/
  0000_baseline/migration.sql          -- Initial schema (all tables)
  0001_add_check_constraints/migration.sql -- Database-level check constraints
```

---

## 7. Rollback Procedures

### Rollback a Render Deploy

**Option A: Redeploy Previous Commit**

1. Render Dashboard -> Services -> nit-scs-v2 -> Events
2. Find the last successful deploy
3. Click "Redeploy" on that deploy

**Option B: Git Revert**

```bash
# Revert the problematic commit
git revert <commit-sha>
git push origin main
# Render auto-deploys the revert
```

### Rollback a Database Migration

Prisma does not support automatic rollbacks. To undo a migration:

1. Write a new migration that reverses the changes:
   ```bash
   cd packages/backend
   npx prisma migrate dev --create-only --name revert_previous_change
   ```
2. Edit the generated SQL to reverse the previous migration's changes
3. Apply and deploy

For emergency rollbacks where you need to skip a migration:

```bash
# Mark a failed migration as rolled back (does NOT undo SQL changes)
DATABASE_URL="<production-url>" npx prisma migrate resolve --rolled-back "<migration_name>"
```

### Rollback Application Code (Without DB Changes)

If the deployment only changed application code (no migration):

1. The previous Docker image is still cached on Render
2. Redeploy the previous commit from the Render dashboard
3. The `prisma migrate deploy` step will find no pending migrations and proceed

### Rollback Redis State

Redis state is ephemeral and self-healing:

- Rate limiter keys expire automatically (60 seconds default)
- Scheduler locks expire based on their TTL
- Token blacklist entries have TTL matching the token's remaining lifetime

If Redis state is corrupted, flush it: `redis-cli FLUSHALL`

---

## 8. Post-Deployment Verification Checklist

Run through this checklist after every production deployment.

### Automated Checks

```bash
# 1. Health check -- expect "healthy" (or "degraded" if Redis is warming up)
curl -s https://your-app.onrender.com/api/health | jq .status
# Expected: "healthy"

# 2. Liveness probe
curl -s https://your-app.onrender.com/api/v1/live | jq .status
# Expected: "alive"

# 3. Readiness probe
curl -s https://your-app.onrender.com/api/v1/ready | jq .status
# Expected: "ready"

# 4. API version check (any authenticated endpoint returns data)
curl -s https://your-app.onrender.com/api/v1/auth/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"email":"admin@nit-scs.com","password":"Admin@2026!"}' | jq .data.token
# Expected: a valid JWT token
```

### Manual Verification

- [ ] **Login works** -- Admin can log in through the UI
- [ ] **Navigation loads** -- All sidebar sections render without errors
- [ ] **Database connectivity** -- Open any list page (e.g., Items) and verify data loads
- [ ] **Real-time updates** -- Open two browser tabs, create a record in one, verify it appears in the other
- [ ] **Migrations applied** -- Check Render deploy logs for "Applying pending database migrations... done"
- [ ] **Scheduler running** -- Check logs for "[Scheduler] Starting background job scheduler" and "[Scheduler] All jobs registered"
- [ ] **No Sentry errors** -- Check Sentry for new error spikes in the last 15 minutes
- [ ] **No console errors** -- Open browser dev tools and check for JavaScript errors

### Performance Checks

```bash
# 5. Response time check (should be < 500ms)
time curl -s -o /dev/null -w "%{http_code} %{time_total}s" https://your-app.onrender.com/api/health

# 6. Detailed health (admin) -- check memory and latency
curl -s https://your-app.onrender.com/api/v1/health/details \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '{
    status: .status,
    dbLatency: .components.database.latencyMs,
    redisLatency: .components.redis.latencyMs,
    memory: .memory.rssMB,
    uptime: .uptime
  }'
```

### Rollback Criteria

Initiate a rollback if any of these are true:

- Health endpoint returns `unhealthy` for more than 2 minutes after deploy
- Login fails for all users
- Sentry shows a new error affecting more than 5% of requests
- Database migration failed and left the schema in an inconsistent state
- Memory usage exceeds 500 MB RSS within the first 10 minutes
