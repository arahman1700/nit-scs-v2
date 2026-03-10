# NIT Supply Chain V2 — Deployment Checklist

> Monorepo: `packages/shared` | `packages/backend` | `packages/frontend`
> Stack: React 19 + Vite 6 | Express 5 + Prisma 6 | PostgreSQL 15+ | Redis

---

## 1. Pre-Deployment

- [ ] All tests pass — `pnpm test` (1,812+ tests across 3 packages)
- [ ] Shared builds — `pnpm --filter @nit-scs-v2/shared build`
- [ ] Backend builds — `pnpm --filter @nit-scs-v2/backend build`
- [ ] Frontend builds — `pnpm --filter @nit-scs-v2/frontend build`
- [ ] No TypeScript errors — `pnpm --filter @nit-scs-v2/backend tsc --noEmit`
- [ ] Lint passes — `pnpm lint`
- [ ] Git tag created for release version
- [ ] Changelog updated

### Environment Variables

Verify all required variables are set in the production environment:

| Variable             | Description                                                                  |
| -------------------- | ---------------------------------------------------------------------------- |
| `DATABASE_URL`       | PostgreSQL connection string (`postgresql://user:pass@host:5432/nit_scs_v2`) |
| `REDIS_URL`          | Redis connection string (`redis://host:6379`)                                |
| `JWT_SECRET`         | Access token signing key (min 32 chars, unique to env)                       |
| `JWT_REFRESH_SECRET` | Refresh token signing key (different from JWT_SECRET)                        |
| `VAPID_PUBLIC_KEY`   | Web Push public key                                                          |
| `VAPID_PRIVATE_KEY`  | Web Push private key                                                         |
| `SENTRY_DSN`         | Sentry error tracking endpoint                                               |
| `CORS_ORIGINS`       | Comma-separated allowed origins (production domain only)                     |
| `NODE_ENV`           | Must be `production`                                                         |
| `PORT`               | Backend port (default: 3000)                                                 |

- [ ] All variables set and verified
- [ ] No `.env` file committed to repository
- [ ] Secrets stored in vault/secret manager (not plain text)
- [ ] SSL certificates valid and not expiring within 30 days

---

## 2. Database

- [ ] PostgreSQL 15+ running with `uuid-ossp` extension enabled
- [ ] Run migrations: `npx prisma migrate deploy`
  - **Never** run `prisma migrate dev` in production
  - Schema: 123 models, 3,472 lines
- [ ] Verify 7 performance indexes exist (added in latest audit)
- [ ] Seed initial data:
  - [ ] Roles and permissions
  - [ ] Admin user account
  - [ ] Document number counters (GRN, MI, MRN, QCI, DR, MR, WT sequences)
- [ ] Connection pooling configured (PgBouncer or Prisma connection pool)
- [ ] Backup strategy active:
  - [ ] Automated daily backups: `crontab -e` → `0 2 * * * /path/to/scripts/backup.sh`
  - [ ] Point-in-time recovery enabled (Render/provider)
  - [ ] Backup restoration tested: `./scripts/restore.sh backups/<file>.dump`
  - [ ] Backup retention: 30 days (configurable via `RETENTION_DAYS`)

---

## 3. Redis

- [ ] Redis 7+ running and reachable from backend
- [ ] Persistence configured (RDB + AOF recommended)
- [ ] Memory limit set with eviction policy (`allkeys-lru`)
- [ ] Verify connectivity: `redis-cli -u $REDIS_URL ping`

Redis is used for:

- Rate limiting (API + auth endpoints)
- JWT token blacklist (logout invalidation)
- Response caching
- Scheduler/cron locks (prevents duplicate job execution)
- Socket.IO adapter (if multi-instance)

---

## 4. Backend

### Build & Start

- [ ] Node.js 20+ LTS installed
- [ ] Dependencies installed: `pnpm install --frozen-lockfile`
- [ ] Build: `pnpm --filter @nit-scs-v2/backend build`
- [ ] Start: `node dist/server.js`
- [ ] Process manager configured (PM2 / Docker / systemd)

### Verify Running

- [ ] Health check responds: `curl https://api.example.com/api/v1/health`
- [ ] Liveness probe: `curl https://api.example.com/api/v1/live`
- [ ] Readiness probe: `curl https://api.example.com/api/v1/ready`
- [ ] Socket.IO accepts connections (WebSocket transport)
- [ ] API responds to authenticated requests

### Security

