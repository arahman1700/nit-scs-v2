# NIT Supply Chain V2 -- Operational Runbooks

> Last updated: 2026-03-12
> Service: `nit-scs-v2` | Port: 4000 | Runtime: Node 20 (Alpine)

---

## Table of Contents

1. [Service Restart and Redeployment](#1-service-restart-and-redeployment)
2. [Database Migrations](#2-database-migrations)
3. [Seeding Data](#3-seeding-data)
4. [Clearing Redis Cache](#4-clearing-redis-cache)
5. [System Health Checks](#5-system-health-checks)
6. [Investigating SLA Breaches](#6-investigating-sla-breaches)
7. [Managing Scheduled Jobs](#7-managing-scheduled-jobs)
8. [Handling Stuck Documents](#8-handling-stuck-documents)
9. [Common Database Queries](#9-common-database-queries)

---

## 1. Service Restart and Redeployment

### Render (Production)

**Trigger a manual deploy:**

```bash
# Via Render dashboard: Services > nit-scs-v2 > Manual Deploy > Deploy latest commit
# Or via CLI:
curl -X POST "https://api.render.com/v1/services/<SERVICE_ID>/deploys" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"clearCache": "do_not_clear"}'
```

**Restart without redeploying (preserves the current build):**

```bash
# Render dashboard: Services > nit-scs-v2 > ... menu > Restart Service
```

The startup sequence (defined in `packages/backend/start.sh`) is:

1. `npx prisma migrate deploy` -- applies any pending migrations
2. `node dist/seed/seed.js` -- seeds the database (idempotent, skips if already seeded)
3. `exec node dist/index.js` -- starts the Express server

If migration fails, the container exits with code 1 and Render will show the deploy as failed.

### Local Development

```bash
# Start infrastructure
docker compose up -d

# Start backend with hot-reload
cd packages/backend
pnpm dev

# Start frontend
cd packages/frontend
pnpm dev
```

### Docker (Manual)

```bash
# Build
docker build -t nit-scs-v2 -f packages/backend/Dockerfile .

# Run
docker run -p 4000:4000 \
  -e DATABASE_URL="postgresql://nit_admin:password@host.docker.internal:5433/nit_scs" \
  -e JWT_SECRET="your-32-char-minimum-secret-here!!" \
  -e JWT_REFRESH_SECRET="your-32-char-minimum-refresh-secret!" \
  -e REDIS_URL="redis://host.docker.internal:6379" \
  nit-scs-v2
```

### Graceful Shutdown Behavior

The server handles `SIGTERM` and `SIGINT` gracefully:

1. Sets `isShuttingDown = true` -- new requests get 503 with `Connection: close`
2. Stops the job scheduler
3. Closes Socket.IO connections
4. Waits up to 5 seconds for in-flight requests to drain
5. Closes HTTP server, disconnects Redis and Prisma
6. Force-exits after 10 seconds if shutdown hangs

---

## 2. Database Migrations

### Check Migration Status

```bash
cd packages/backend
npx prisma migrate status
```

This shows which migrations have been applied and which are pending.

### Run Pending Migrations (Production)

Migrations run automatically on deploy via `start.sh`. To run manually:

```bash
cd packages/backend
npx prisma migrate deploy
```

This is safe to run multiple times -- it only applies unapplied migrations.

### Create a New Migration (Development)

```bash
cd packages/backend
pnpm prisma:migrate
# Or with a name:
npx prisma migrate dev --name add_shipment_tracking_fields
```

### Create Migration Without Applying (for review)

```bash
cd packages/backend
pnpm prisma:migrate:create
```

### Regenerate Prisma Client

After schema changes:

```bash
cd packages/backend
npx prisma generate
```

### Emergency: Reset Database (DESTRUCTIVE -- Development Only)

```bash
cd packages/backend
npx prisma migrate reset
# This drops all tables, re-runs all migrations, and re-seeds
```

---

## 3. Seeding Data

### Full Seed (Development)

Runs all three seed scripts in order:

```bash
cd packages/backend
pnpm prisma:seed
```

This executes:
1. `prisma/seed.ts` -- regions, cities, ports, warehouses, employees, admin user, categories, UOMs
2. `prisma/seed-templates.ts` -- notification templates, workflow templates
3. `prisma/seed-data.ts` -- demo items, suppliers, inventory levels

### Seed Only Demo Data

```bash
cd packages/backend
pnpm prisma:seed-data
```

### Production Seed

In production, seeding runs automatically during deploy via `start.sh`. The seed script uses `upsert` operations, making it idempotent -- safe to re-run.

The default admin password is `Admin@2026!` unless overridden by `SEED_ADMIN_PASSWORD`.

### Semantic Layer Seed

The semantic layer (dashboard/report metadata) is seeded as part of the main seed:

```bash
# Included in seed.ts automatically, or run standalone:
cd packages/backend
tsx prisma/seed-semantic-layer.ts
```

---

## 4. Clearing Redis Cache

### Connecting to Redis

```bash
# Local
redis-cli -h localhost -p 6379

# Upstash (production) -- use the REST API or rediss:// URL
redis-cli --tls -u $REDIS_URL
```

### View All Keys

```bash
redis-cli KEYS "*"
```

### Clear Rate Limiter State

```bash
# Clear all rate limiter keys
redis-cli KEYS "rl:*" | xargs redis-cli DEL

# Clear auth rate limiter specifically (e.g., after false lockout)
redis-cli KEYS "rl:auth:*" | xargs redis-cli DEL

# Clear rate limit for a specific IP
redis-cli DEL "rl:global:<IP_ADDRESS>"
redis-cli DEL "rl:auth:<IP_ADDRESS>:/auth/login"
```

### Clear Token Blacklist

```bash
# View blacklisted tokens
redis-cli KEYS "bl:*"

# Clear all blacklisted tokens (CAUTION: allows revoked tokens to work again)
redis-cli KEYS "bl:*" | xargs redis-cli DEL
```

### Clear Scheduler Locks

```bash
# View active scheduler locks
redis-cli KEYS "scheduler:lock:*"

# Clear all scheduler locks (forces job re-acquisition)
redis-cli KEYS "scheduler:lock:*" | xargs redis-cli DEL

# Clear a specific job lock
redis-cli DEL "scheduler:lock:sla_breach"
```

### Flush Entire Redis (DESTRUCTIVE)

```bash
redis-cli FLUSHALL
```

**Warning:** On Upstash free tier, KEYS commands count against the 10k daily command limit. Use `SCAN 0 MATCH "rl:*" COUNT 100` instead of `KEYS` in production.

### Redis Fallback Behavior

When Redis is unavailable, the system degrades gracefully:

- **Rate limiting:** Falls back to in-memory Map (per-instance, not distributed)
- **Token blacklist:** Falls back to in-memory Set (tokens may work on other instances)
- **Scheduler locks:** Lock always acquired (jobs run on all instances -- safe but redundant)
- **Health check:** Reports `degraded` status instead of `healthy`

---

## 5. System Health Checks

### Endpoints

| Endpoint | Auth Required | Purpose |
|----------|--------------|---------|
| `GET /api/health` | No | Public health status (healthy/degraded/unhealthy) |
| `GET /api/v1/health` | No | Same as above (versioned path) |
| `GET /api/v1/health/details` | Yes (admin) | Detailed status with DB/Redis latency, memory usage |
| `GET /api/v1/live` | No | Liveness probe -- always 200 if process is alive |
| `GET /api/v1/ready` | No | Readiness probe -- 200 only if DB is reachable |

### Quick Health Check

```bash
curl -s https://your-app.onrender.com/api/health | jq
```

Response:

```json
{
  "status": "healthy",
  "timestamp": "2026-03-12T10:00:00.000Z"
}
```

Status values:
- `healthy` -- database and Redis both reachable
- `degraded` -- database reachable but Redis is down
- `unhealthy` -- database unreachable (returns HTTP 503)

### Detailed Health Check (Admin)

```bash
curl -s https://your-app.onrender.com/api/v1/health/details \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq
```

Response includes:
- Component status (database latency, Redis latency)
- Memory usage (RSS, heap used/total, external)
- Uptime in seconds
- API version

### Docker Health Check

The Dockerfile has a built-in health check:

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1
```

### Render Health Check

Configured in `render.yaml`:

```yaml
healthCheckPath: /api/health
```

---

## 6. Investigating SLA Breaches

### Understanding SLA Jobs

Two scheduler jobs monitor SLA compliance, both running every 5 minutes:

- **`sla_breach`** -- Finds documents past their SLA deadline and sends breach notifications
- **`sla_warning`** -- Finds documents within 1 hour of their SLA deadline and sends warnings

### SLA-Monitored Document Types

| Document | SLA Key | Default Hours | Monitors |
|----------|---------|---------------|----------|
| MIRV (MI) | `approval` | Configurable | Pending approval time |
| Material Requisition | `stock_verification` | Configurable | Time for warehouse to verify stock |
| Job Order | `jo_execution` | Configurable | Time from quotation to completion |
| Gate Pass | `gate_pass` | Configurable | Time from creation to release |
| Scrap Item | `scrap_buyer_pickup` | Configurable (days) | Time for buyer to pick up |
| Surplus Item | `surplus_timeout` | Configurable (days) | Timeout for OU Head approval |
| QCI (RFIM) | `qc_inspection` | Configurable (days) | Time for QC inspection |

### Find Active SLA Breaches

```sql
-- Documents currently breaching SLA (MIRV)
SELECT id, status, sla_due_date, updated_at
FROM mirv
WHERE status = 'pending_approval'
  AND sla_due_date < NOW()
ORDER BY sla_due_date ASC;

-- Material Requisitions breaching stock verification SLA
SELECT id, mrf_number, status, stock_verification_sla, sla_breached, approval_date
FROM material_requisitions
WHERE status IN ('approved', 'checking_stock')
  AND sla_breached = true
ORDER BY approval_date ASC;

-- Job Orders breaching execution SLA
SELECT jo.id, jo.jo_number, jo.status, jst.sla_due_date, jst.sla_met
FROM job_orders jo
JOIN jo_sla_tracking jst ON jst.job_order_id = jo.id
WHERE jst.sla_met = false
ORDER BY jst.sla_due_date ASC;

-- QCI inspections breaching SLA
SELECT id, rfim_number, status, created_at
FROM rfim
WHERE status IN ('pending', 'in_progress')
  AND created_at < NOW() - INTERVAL '48 hours'
ORDER BY created_at ASC;
```

### View SLA Notifications History

```sql
-- Recent SLA breach notifications
SELECT id, recipient_id, title, body, created_at, is_read
FROM notifications
WHERE notification_type = 'sla_breach'
ORDER BY created_at DESC
LIMIT 20;

-- Recent SLA warning notifications
SELECT id, recipient_id, title, body, created_at, is_read
FROM notifications
WHERE notification_type = 'sla_warning'
ORDER BY created_at DESC
LIMIT 20;
```

### Check SLA Configuration

SLA hours are configurable via the `system_configs` table:

```sql
SELECT config_key, config_value, updated_at
FROM system_configs
WHERE config_key LIKE 'sla_%'
ORDER BY config_key;
```

The scheduler refreshes SLA config from the database every 5 minutes. Fallback values are defined in the shared package (`SLA_HOURS` constant).

### Manually Resolve a Breach

If a document is stuck and the SLA has breached, address the root cause (approve the document, complete the inspection, etc.) and the breach notification will stop recurring. Notifications are deduplicated -- the scheduler only sends one notification per document per hour.

---

## 7. Managing Scheduled Jobs

### Job Registry

All background jobs are registered via the `registerJob()` function in `packages/backend/src/utils/job-registry.ts`. The scheduler in `packages/backend/src/domains/system/services/scheduler.service.ts` orchestrates them.

### Currently Registered Jobs

| Job Name | Interval | Lock TTL | Source File |
|----------|----------|----------|-------------|
| `sla_breach` | 5 min | 4 min | `system/jobs/sla-jobs.ts` |
| `sla_warning` | 5 min | 4 min | `system/jobs/sla-jobs.ts` |
| `email_retry` | 2 min | 90 sec | `system/jobs/maintenance-jobs.ts` |
| `expired_lots` | 1 hour | 50 min | `system/jobs/maintenance-jobs.ts` |
| `low_stock` | 30 min | 25 min | `system/jobs/maintenance-jobs.ts` |
| `token_cleanup` | 6 hours | 5 hours | `system/jobs/maintenance-jobs.ts` |
| `abc_classification` | 7 days | 6 days | `system/jobs/maintenance-jobs.ts` |
| `cycle_count_auto` | 24 hours | 23 hours | `system/jobs/maintenance-jobs.ts` |
| `gate_pass_expiry` | 1 hour | 50 min | `system/jobs/maintenance-jobs.ts` |
| `anomaly_detection` | 6 hours | 5 hours | `system/jobs/maintenance-jobs.ts` |
| `reorder_update` | 7 days | 6 days | `system/jobs/maintenance-jobs.ts` |
| `scheduled_rules` | 60 sec | 50 sec | `system/jobs/maintenance-jobs.ts` |
| `daily_reconciliation` | 24 hours | 23 hours | `system/jobs/maintenance-jobs.ts` |
| `scheduled_reports` | 1 hour | 50 min | `system/jobs/maintenance-jobs.ts` |
| `asset_depreciation` | 24 hours | 2 hours | `system/jobs/maintenance-jobs.ts` |
| `visitor_overstay` | 30 min | 25 min | `system/jobs/maintenance-jobs.ts` |
| `amc_expiry` | 24 hours | 2 hours | `system/jobs/maintenance-jobs.ts` |
| `security_monitor` | 1 hour | 50 min | `system/jobs/maintenance-jobs.ts` |
| `vehicle_maintenance` | 12 hours | 11 hours | `system/jobs/maintenance-jobs.ts` |
| `sow_equipment_return` | 24 hours | 23 hours | `system/jobs/notification-jobs.ts` |
| `sow_shipment_delays` | 6 hours | 5 hours | `system/jobs/notification-jobs.ts` |
| `sow_cycle_count` | 24 hours | 23 hours | `system/jobs/notification-jobs.ts` |
| `sow_rate_card_expiry` | 24 hours | 23 hours | `system/jobs/notification-jobs.ts` |
| `sow_vehicle_maint` | 12 hours | 11 hours | `system/jobs/notification-jobs.ts` |
| `sow_ncr_deadline` | 24 hours | 23 hours | `system/jobs/notification-jobs.ts` |
| `sow_contract_renewal` | 24 hours | 23 hours | `system/jobs/notification-jobs.ts` |
| `sow_overdue_tools` | 12 hours | 11 hours | `system/jobs/notification-jobs.ts` |
| `expired_lots` (inv.) | 1 hour | 50 min | `inventory/jobs/expiry-jobs.ts` |

### How the Scheduler Works

- Jobs use `setInterval`-style sequential loops (not `setInterval` itself, to prevent overlapping executions)
- Each tick: acquire Redis distributed lock -> run handler -> wait interval -> repeat
- If Redis is unavailable, the lock is always "acquired" (single-instance fallback)
- Lock TTL is always less than the interval to prevent missed executions
- Errors in individual jobs are caught and logged; they do not affect other jobs

### Checking if Jobs are Running

Look for scheduler logs in the application output:

```bash
# In Render logs, filter for scheduler entries:
# [Scheduler] Starting background job scheduler
# [Scheduler] All jobs registered
# [Scheduler] SLA check failed: ...
# [Scheduler] Marked N expired lot(s)
```

### Forcing a Job to Run

There is no API endpoint to trigger individual jobs. To force execution:

1. Clear the Redis lock for the job: `redis-cli DEL "scheduler:lock:sla_breach"`
2. Restart the service -- all initial jobs (`sla_breach`, `sla_warning`, `email_retry`, `expired_lots`) run after 10 seconds

### Stopping All Jobs

Jobs stop automatically during graceful shutdown. To stop without shutting down:

1. This is not supported at runtime -- jobs are controlled by the scheduler lifecycle
2. Restart the service to reinitialize all jobs

---

## 8. Handling Stuck Documents

### Identifying Stuck Documents

A document is "stuck" when it is in a transitional status but no user can advance it:

```sql
-- Documents pending approval with no matching approval step
SELECT m.id, m.status, m.created_at
FROM mirv m
WHERE m.status = 'pending_approval'
  AND NOT EXISTS (
    SELECT 1 FROM approval_steps a
    WHERE a.document_type = 'mirv'
      AND a.document_id = m.id
      AND a.status = 'pending'
  );

-- Material Requisitions stuck in checking_stock
SELECT id, mrf_number, status, updated_at
FROM material_requisitions
WHERE status = 'checking_stock'
  AND updated_at < NOW() - INTERVAL '7 days';

-- Gate passes stuck in pending
SELECT id, gate_pass_number, status, created_at, valid_until
FROM gate_passes
WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '30 days';
```

### Manually Transitioning a Document

**Step 1: Identify the current state and required transition.**

```sql
-- Check approval steps for a document
SELECT id, document_type, document_id, level, approver_role, status, decided_at
FROM approval_steps
WHERE document_type = 'mirv' AND document_id = '<DOCUMENT_ID>'
ORDER BY level ASC;
```

**Step 2: Update the document status (use with caution).**

```sql
-- Force-approve a stuck MIRV
BEGIN;
UPDATE mirv SET status = 'approved', updated_at = NOW() WHERE id = '<DOCUMENT_ID>';
UPDATE approval_steps
  SET status = 'approved', decided_at = NOW(), decided_by_id = '<ADMIN_EMPLOYEE_ID>'
  WHERE document_type = 'mirv' AND document_id = '<DOCUMENT_ID>' AND status = 'pending';
COMMIT;
```

**Step 3: Create an audit log entry for the manual override.**

```sql
INSERT INTO audit_logs (table_name, record_id, action, changed_by_id, ip_address, changes, created_at)
VALUES (
  'mirv',
  '<DOCUMENT_ID>',
  'update',
  '<ADMIN_EMPLOYEE_ID>',
  'manual-override',
  '{"note": "Manual status transition due to stuck document", "from": "pending_approval", "to": "approved"}',
  NOW()
);
```

### Common Stuck Scenarios

| Scenario | Cause | Resolution |
|----------|-------|------------|
| No pending approval step | Approval chain was not created on submit | Create missing approval steps, then resubmit |
| Approver role has no employees | Role was removed or all employees deactivated | Assign an active employee to the required role |
| Delegation expired | Approval was delegated but delegation period ended | Re-delegate or manually approve |
| Workflow rule not matching | Workflow rule conditions changed after document creation | Manually transition or update workflow rules |

---

## 9. Common Database Queries

### User Management

```sql
-- Find admin users
SELECT id, full_name, email, system_role, is_active, last_login
FROM employees
WHERE system_role = 'admin'
ORDER BY last_login DESC;

-- Check user's recent login activity
SELECT id, employee_id, action, ip_address, created_at
FROM audit_logs
WHERE table_name = 'auth'
  AND changed_by_id = '<EMPLOYEE_ID>'
ORDER BY created_at DESC
LIMIT 10;

-- Unlock a user (reset failed login attempts)
UPDATE employees SET failed_login_attempts = 0, locked_until = NULL
WHERE id = '<EMPLOYEE_ID>';
```

### Inventory Queries

```sql
-- Items below reorder point
SELECT il.item_id, i.item_code, i.item_description, il.qty_on_hand, il.qty_reserved,
       il.reorder_point, il.min_level, w.warehouse_code
FROM inventory_levels il
JOIN items i ON i.id = il.item_id
JOIN warehouses w ON w.id = il.warehouse_id
WHERE il.reorder_point IS NOT NULL
  AND (il.qty_on_hand - il.qty_reserved) <= il.reorder_point
ORDER BY (il.qty_on_hand - il.qty_reserved) ASC;

-- Inventory lot discrepancies (lot totals vs level totals)
SELECT il2.item_id, il2.warehouse_id, il2.qty_on_hand AS level_qty,
       COALESCE(lots.total, 0) AS lot_total,
       il2.qty_on_hand - COALESCE(lots.total, 0) AS discrepancy
FROM inventory_levels il2
LEFT JOIN (
  SELECT item_id, warehouse_id, SUM(available_qty) AS total
  FROM inventory_lots
  WHERE status IN ('active', 'blocked')
  GROUP BY item_id, warehouse_id
) lots ON lots.item_id = il2.item_id AND lots.warehouse_id = il2.warehouse_id
WHERE ABS(il2.qty_on_hand - COALESCE(lots.total, 0)) > 0.001
ORDER BY ABS(il2.qty_on_hand - COALESCE(lots.total, 0)) DESC;

-- Expired lots not yet marked
SELECT id, item_id, lot_number, expiry_date, status, available_qty
FROM inventory_lots
WHERE expiry_date < NOW()
  AND status = 'active'
ORDER BY expiry_date ASC;
```

### Document Counts by Status

```sql
-- GRN (MRRV) document status breakdown
SELECT status, COUNT(*) AS count
FROM mrrv
GROUP BY status
ORDER BY count DESC;

-- MI (MIRV) document status breakdown
SELECT status, COUNT(*) AS count
FROM mirv
GROUP BY status
ORDER BY count DESC;

-- Material Requisition status breakdown
SELECT status, COUNT(*) AS count
FROM material_requisitions
GROUP BY status
ORDER BY count DESC;
```

### Notification Health

```sql
-- Unread notification count per user (top 10)
SELECT recipient_id, e.full_name, COUNT(*) AS unread_count
FROM notifications n
JOIN employees e ON e.id = n.recipient_id
WHERE n.is_read = false
GROUP BY recipient_id, e.full_name
ORDER BY unread_count DESC
LIMIT 10;

-- Failed email queue
SELECT id, recipient_email, subject, status, retry_count, last_error, created_at
FROM email_queue
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 20;
```

### Audit Trail

```sql
-- Recent changes to a specific document
SELECT id, action, changed_by_id, ip_address, changes, created_at
FROM audit_logs
WHERE table_name = 'mirv' AND record_id = '<DOCUMENT_ID>'
ORDER BY created_at DESC;

-- All actions by a specific user in the last 24 hours
SELECT table_name, record_id, action, changes, created_at
FROM audit_logs
WHERE changed_by_id = '<EMPLOYEE_ID>'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### Database Size and Table Stats

```sql
-- Table sizes
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS total_size,
       pg_size_pretty(pg_relation_size(schemaname || '.' || tablename)) AS table_size,
       pg_size_pretty(pg_indexes_size(schemaname || '.' || tablename::regclass)) AS index_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC
LIMIT 20;

-- Row counts for main tables
SELECT relname AS table_name, reltuples::bigint AS estimated_rows
FROM pg_class
WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace
ORDER BY reltuples DESC
LIMIT 20;
```
