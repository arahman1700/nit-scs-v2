# Deployment Checklist — v2.0.0-enterprise

## Pre-Deployment

### 1. Environment Variables (Render)

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/nit_scs_v2?sslmode=require

# Redis (Render Redis or external)
REDIS_URL=redis://default:pass@host:6379

# Auth
JWT_SECRET=<generate-256-bit-secret>
JWT_EXPIRES_IN=8h
REFRESH_TOKEN_SECRET=<generate-256-bit-secret>
REFRESH_TOKEN_EXPIRES_IN=7d

# Server
NODE_ENV=production
PORT=4000
CORS_ORIGIN=https://your-frontend-domain.onrender.com

# Email (optional)
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=noreply@company.com
SMTP_PASS=<smtp-password>
SMTP_FROM=noreply@company.com

# BullMQ Dashboard (optional)
BULL_BOARD_USER=admin
BULL_BOARD_PASS=<strong-password>

# File uploads
UPLOAD_MAX_SIZE=10485760
UPLOAD_DIR=/tmp/uploads

# Socket.IO
SOCKET_CORS_ORIGIN=https://your-frontend-domain.onrender.com
```

### 2. Render Service Setup

#### Backend (Web Service)
- **Runtime**: Node.js
- **Build Command**: `pnpm install && pnpm -F @nit-scs-v2/backend build`
- **Start Command**: `pnpm -F @nit-scs-v2/backend start`
- **Plan**: Starter or Standard (min 512MB RAM for BullMQ workers)
- **Health Check Path**: `/api/health`
- **Auto-Deploy**: Connected to `main` branch

#### Frontend (Static Site)
- **Build Command**: `pnpm install && pnpm -F @nit-scs-v2/frontend build`
- **Publish Directory**: `packages/frontend/dist`
- **Rewrite Rules**: `/* → /index.html` (SPA routing)

#### PostgreSQL
- **Plan**: Starter (1GB) or Standard (4GB recommended)
- **PostgreSQL Version**: 16
- **Enable connection pooling** if available

#### Redis
- **Plan**: Starter (25MB) or Standard
- **Max Memory Policy**: `allkeys-lru`
- **Used for**: BullMQ job queues, rate limiting, Socket.IO adapter

### 3. Database Migration

```bash
# Run Prisma migrations on production DB
DATABASE_URL=<production-url> npx prisma migrate deploy

# Seed reference data (UOMs, system settings, admin user)
DATABASE_URL=<production-url> npx prisma db seed
```

### 4. Materialized Views

After migration, create materialized views for dashboard performance:

```bash
# Connect to production DB and run:
psql $DATABASE_URL -f packages/backend/prisma/materialized-views.sql
```

Views to verify:
- `mv_warehouse_dashboard` — warehouse KPIs
- `mv_executive_dashboard` — executive summary
- `mv_inventory_aging` — inventory aging report
- `mv_supplier_performance` — supplier metrics

## Deployment Steps

### Step 1: Deploy Database
1. Create PostgreSQL instance on Render
2. Copy connection string to `DATABASE_URL`
3. Run `prisma migrate deploy`
4. Run seed script
5. Create materialized views

### Step 2: Deploy Redis
1. Create Redis instance on Render
2. Copy connection string to `REDIS_URL`
3. Verify connectivity: `redis-cli -u $REDIS_URL PING`

### Step 3: Deploy Backend
1. Create Web Service on Render
2. Set all environment variables
3. Deploy from `main` branch
4. Wait for health check to pass at `/api/health`

### Step 4: Deploy Frontend
1. Create Static Site on Render
2. Set `VITE_API_BASE_URL` to backend URL
3. Deploy
4. Verify SPA routing works

### Step 5: Configure BullMQ Workers
Workers start automatically with the backend. Verify queues:
- `email-queue` — email notifications
- `notification-queue` — push notifications
- `scheduled-jobs` — SLA checks, maintenance alerts, cycle count reminders
- `report-queue` — async report generation

BullMQ dashboard available at: `https://backend-url/admin/queues`

## Post-Deployment Checks

### Critical Path Verification

| # | Check | Command / URL | Expected |
|---|-------|--------------|----------|
| 1 | Health endpoint | `GET /api/health` | `{"status":"ok"}` |
| 2 | Admin login | `POST /api/auth/login` | JWT token returned |
| 3 | Dashboard loads | `GET /api/dashboards/executive` | KPI data |
| 4 | GRN creation | `POST /api/inbound/grn` | Document created with auto-number |
| 5 | Inventory query | `GET /api/inventory/stock-levels` | Stock data returned |
| 6 | Socket.IO | Connect to `/` namespace | Handshake successful |
| 7 | BullMQ queues | `GET /admin/queues` | Dashboard shows active queues |
| 8 | Rate limiter | 6x failed login | 429 after 5 attempts |
| 9 | RBAC | Login as warehouse_staff, hit admin route | 403 Forbidden |
| 10 | Materialized views | `GET /api/dashboards/warehouse` | Fast response (<500ms) |

### Oracle Table Name Verification

All raw SQL queries use Oracle WMS `@@map` names. Verify no 500 errors on:
- `/api/dashboards/executive` — uses `MTL_ONHAND_QUANTITIES`, `RCV_RECEIPT_HEADERS`
- `/api/reporting/kpis` — uses `MTL_CYCLE_COUNT_LINES`, `WMS_ZONES`
- `/api/inbound/grn` (POST) — uses `FND_DOCUMENT_COUNTERS`
- `/api/inventory/demand-analytics` — uses multiple Oracle-mapped tables

### Queue Health

```bash
# Check Redis for active queues
redis-cli -u $REDIS_URL KEYS "bull:*" | head -20
```

### Notification System

1. Create a GRN with damaged items → should trigger DR auto-creation
2. Submit GRN → should trigger QCI if `rfimRequired=true`
3. Check `/api/notifications` — should show workflow events

## Rollback Plan

### Quick Rollback
Render keeps the previous deploy. Use "Manual Deploy" → select previous commit.

### Database Rollback
```bash
# Prisma maintains migration history
npx prisma migrate resolve --rolled-back <migration-name>
```

### Redis Flush (if needed)
```bash
redis-cli -u $REDIS_URL FLUSHDB
```

## Performance Baselines

| Metric | Target | Notes |
|--------|--------|-------|
| API response (p95) | < 200ms | Cached queries via materialized views |
| Dashboard load | < 1s | Lazy-loaded components |
| GRN creation | < 500ms | Includes document numbering |
| Search (inventory) | < 300ms | Indexed on warehouse + item |
| WebSocket latency | < 100ms | Redis adapter for multi-instance |

## Security Checklist

- [ ] `JWT_SECRET` is unique, 256-bit minimum
- [ ] `CORS_ORIGIN` set to exact frontend domain (not `*`)
- [ ] Rate limiting active on `/api/auth/*` endpoints
- [ ] `NODE_ENV=production` (disables stack traces)
- [ ] HTTPS enforced (Render provides TLS)
- [ ] No `.env` or credentials in git history
- [ ] BullMQ dashboard protected with `BULL_BOARD_USER/PASS`
- [ ] Database connection uses SSL (`?sslmode=require`)