- [ ] `NODE_ENV=production`
- [ ] Helmet security headers active
- [ ] CORS restricted to production origin(s) only
- [ ] Cookie `secure` flag enabled (HTTPS only)
- [ ] Cookie `sameSite` set to `strict` or `lax`
- [ ] Rate limiting active on `/api/auth/*` endpoints
- [ ] Request body size limits configured
- [ ] SQL injection protection via Prisma parameterized queries (default)

### Observability

- [ ] Sentry DSN configured and verified
- [ ] Log level set to `info` (not `debug`)
- [ ] Structured logging (JSON format) for log aggregation
- [ ] APM/metrics endpoint available (if applicable)

---

## 5. Frontend

### Build & Deploy

- [ ] Build: `pnpm --filter @nit-scs-v2/frontend build`
- [ ] Output directory: `packages/frontend/dist/`
- [ ] `VITE_API_URL` points to production backend
- [ ] `VITE_WS_URL` points to production WebSocket endpoint

### Hosting (nginx / CDN)

- [ ] Serve `dist/` as static files
- [ ] SPA fallback: all routes return `index.html` (for client-side routing)
- [ ] Cache headers configured:
  - `index.html`: `Cache-Control: no-cache` (always revalidate)
  - `assets/*` (hashed filenames): `Cache-Control: public, max-age=31536000, immutable`
- [ ] Gzip/Brotli compression enabled
- [ ] HTTPS enforced (redirect HTTP to HTTPS)

### PWA

- [ ] Service worker registered and caching static assets
- [ ] `manifest.json` configured with correct `start_url` and icons
- [ ] Offline fallback page works

### nginx Example

```nginx
server {
    listen 443 ssl http2;
    server_name app.example.com;

    root /var/www/nit-scs-v2/dist;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache hashed assets forever
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Proxy API to backend
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket proxy
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 6. Post-Deployment Verification

### Functional Smoke Tests

- [ ] Login with admin credentials
- [ ] Login with each role (warehouse_manager, logistics_officer, etc.)
- [ ] WebSocket connection established (check browser DevTools → Network → WS)
- [ ] Create a GRN (Goods Receipt Note)
- [ ] Create an MI (Material Issue)
- [ ] Create an MRN (Material Return Note)
- [ ] Create a QCI (Quality Control Inspection)
- [ ] Create a DR (Discrepancy Report)
- [ ] Submit document for approval
- [ ] Approve/reject document — verify status updates in real-time
- [ ] Verify EventBus events flowing to rule engine
- [ ] Verify push notifications (if VAPID keys configured)

### Monitoring

- [ ] Sentry receiving events (trigger a test error if needed)
- [ ] Redis memory usage within limits — `redis-cli info memory`
- [ ] PostgreSQL active connections reasonable — `SELECT count(*) FROM pg_stat_activity`
- [ ] No slow queries — check `pg_stat_statements` or query logs
- [ ] Backend process stable (no restart loops)
- [ ] Frontend assets loading (no 404s in browser console)

---

## 7. Rollback Plan

### Preparation (before deploying)

- [ ] Previous build/Docker image tagged and accessible
- [ ] Database migration rollback script tested in staging
- [ ] Current database backup taken immediately before deploy
- [ ] DNS TTL lowered (if DNS-based rollback)

### Rollback Steps

1. **Frontend**: Redeploy previous `dist/` bundle or revert CDN to prior version
2. **Backend**: Stop current process, deploy previous build, restart
3. **Database**: Run `npx prisma migrate resolve` if migration needs to be undone
   - For data migrations: restore from pre-deploy backup
4. **Cache**: Flush Redis if schema changes affect cached data — `redis-cli FLUSHDB`
5. **Verify**: Run smoke tests against rolled-back version

### Decision Criteria

| Severity                   | Action                                        |
| -------------------------- | --------------------------------------------- |
| Frontend rendering broken  | Rollback frontend immediately                 |
| API 500s on critical paths | Rollback backend + frontend                   |
| Data corruption            | Stop backend, restore DB backup, rollback all |
| Minor UI bugs              | Hotfix forward, no rollback                   |

---

## 8. Multi-Instance / Scaling Notes

If running multiple backend instances:

- [ ] Redis adapter configured for Socket.IO (cross-instance event broadcasting)
- [ ] Sticky sessions enabled on load balancer (for Socket.IO polling fallback)
- [ ] Prisma connection pool sized per instance (total across instances < PostgreSQL `max_connections`)
- [ ] Scheduler locks via Redis (only one instance runs cron jobs)
- [ ] Shared file storage (S3/MinIO) if handling uploads

---

## 9. Load Testing

Before going live, validate the system can handle expected load:

```bash
# Install k6
brew install k6  # macOS

