# NIT Supply Chain V2 — Production Deployment Guide

> Version: 2.0.0-enterprise | Stack: React 19 + Vite 6 / Express 5 + Prisma 6
> Monorepo: `packages/shared` | `packages/backend` | `packages/frontend`
> Default backend port: **4000** | API prefix: `/api/v1`

---

## Table of Contents

1. [Pre-Deployment Checklist](#1-pre-deployment-checklist)
2. [Infrastructure Requirements](#2-infrastructure-requirements)
3. [Environment Variable Reference](#3-environment-variable-reference)
4. [Deployment Steps](#4-deployment-steps)
5. [Docker Deployment](#5-docker-deployment)
6. [Post-Deployment Verification](#6-post-deployment-verification)
7. [Monitoring & Maintenance](#7-monitoring--maintenance)
8. [Security Checklist](#8-security-checklist)
9. [Rollback Procedure](#9-rollback-procedure)
10. [Multi-Instance Scaling Notes](#10-multi-instance-scaling-notes)

---

## 1. Pre-Deployment Checklist

Run through every item before triggering a production deploy.

### Code Quality

- [ ] All tests pass: `pnpm test` (1,812+ tests across 3 packages)
- [ ] TypeScript compiles cleanly: `pnpm --filter @nit-scs-v2/backend tsc --noEmit`
- [ ] Lint passes: `pnpm lint`
- [ ] No high/critical npm vulnerabilities: `pnpm audit --audit-level=high`
- [ ] Git tag created for the release version (e.g. `v2.0.1`)
- [ ] Changelog updated

### Builds

- [ ] Shared package builds: `pnpm --filter @nit-scs-v2/shared build`
- [ ] Backend builds: `pnpm --filter @nit-scs-v2/backend build`
- [ ] Frontend builds: `pnpm --filter @nit-scs-v2/frontend build`

### Environment

- [ ] All required environment variables set (see Section 3)
- [ ] No `.env` file committed to the repository
- [ ] Secrets stored in vault / secret manager — NOT in plain text files
- [ ] SSL certificates valid and not expiring within 30 days
- [ ] `CORS_ORIGIN` is restricted to production domain(s) only
- [ ] `NODE_ENV=production` is set

### Database

- [ ] Current production database backup taken immediately before deploying
- [ ] Migration tested against a staging copy of production data
- [ ] `prisma migrate status` reviewed — no unexpected pending migrations

---

## 2. Infrastructure Requirements

### Runtime Versions

| Component  | Minimum Version | Recommended  | Notes                              |
|------------|----------------|--------------|-------------------------------------|
| Node.js    | 20.0.0 LTS     | 20.x LTS     | Matches `node:20-alpine` Dockerfile |
| pnpm       | 9.0.0          | 9.x          | Workspace support required          |
| PostgreSQL | 15.x           | 15.x         | `uuid-ossp` extension required      |
| Redis      | 7.x            | 7.x          | AOF persistence recommended         |
| Docker     | 24.x           | 24.x         | For containerised deployment        |

### Recommended Server Specs (single instance, medium load)

| Resource | Minimum | Recommended for 100+ concurrent users |
|----------|---------|----------------------------------------|
| CPU      | 2 vCPU  | 4 vCPU                                |
| RAM      | 2 GB    | 4 GB                                  |
| Disk     | 20 GB   | 50 GB SSD (uploads + WAL + backups)   |

### Network Ports

| Port | Service              | Exposure                        |
|------|----------------------|---------------------------------|
| 4000 | Backend API + SPA    | Public (via reverse proxy)      |
| 5432 | PostgreSQL           | Internal only (never expose)    |
| 6379 | Redis                | Internal only (never expose)    |
| 443  | HTTPS (Nginx)        | Public                          |
| 80   | HTTP → HTTPS redirect| Public                          |

### External Services

| Service   | Required | Purpose                                          |
|-----------|----------|--------------------------------------------------|
| PostgreSQL | Yes     | Primary datastore (123 models)                   |
| Redis      | Yes (production) | Rate limiting, JWT blacklist, BullMQ queues, scheduler locks |
| Sentry     | Recommended | Error monitoring and performance tracing     |
| Resend     | Optional | Transactional email delivery                     |
| Upstash    | Optional | Managed Redis (free tier: 10k commands/day)      |

---

## 3. Environment Variable Reference

Copy `.env.example` to `.env` and fill in all values. Never commit `.env` to git.

### Backend Variables (`packages/backend/.env` or system environment)

#### Required

| Variable               | Example Value                                   | Description                                          |
|------------------------|-------------------------------------------------|------------------------------------------------------|
| `DATABASE_URL`         | `postgresql://user:pass@host:5432/nit_scs?connection_limit=20&pool_timeout=10` | PostgreSQL connection string. Always append connection pool params in production. |
| `JWT_SECRET`           | (64-char random string)                         | Signs JWT access tokens. Min 32 chars. Must differ per environment. |
| `JWT_REFRESH_SECRET`   | (64-char random string, different from above)   | Signs JWT refresh tokens. Must differ from `JWT_SECRET`. |
| `NODE_ENV`             | `production`                                    | Activates production mode (JSON logging, strict CORS, SPA serving). |
| `PORT`                 | `4000`                                          | HTTP port the Express server listens on.             |
| `CORS_ORIGIN`          | `https://app.example.com`                       | Comma-separated allowed origins. No trailing slash.  |

#### Strongly Recommended

| Variable               | Example Value                                   | Description                                          |
|------------------------|-------------------------------------------------|------------------------------------------------------|
| `REDIS_URL`            | `redis://localhost:6379` or `rediss://...@upstash.io:6380` | Redis connection URL. Use `rediss://` for TLS (Upstash). |
| `SENTRY_DSN`           | `https://key@o0.ingest.sentry.io/0`             | Enables Sentry error tracking and performance traces.|

#### Optional

| Variable               | Default        | Description                                          |
|------------------------|----------------|------------------------------------------------------|
| `JWT_EXPIRES_IN`       | `15m`          | Access token lifetime.                               |
| `JWT_REFRESH_EXPIRES_IN` | `7d`         | Refresh token lifetime.                              |
| `DATABASE_READ_URL`    | *(unset)*      | Read-replica PostgreSQL URL. Falls back to primary if unset. |
| `RESEND_API_KEY`       | *(unset)*      | Resend API key for transactional email.              |
| `RESEND_FROM_EMAIL`    | *(unset)*      | From address for outgoing emails.                    |
| `RESEND_FROM_NAME`     | `NIT Logistics` | Display name for outgoing emails.                   |
| `RESEND_WEBHOOK_SECRET`| *(unset)*      | Webhook signature verification for Resend events.   |
| `VAPID_PUBLIC_KEY`     | *(unset)*      | Web Push VAPID public key. Generate with `node packages/backend/scripts/generate-vapid-keys.js`. |
| `VAPID_PRIVATE_KEY`    | *(unset)*      | Web Push VAPID private key. Keep secret.            |
| `VAPID_SUBJECT`        | `mailto:admin@nit-scs.com` | Contact email for Web Push.              |
| `SEED_ADMIN_PASSWORD`  | `Admin@2026!`  | Initial admin password set during `prisma:seed`. Change after first login. |
| `LOG_LEVEL`            | `info` (prod) / `debug` (dev) | Pino log level override.            |
| `QUEUE_DASHBOARD`      | `false`        | Set to `true` to enable BullMQ Arena dashboard in production at `/admin/queues`. |
| `AI_ENABLED`           | `false`        | Set to `true` to enable the AI chat/suggestions module. |
| `ANTHROPIC_API_KEY`    | *(unset)*      | Required when `AI_ENABLED=true`. Anthropic Claude API key. |
| `SENTRY_RELEASE`       | auto-detected  | Override the Sentry release identifier.             |
| `COMMIT_SHA`           | *(unset)*      | Git commit SHA, used to label the Sentry release.   |

### Frontend Variables (`packages/frontend/.env.production`)

| Variable           | Example Value                         | Description                              |
|--------------------|---------------------------------------|------------------------------------------|
| `VITE_API_URL`     | `https://api.example.com/api/v1`      | Backend API base URL (required).         |
| `VITE_WS_URL`      | `https://api.example.com`             | WebSocket server URL (required for real-time). |
| `VITE_SENTRY_DSN`  | `https://key@o0.ingest.sentry.io/0`   | Frontend Sentry DSN (optional).          |
| `VITE_AI_ENABLED`  | `true` / `false`                      | Show/hide AI features in the UI.         |
| `VITE_CDN_URL`     | `https://cdn.example.com`             | CDN base URL for static assets (optional). |

---

## 4. Deployment Steps

### 4.1 Bare-Metal / VM Deployment (without Docker)

#### Step 1 — Pull latest code and install dependencies

```bash
git pull origin main
pnpm install --frozen-lockfile
```

#### Step 2 — Build all packages in order (shared must be first)

```bash
pnpm --filter @nit-scs-v2/shared build
pnpm --filter @nit-scs-v2/backend build
pnpm --filter @nit-scs-v2/frontend build
```

The frontend Vite build picks up `VITE_*` variables from the environment or from
`packages/frontend/.env.production` at build time. Set them before running `build:frontend`.

#### Step 3 — Run database migrations

```bash
cd packages/backend

# Check current migration status before applying
npx prisma migrate status

# Apply all pending migrations — safe for production
# NEVER run `prisma migrate dev` in production
npx prisma migrate deploy
```

#### Step 4 — Seed initial data (first deployment only)

The seed script is idempotent (uses upsert). Safe to re-run but not necessary on
subsequent deploys unless reference data templates have changed.

```bash
# From packages/backend/
# Seeds: roles, permissions, admin user (admin@nit.sa / Admin@2026!),
#        document number sequences, UOMs, email templates, semantic layer
SEED_ADMIN_PASSWORD="YourStrongPassword1" npx tsx prisma/seed.ts
npx tsx prisma/seed-templates.ts
npx tsx prisma/seed-data.ts

# Or use the monorepo shortcut:
SEED_ADMIN_PASSWORD="YourStrongPassword1" pnpm db:seed
```

**Important:** Change the admin password immediately after first login.

#### Step 5 — Generate Prisma client (if not already built)

```bash
cd packages/backend
npx prisma generate
```

#### Step 6 — Configure process management with PM2

Install PM2 globally if not already present:

```bash
npm install -g pm2
```

Create `ecosystem.config.cjs` in the project root:

```javascript
module.exports = {
  apps: [
    {
      name: 'nit-scs-v2-backend',
      script: './packages/backend/dist/index.js',
      cwd: '/path/to/nit-scs-v2',
      instances: 1,          // Increase to 'max' for multi-core; see Section 10
      exec_mode: 'fork',     // Use 'cluster' for multi-instance; see Section 10
      node_args: '--max-old-space-size=1024',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      // Log output
      out_file: '/var/log/nit-scs-v2/out.log',
      error_file: '/var/log/nit-scs-v2/err.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Restart policy
      watch: false,
      max_memory_restart: '900M',
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
```

Start (first time) or reload (subsequent deploys):

```bash
# First start
pm2 start ecosystem.config.cjs

# Subsequent deploys — zero-downtime reload
pm2 reload nit-scs-v2-backend

# Save PM2 process list so it survives reboots
pm2 save
pm2 startup   # Follow the printed command to enable auto-start
```

#### Step 7 — Deploy frontend static files

```bash
# Copy built SPA to your web server document root
cp -r packages/frontend/dist/* /var/www/nit-scs-v2/
```

In production, the backend also serves the frontend SPA directly from
`packages/frontend/dist/` when `NODE_ENV=production`. A standalone Nginx is only
needed if you want to separate API and static file serving.

#### Step 8 — Nginx reverse proxy (optional but recommended)

```nginx
# /etc/nginx/sites-available/nit-scs-v2
server {
    listen 80;
    server_name app.example.com api.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.example.com;

    ssl_certificate     /etc/letsencrypt/live/app.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;

    # Security headers (Helmet adds most of these; Nginx adds HSTS)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Static SPA (served from Nginx — faster than Express for static files)
    root /var/www/nit-scs-v2;
    index index.html;

    # SPA fallback — all non-file routes serve index.html
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # Hashed Vite assets — cache forever (content-addressed filenames)
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API proxy to Express backend
    location /api/ {
        proxy_pass         http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        client_max_body_size 10m;   # Match Express 2mb JSON + multer upload limit
    }

    # WebSocket proxy for Socket.IO
    location /socket.io/ {
        proxy_pass         http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host       $host;
        proxy_read_timeout 86400s;   # Keep WS connections alive
    }
}
```

```bash
nginx -t                            # Test config before reloading
systemctl reload nginx
```

#### Step 9 — SSL/TLS with Let's Encrypt

```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d app.example.com
# Auto-renewal is set up by certbot; verify with:
certbot renew --dry-run
```

---

## 5. Docker Deployment

The repository includes a multi-stage `Dockerfile` at `packages/backend/Dockerfile`
and a `render.yaml` for one-click Render.com deployment.

### Build and Run Locally

```bash
# Build the production image (builds shared + backend + frontend in one pass)
docker build \
  --build-arg RENDER_GIT_COMMIT=$(git rev-parse --short HEAD) \
  -t nit-scs-v2:latest \
  -f packages/backend/Dockerfile \
  .

# Run with environment variables
docker run -d \
  --name nit-scs-v2 \
  -p 4000:4000 \
  -e NODE_ENV=production \
  -e DATABASE_URL="postgresql://nit_admin:pass@host:5432/nit_scs?connection_limit=20&pool_timeout=10" \
  -e REDIS_URL="redis://host:6379" \
  -e JWT_SECRET="your-64-char-secret-here" \
  -e JWT_REFRESH_SECRET="your-other-64-char-secret" \
  -e CORS_ORIGIN="https://app.example.com" \
  -e SENTRY_DSN="https://key@o0.ingest.sentry.io/0" \
  nit-scs-v2:latest
```

The container:
- Runs `prisma migrate deploy` on startup (via `start.sh`)
- Seeds the database on first run (idempotent)
- Starts the Express server on port `4000`
- Serves the built frontend SPA at the root path

### Docker Compose (development / staging)

The `docker-compose.yml` at the project root provides PostgreSQL 15 and Redis 7:

```bash
# Start supporting services
docker compose up -d

# Verify services are healthy
docker compose ps

# Connect manually to verify
docker exec -it nit-scs-db psql -U nit_admin -d nit_scs
docker exec -it nit-scs-redis redis-cli ping  # Should return PONG
```

> The compose file exposes PostgreSQL on port **5433** (not 5432) to avoid
> conflicts with a locally installed PostgreSQL.

### Render.com One-Click Deploy

A `render.yaml` at the project root configures Render automatically:

```bash
# Push to main branch — Render auto-deploys via render.yaml
git push origin main

# Or trigger a manual deploy from the Render dashboard
```

After deploying to Render, set these variables in the Render dashboard
(they are marked `sync: false` in `render.yaml` — Render will not auto-generate them):

- `CORS_ORIGIN` — your production frontend URL
- `REDIS_URL` — Upstash `rediss://` URL
- `SENTRY_DSN` — optional but recommended
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — for push notifications
- `RESEND_API_KEY` / `RESEND_FROM_EMAIL` — for email notifications

---

## 6. Post-Deployment Verification

### 6.1 Health Check Endpoints

```bash
# Basic health (public — no auth required)
# Returns: { "status": "healthy"|"degraded"|"unhealthy", "timestamp": "..." }
curl -s https://api.example.com/api/v1/health | jq .

# Liveness probe (Kubernetes-style, lightweight)
# Returns: { "status": "alive" }
curl -s https://api.example.com/api/v1/live | jq .

# Readiness probe (checks DB + Redis connectivity)
# Returns: { "status": "ready"|"not_ready" }
curl -s https://api.example.com/api/v1/ready | jq .

# Detailed health (admin JWT required — includes latency, memory, component status)
TOKEN="your-admin-jwt-token"
curl -s -H "Authorization: Bearer $TOKEN" \
  https://api.example.com/api/v1/health/details | jq .
```

Expected healthy output from `/api/v1/health`:

```json
{ "status": "healthy", "timestamp": "2026-03-14T10:00:00.000Z" }
```

If Redis is unavailable (acceptable in degraded mode):

```json
{ "status": "degraded", "timestamp": "2026-03-14T10:00:00.000Z" }
```

### 6.2 API Smoke Tests

```bash
# Set your production API base URL
API="https://api.example.com/api/v1"

# 1. Login — get a JWT access token
LOGIN_RESPONSE=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@nit.sa","password":"YourStrongPassword1"}')
echo $LOGIN_RESPONSE | jq .
TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.accessToken')

# 2. Verify token — fetch current user profile
curl -s -H "Authorization: Bearer $TOKEN" "$API/auth/me" | jq .

# 3. List items (master data)
curl -s -H "Authorization: Bearer $TOKEN" "$API/master-data/items?pageSize=5" | jq .meta

# 4. Dashboard stats
curl -s -H "Authorization: Bearer $TOKEN" "$API/dashboard/stats" | jq .

# 5. List GRNs (inbound domain)
curl -s -H "Authorization: Bearer $TOKEN" "$API/mrrv?pageSize=5" | jq .meta

# 6. List MIs (outbound domain)
curl -s -H "Authorization: Bearer $TOKEN" "$API/mirv?pageSize=5" | jq .meta

# 7. Inventory summary
curl -s -H "Authorization: Bearer $TOKEN" "$API/inventory?pageSize=5" | jq .meta

# 8. Prometheus metrics endpoint (public)
curl -s "https://api.example.com/api/v1/metrics" | head -20
```

### 6.3 Frontend Verification

1. Open `https://app.example.com` in Comet
2. Verify the login screen loads with no console errors
3. Log in with admin credentials
4. Confirm the dashboard renders KPI cards
5. Navigate to Inbound > GRN — verify the list table loads
6. Navigate to Outbound > MI — verify the list table loads
7. Check browser DevTools → Network tab for any 4xx/5xx errors

### 6.4 WebSocket Verification

```bash
# Test Socket.IO upgrade handshake (should return HTTP 101 or 200 with upgrade header)
curl -v -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  "https://api.example.com/socket.io/?EIO=4&transport=websocket"
```

In Comet DevTools:
1. Open Network tab, filter by **WS**
2. Log in — a WebSocket connection to `/socket.io/` should appear
3. Status should be **101 Switching Protocols**

### 6.5 BullMQ Queue Health

```bash
# If QUEUE_DASHBOARD=true, access the Bull Arena dashboard
open https://api.example.com/admin/queues

# Or check Redis directly
redis-cli -u $REDIS_URL info keyspace
redis-cli -u $REDIS_URL keys "bull:*" | head -20
```

### 6.6 Scheduler Verification

The scheduler auto-starts when the server starts. Verify it is running:

```bash
# Check backend logs for scheduler startup message
pm2 logs nit-scs-v2-backend --lines 50 | grep -i scheduler

# Expected: "Scheduler started" with cron job registrations
```

### 6.7 OpenAPI Documentation

```bash
# Interactive Swagger UI
open https://api.example.com/api/v1/api-docs

# Raw OpenAPI JSON spec
curl -s https://api.example.com/api/v1/api-docs.json | jq '.info'
```

---

## 7. Monitoring & Maintenance

### 7.1 Prometheus Metrics

The backend exposes a Prometheus-compatible metrics endpoint:

```
GET /api/v1/metrics
```

Metrics include: HTTP request counts, request duration histograms, active
connections, database query durations, and BullMQ job counts.

Import the endpoint into Grafana or any Prometheus-compatible tool.

### 7.2 Log Management

The backend uses **Pino** with JSON output in production. Every log line includes:

```json
{
  "level": 30,
  "time": "2026-03-14T10:30:00.000Z",
  "service": "nit-scs-api",
  "env": "production",
  "msg": "Request completed"
}
```

Log level defaults to `info` in production. Override at runtime:

```bash
LOG_LEVEL=warn pm2 restart nit-scs-v2-backend
```

**PM2 log locations:**

```
/var/log/nit-scs-v2/out.log    # stdout (info, debug)
/var/log/nit-scs-v2/err.log    # stderr (warn, error, fatal)
```

**Forward logs to a centralized aggregator** (Datadog, ELK, Loki):

```bash
# Example: Datadog log tailing via agent
# Add to /etc/datadog-agent/conf.d/nit-scs.d/conf.yaml:
# logs:
#   - type: file
#     path: /var/log/nit-scs-v2/*.log
#     service: nit-scs-v2
#     source: nodejs
```

### 7.3 Redis Monitoring

```bash
# Check Redis health
redis-cli -u $REDIS_URL ping           # Expected: PONG

# Memory usage
redis-cli -u $REDIS_URL info memory | grep used_memory_human

# Connected clients
redis-cli -u $REDIS_URL info clients | grep connected_clients

# Inspect queue keys (BullMQ)
redis-cli -u $REDIS_URL keys "bull:*" | wc -l
```

Redis memory alert threshold is built into the backend health check: if usage
exceeds 85% of `maxmemory`, a `warn` log is emitted every 30 seconds.

### 7.4 Database Maintenance

```bash
# Check active connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"

# Check for slow queries (requires pg_stat_statements extension)
psql $DATABASE_URL -c "
  SELECT query, calls, mean_exec_time, total_exec_time
  FROM pg_stat_statements
  ORDER BY mean_exec_time DESC
  LIMIT 10;"

# Check migration status
cd packages/backend && npx prisma migrate status

# Open Prisma Studio (visual database browser — development/staging only)
cd packages/backend && npx prisma studio
```

### 7.5 Backup Strategy

```bash
# Manual backup
cd /path/to/nit-scs-v2
DATABASE_URL="postgresql://..." ./packages/backend/scripts/backup.sh

# Backups are written to: packages/backend/backups/nit_scs_v2_YYYYMMDD_HHMMSS.dump
# Integrity is verified automatically (pg_restore --list)
# Retention: 30 days (override with RETENTION_DAYS=<n>)

# Automate daily backups at 02:00 (add to crontab -e)
0 2 * * * cd /path/to/nit-scs-v2 && DATABASE_URL="postgres://..." \
  BACKUP_DIR=/var/backups/nit-scs-v2 \
  ./packages/backend/scripts/backup.sh >> /var/log/nit-backup.log 2>&1
```

**Restore from backup:**

```bash
./packages/backend/scripts/restore.sh backups/nit_scs_v2_20260314_020000.dump
# The restore script is interactive and requires confirmation.
```

---

## 8. Security Checklist

### Environment Variables

- [ ] `JWT_SECRET` is at least 64 characters of cryptographically random data
- [ ] `JWT_REFRESH_SECRET` is different from `JWT_SECRET` and equally strong
- [ ] Generate secrets: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- [ ] No default dev secrets in production (`nit-scs-dev-only-jwt-secret-2026-do-not-use-in-production!` will trigger a `WARN` on startup if detected)
- [ ] `SEED_ADMIN_PASSWORD` is unset after initial seeding (or set to a strong password that was immediately changed after first login)

### CORS

- [ ] `CORS_ORIGIN` is set to the exact production frontend URL — no wildcards
- [ ] Multiple origins use comma-separated format: `https://app1.example.com,https://app2.example.com`
- [ ] CORS is checked on startup: any unrecognised origin triggers a 403

### Rate Limiting

- [ ] API-wide rate limiter is active: 500 requests per 60s per client IP (configured in `routes/index.ts`)
- [ ] Auth endpoints have tighter limits (additional WAF-level rules recommended)
- [ ] `trust proxy` is enabled (`app.set('trust proxy', 1)`) so IP is read from `X-Forwarded-For` behind Nginx/load balancer

### Headers (Helmet)

The backend applies Helmet with the following active policies:
- Content-Security-Policy (strict `defaultSrc: self`)
- HSTS: `max-age=31536000; includeSubDomains; preload`
- Referrer-Policy: `strict-origin-when-cross-origin`
- `frameAncestors: none` (clickjacking protection)

### JWT Secret Rotation Schedule

| Secret               | Rotate Every | Procedure                                              |
|----------------------|-------------|--------------------------------------------------------|
| `JWT_SECRET`         | 90 days     | Update env var, restart backend. All active access tokens expire within 15m. |
| `JWT_REFRESH_SECRET` | 90 days     | Update env var, restart. Users must re-login.         |
| `DATABASE_URL`       | 90 days     | Rotate DB password, update connection string, restart. |
| `REDIS_URL`          | 90 days     | Update Redis AUTH password, update env var, restart.  |
| `VAPID_PRIVATE_KEY`  | Annually    | Regenerate pair, push subscribers must re-subscribe.  |
| `ANTHROPIC_API_KEY`  | 90 days     | Rotate in Anthropic console, update env var.          |

**Generate new VAPID keys:**

```bash
node packages/backend/scripts/generate-vapid-keys.js
```

### File Upload Security

- [ ] Uploaded files are stored in `packages/backend/uploads/` (writable directory, non-root in Docker)
- [ ] Multer file size and MIME-type validation is active in `domains/uploads/`
- [ ] In multi-instance setups, replace local disk storage with S3/MinIO (see Section 10)

### Database Security

- [ ] PostgreSQL is not exposed to the public internet (firewall / VPC)
- [ ] Application connects as a least-privilege user (not `postgres` superuser)
- [ ] Prisma uses parameterized queries throughout (no raw SQL concatenation)
- [ ] `pg_stat_statements` enabled for query auditing

---

## 9. Rollback Procedure

### Preparation (must be done BEFORE every deploy)

- [ ] Tag the current Git commit: `git tag v2.x.x-pre-deploy`
- [ ] Take a database backup: `./packages/backend/scripts/backup.sh`
- [ ] Note the current Docker image tag or PM2 process state

### Rollback Decision Matrix

| Symptom                                   | Action                                      |
|-------------------------------------------|---------------------------------------------|
| Frontend rendering broken / blank page    | Rollback frontend only (re-deploy previous `dist/`) |
| API returning 5xx on critical paths       | Rollback backend + frontend                 |
| Database migration caused data issues     | Stop backend, restore DB backup, rollback all |
| Minor UI bugs not blocking operations     | Hotfix forward — no rollback needed         |

### Rollback Steps

#### Frontend only

```bash
# Re-deploy previous build artifacts from your artifact store / CDN
# or rebuild from the previous Git tag:
git checkout v2.x.x-pre-deploy
pnpm --filter @nit-scs-v2/shared build
pnpm --filter @nit-scs-v2/frontend build
cp -r packages/frontend/dist/* /var/www/nit-scs-v2/
```

#### Backend (PM2)

```bash
# Stop current process
pm2 stop nit-scs-v2-backend

# Checkout previous version
git stash  # or git checkout v2.x.x-pre-deploy
pnpm install --frozen-lockfile
pnpm --filter @nit-scs-v2/shared build
pnpm --filter @nit-scs-v2/backend build

# Restart
pm2 start nit-scs-v2-backend
```

#### Database migration rollback

```bash
# Check migration status
cd packages/backend && npx prisma migrate status

# If a migration needs to be reversed, mark it as rolled back:
npx prisma migrate resolve --rolled-back <migration-name>

# For data migrations — restore from the pre-deploy backup:
./packages/backend/scripts/restore.sh backups/nit_scs_v2_<timestamp>.dump
```

#### Cache flush (after schema-breaking changes)

```bash
# Flush all Redis data (rate limits, token blacklist, cached responses)
redis-cli -u $REDIS_URL FLUSHDB
```

### Verification after rollback

```bash
curl -s https://api.example.com/api/v1/health | jq .
curl -s https://api.example.com/api/v1/ready | jq .
```

---

## 10. Multi-Instance Scaling Notes

If running more than one backend process (horizontal scaling or PM2 cluster mode):

### Required Changes

- [ ] **Socket.IO Redis adapter**: Install `@socket.io/redis-adapter` and configure it
  so real-time events broadcast across all instances. Without this, a user connected
  to instance A will not receive events emitted by instance B.

- [ ] **Sticky sessions on load balancer**: Socket.IO polling transport requires that
  all requests from a single client hit the same instance. Enable sticky sessions
  (IP hash or session cookie) on Nginx / your load balancer.

- [ ] **PM2 cluster mode**: Change `exec_mode` to `cluster` and `instances` to the
  number of CPU cores:

  ```javascript
  exec_mode: 'cluster',
  instances: 'max',   // or a specific number, e.g. 4
  ```

- [ ] **Database connection pool sizing**: The total connections across all instances
  must not exceed PostgreSQL `max_connections` (default: 100). With 4 instances and
  `connection_limit=20` each, total = 80 (safe). Adjust accordingly.

- [ ] **Shared file storage**: The `uploads/` directory is local disk. In a
  multi-instance setup, replace it with S3 / MinIO so all instances read and write
  from the same storage.

- [ ] **Scheduler locks**: The built-in scheduler uses Redis-based distributed locks
  to ensure only one instance runs each cron job. This is already implemented —
  no extra configuration required.

---

*Last updated: 2026-03-14*
