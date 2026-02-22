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
  - [ ] Automated daily backups
  - [ ] Point-in-time recovery enabled
  - [ ] Backup restoration tested

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

- [ ] Health check responds: `curl https://api.example.com/api/health`
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