# Run load test against staging
BASE_URL=https://staging.example.com k6 run packages/backend/scripts/load-test.js

# Custom VU count and duration
k6 run --vus 50 --duration 2m packages/backend/scripts/load-test.js
```

**Thresholds (must pass):**

- 95th percentile response time < 500ms
- 99th percentile response time < 1s
- Error rate < 5%
- Login endpoint < 1s at p95

---

## 10. Backup & Restore

```bash
# Create backup
./packages/backend/scripts/backup.sh

# Restore from backup (interactive — requires confirmation)
./packages/backend/scripts/restore.sh backups/nit_scs_v2_20260310_120000.dump

# Automate daily backups (add to crontab)
crontab -e
# 0 2 * * * cd /path/to/project && DATABASE_URL=postgres://... ./packages/backend/scripts/backup.sh >> /var/log/nit-backup.log 2>&1
```

---

## 11. CDN Setup

For production, serve frontend static assets from a CDN to reduce latency:

- [ ] Configure CDN (Cloudflare, AWS CloudFront, or Fastly) in front of the frontend origin
- [ ] Origin: your nginx/S3 bucket serving `packages/frontend/dist/`
- [ ] Cache rules:
  - `index.html` → bypass cache (or TTL: 60s with `stale-while-revalidate`)
  - `assets/*` (hashed filenames) → cache forever (`max-age=31536000, immutable`)
  - `manifest.json`, `sw.js` → short TTL (5 minutes) or no-cache
- [ ] Enable Brotli/Gzip compression at the CDN edge
- [ ] Purge CDN cache on each frontend deploy (automate in CI)
- [ ] Configure custom domain + TLS on the CDN distribution

```bash
# Example: Cloudflare — purge cache via API after deploy
curl -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

---

## 12. WAF (Web Application Firewall)

- [ ] Deploy a WAF in front of the backend API
- [ ] Recommended providers:
  - **Cloudflare WAF** — easiest if already using Cloudflare for DNS/CDN
  - **AWS WAF** — best if hosted on AWS (attach to ALB or CloudFront)
- [ ] Enable OWASP Core Rule Set (CRS) for common attack protection
- [ ] Custom rules:
  - Rate limit `/api/v1/auth/login` to 10 req/min per IP (on top of app-level rate limiting)
  - Block known bad user agents and scanners
  - Geo-restrict if applicable (e.g., allow only SA/GCC regions)
- [ ] Enable bot detection / challenge pages for suspicious traffic
- [ ] Verify legitimate traffic is not blocked (test all API endpoints after enabling WAF)

---

## 13. Secrets Management

### Best Practices

- [ ] **Never** commit secrets to the repository — use `.env.example` with placeholder values
- [ ] Store production secrets in a vault/secret manager:
  - **AWS Secrets Manager** or **SSM Parameter Store** (if on AWS)
  - **HashiCorp Vault** (self-hosted or cloud)
  - **Doppler** / **Infisical** (SaaS options)
- [ ] Inject secrets as environment variables at runtime (not baked into images)
- [ ] Use separate secrets per environment (dev / staging / production)
- [ ] Restrict access: only CI/CD and production servers can read production secrets

### Rotation Schedule

| Secret               | Rotation Frequency | Notes                                   |
| -------------------- | ------------------ | --------------------------------------- |
| `JWT_SECRET`         | Every 90 days      | Coordinate with active session handling |
| `JWT_REFRESH_SECRET` | Every 90 days      | Rotate alongside JWT_SECRET             |
| `DATABASE_URL`       | Every 90 days      | Rotate DB password, update connection   |
| `REDIS_URL`          | Every 90 days      | Update Redis AUTH password              |
| `VAPID_PRIVATE_KEY`  | Annually           | Re-subscribe push endpoints on rotation |
| `SENTRY_DSN`         | Rarely             | Rotate only if compromised              |

- [ ] Rotation procedure documented and tested
- [ ] Automated rotation via secret manager where possible
- [ ] Post-rotation smoke test: verify API health after each secret rotation

---

## 14. Log Aggregation

### Setup

- [ ] Backend uses **Pino** with JSON output (already configured in structured logging mode)
- [ ] Pipe logs to a centralized aggregation service:
  - **ELK Stack** (Elasticsearch + Logstash + Kibana) — self-hosted
  - **Datadog** — SaaS, excellent for APM + logs + metrics in one place
  - **Grafana Loki** — lightweight alternative to ELK
- [ ] Configure log shipping:
  - Use a sidecar/agent (Filebeat, Datadog Agent, Fluentd) to forward JSON logs
  - Or send directly via Pino transport (`pino-datadog`, `pino-elasticsearch`)

### Example: Datadog Agent Setup

```bash
# Install Datadog agent (Linux)
DD_API_KEY=<your-key> DD_SITE="datadoghq.com" bash -c \
  "$(curl -L https://install.datadoghq.com/scripts/install_script_agent7.sh)"

# Configure log collection in /etc/datadog-agent/datadog.yaml
# logs_enabled: true

# Add log source in /etc/datadog-agent/conf.d/nit-scs.d/conf.yaml
# logs:
#   - type: file
#     path: /var/log/nit-scs-v2/*.log
#     service: nit-scs-v2
#     source: nodejs
```

### Recommended Dashboards

- [ ] Request rate + error rate (5xx) over time
- [ ] p50 / p95 / p99 response times per endpoint
- [ ] Active WebSocket connections
- [ ] Database query duration distribution
- [ ] Failed login attempts (security monitoring)

---

## 15. Automated Security Scanning in CI

### npm Audit

Run `npm audit` on every PR to catch known vulnerabilities:

```yaml
# .github/workflows/security.yml
name: Security Scan
on: [push, pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm audit --audit-level=high
        continue-on-error: false
```

### Snyk Integration

For deeper dependency and code scanning:

```yaml
snyk:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: snyk/actions/node@master
      env:
        SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
      with:
        args: --severity-threshold=high
```

### Checklist

- [ ] `pnpm audit` runs in CI and blocks PRs on high/critical vulnerabilities
- [ ] Snyk (or Dependabot) configured for automated dependency scanning
- [ ] Snyk Code enabled for static analysis (optional but recommended)
- [ ] Security scan results visible in PR checks
- [ ] Weekly scheduled scan for newly disclosed vulnerabilities

---

## 16. Zero-Downtime Database Migrations

Prisma migrations can cause downtime if they lock tables or break backward compatibility. Follow this strategy:

### Principles

1. **Backward-compatible migrations only** — new code must work with both old and new schema
2. **Expand-then-contract** — add new columns/tables first, migrate data, then remove old ones
3. **Never rename or drop columns in a single deploy** — split into two releases

### Migration Workflow

```
Release N:    Add new column (nullable) → deploy new code that writes to both old + new
Release N+1:  Backfill data → switch reads to new column → deploy
Release N+2:  Drop old column → deploy
```

### Prisma-Specific Steps

```bash
# 1. Generate migration (development only)
npx prisma migrate dev --name add_new_column

# 2. Review generated SQL in prisma/migrations/<timestamp>_add_new_column/migration.sql
#    - Ensure no DROP, RENAME, or ALTER TYPE on high-traffic tables
#    - Add CREATE INDEX CONCURRENTLY for large tables (edit the SQL manually)

# 3. Test migration against a staging copy of production data
pg_dump $PROD_DB_URL --format=custom > staging_snapshot.dump
pg_restore --dbname=$STAGING_DB_URL staging_snapshot.dump
npx prisma migrate deploy  # run against staging

# 4. Deploy to production
npx prisma migrate deploy
```

### Checklist

- [ ] All migrations are backward-compatible (no breaking column drops/renames)
- [ ] Large table indexes created with `CONCURRENTLY` (manually edit migration SQL)
- [ ] Migration tested against a copy of production data before deploying
- [ ] Rollback plan documented for each migration (manual SQL if needed)
- [ ] Application health verified after migration completes

---

## Quick Reference — Deploy Commands

```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies
pnpm install --frozen-lockfile

# 3. Build all packages (order matters: shared → backend → frontend)
pnpm --filter @nit-scs-v2/shared build
pnpm --filter @nit-scs-v2/backend build
pnpm --filter @nit-scs-v2/frontend build

# 4. Run database migrations
cd packages/backend
npx prisma migrate deploy

# 5. Restart backend
pm2 restart nit-scs-v2-backend   # or: systemctl restart nit-scs-v2

# 6. Deploy frontend
cp -r packages/frontend/dist/* /var/www/nit-scs-v2/

# 7. Verify
curl -s https://api.example.com/api/health | jq .
```
