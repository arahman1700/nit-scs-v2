# Monitoring and Alerting Guide

Last updated: 2026-03-12

---

## 1. Overview

NIT-SCS V2 monitoring covers five layers:

1. **Structured logging** (Pino) -- request tracing, error tracking, audit trail
2. **BullMQ dashboard** -- queue health, DLQ monitoring, worker metrics
3. **Redis monitoring** -- connection health, memory usage, latency
4. **Socket.IO metrics** -- connection count, room membership, rate limiting
5. **Scheduled jobs** -- SLA enforcement, reconciliation, maintenance tasks

---

## 2. Structured Logging (Pino)

### 2.1 Configuration

Source: `packages/backend/src/config/logger.ts`

| Setting | Development | Production |
|---|---|---|
| Level | `debug` | `info` |
| Format | Pretty-printed, colorized (pino-pretty) | JSON (structured, for log aggregation) |
| Timestamp | ISO format (`pino.stdTimeFunctions.isoTime`) | ISO format |
| Base fields | `service: 'nit-scs-api'`, `env: 'development'` | `service: 'nit-scs-api'`, `env: 'production'` |
| Error serialization | `pino.stdSerializers.err` (full stack trace) | Same |

Override the level at runtime with the `LOG_LEVEL` environment variable:

```bash
LOG_LEVEL=debug node dist/index.js
```

### 2.2 Log Levels

| Level | Value | Usage | Example |
|---|---|---|---|
| `fatal` | 60 | Process about to crash | Database connection pool exhausted |
| `error` | 50 | Failed operations, caught exceptions | Job failed after max retries |
| `warn` | 40 | SLA breaches, degraded services, low stock | Redis PING latency > 100ms |
| `info` | 30 | Request lifecycle, job completions, state transitions | Server started, email sent |
| `debug` | 20 | Detailed execution flow (dev only) | Socket.IO disconnect, Redis reconnect |
| `trace` | 10 | Ultra-verbose, rarely used | -- |

### 2.3 Structured Fields

Every log line includes:

```json
{
  "level": 30,
  "time": "2026-03-12T10:30:00.000Z",
  "service": "nit-scs-api",
  "env": "production",
  "msg": "Request completed"
}
```

Request logs add:

```json
{
  "req": {
    "method": "POST",
    "url": "/api/v1/grns",
    "requestId": "abc-123"
  },
  "res": { "statusCode": 201 }
}
```

Error logs include the full error object (message, stack, code) via `pino.stdSerializers.err`.

### 2.4 Child Loggers

For domain-scoped or request-scoped logging:

```typescript
import { createChildLogger } from '../config/logger.js';

const log = createChildLogger({ domain: 'inventory', warehouseId: 'uuid' });
log.info('Cycle count initiated');
// Output: { ..., domain: "inventory", warehouseId: "uuid", msg: "Cycle count initiated" }
```

### 2.5 Backward-Compatible `log()` Function

Many existing callsites use the convenience function:

```typescript
import { log } from '../config/logger.js';

log('info', 'Email sent', { recipient: 'admin@example.com' });
log('error', 'Job failed', { jobName: 'sla_breach', err: error.message });
```

### 2.6 Key Log Patterns to Monitor

```
# Failed jobs (should alert)
{"level":50, "msg":"Job failed", "queue":"*", "attempts":3}

# Dead letter queue entries (critical)
{"level":40, "msg":"Job moved to dead-letter queue"}

# SLA breaches
{"level":40, "msg":"[Scheduler] SLA breach: *"}

# Redis issues
{"level":40, "msg":"Redis PING latency high"}
{"level":40, "msg":"Redis memory usage above 85%"}

# Reconciliation discrepancies
{"level":40, "msg":"[Scheduler] Reconciliation found * discrepancies"}

# Auth failures (security)
{"level":50, "msg":"Authentication failed"}
```

### 2.7 Log Aggregation

| Platform | Integration |
|---|---|
| Datadog | Set `DD_LOGS_INJECTION=true`; Pino JSON is natively compatible |
| ELK Stack | Filebeat -> Logstash -> Elasticsearch; JSON parses directly |
| CloudWatch | Lambda or EC2 stdout capture; JSON auto-parsed |
| Render | Stdout captured automatically; JSON searchable in Render dashboard |

---

## 3. BullMQ Queue Dashboard

### 3.1 Access

The Bull Board dashboard is mounted at `/admin/queues`, protected by authentication and admin role:

```
URL:  https://<host>/admin/queues
Auth: JWT token (admin role required)
```

Middleware chain: `authenticate -> requireRole('admin') -> Bull Board router`

Source: `packages/backend/src/infrastructure/queue/queue-dashboard.ts`

### 3.2 Monitored Queues (11 + DLQ)

| Queue | Oracle Module | Jobs |
|---|---|---|
| `WMS_QUEUE` | WMS | SLA breach/warning, scheduled rules/reports, reconciliation, depreciation, AMC, vehicle maintenance |
| `RCV_QUEUE` | RCV | GRN processing, ASN processing, putaway |
| `INV_QUEUE` | INV | ABC classification, low stock, expired lots, cycle counts, gate pass expiry, anomaly detection, reorder, expiry alerts/quarantine |
| `SHIP_QUEUE` | WSH | Shipment processing, gate passes, dispatch |
| `CUST_QUEUE` | CUST | Customs tariffs, compliance documents |
| `ASN_QUEUE` | ASN | Advanced shipping notice processing |
| `GRN_QUEUE` | GRN | Goods receipt note processing |
| `PICK_QUEUE` | PICK | Wave planning, pick optimization |
| `PUT_QUEUE` | PUT | Directed putaway, slotting |
| `AUD_QUEUE` | AUD | Token cleanup, security monitor, visitor overstay |
| `NOTIF_QUEUE` | ONT | Email retry, equipment return, shipment delays, cycle count alerts, rate card/contract expiry, vehicle maintenance, NCR deadlines, overdue tools |
| `DEAD_LETTER_QUEUE` | DLQ | Failed jobs after max retries (unlimited retention) |

### 3.3 Queue Health Indicators

**Healthy queue:**
- Waiting count < 100
- Active count <= concurrency setting (default: 1)
- Failed count stable (not increasing)
- DLQ empty or near-empty

**Warning signs:**
- Waiting count > 100 and growing (processing bottleneck)
- Failed count increasing (check worker logs)
- DLQ entries > 0 (permanent failures requiring manual review)
- Stalled jobs present (worker crashed mid-execution)

### 3.4 Default Job Settings

| Setting | Value |
|---|---|
| Retry attempts | 3 (up to 5 for critical jobs like reconciliation, cycle counts) |
| Backoff | Exponential, starting at 5-120 seconds depending on job |
| Completed retain | 100 records per queue |
| Failed retain | 500 records per queue |
| DLQ retain | Unlimited (manual cleanup required) |

### 3.5 Dead Letter Queue (DLQ)

Jobs are moved to the DLQ when they exhaust all retry attempts. Each DLQ entry contains:

```json
{
  "originalQueue": "WMS_QUEUE",
  "originalJobName": "SCM_SLA_BREACH_CHECK",
  "originalJobId": "42",
  "data": { "..." },
  "failedReason": "Connection refused",
  "attempts": 3,
  "movedAt": "2026-03-12T10:30:00.000Z"
}
```

**DLQ triage procedure:**

1. Open Bull Board at `/admin/queues`
2. Select `DEAD_LETTER_QUEUE`
3. Review each entry's `failedReason`
4. Fix the root cause (DB connection, external service, data issue)
5. Retry by re-queuing the job to the original queue
6. Remove resolved DLQ entries

### 3.6 Graceful Shutdown

On process termination (`SIGTERM`/`SIGINT`):

1. Workers close first (stop processing new jobs)
2. All queues close (flush pending operations)
3. DLQ closes
4. Worker and queue maps are cleared

Source: `shutdownQueues()` in `packages/backend/src/infrastructure/queue/bullmq.config.ts`

---

## 4. Redis Monitoring

### 4.1 Connection Management

Source: `packages/backend/src/config/redis.ts`

| Setting | Value |
|---|---|
| Max reconnect attempts | 20 (gives up after) |
| Connect timeout | 10 seconds |
| Command timeout | 5 seconds |
| Reconnect strategy | Exponential backoff with jitter: `500ms * 2^min(attempts,8) + random(0-1000ms)`, capped at 30s |
| Error log throttle | 30 seconds (prevents log spam during outages) |
| TLS | Auto-detected from `rediss://` protocol (Upstash compatible) |
| Auto-reconnect errors | `READONLY`, `ECONNRESET`, `ETIMEDOUT` |

### 4.2 Health Check (Automatic)

A periodic health check runs every 30 seconds:

```
[Redis health check every 30s]
  |
  +-- PING -> measure latency
  |     |
  |     +-- > 100ms -> WARN "Redis PING latency high" { latencyMs }
  |
  +-- INFO memory -> parse used_memory / maxmemory
        |
        +-- > 85% -> WARN "Redis memory usage above 85%"
                      { usedMB, maxMB, usagePercent }
```

### 4.3 Redis Uses in the Application

| Feature | Description |
|---|---|
| Rate limiting | Per-IP request counter (500 requests/minute) |
| Token blacklist | Revoked JWT tokens stored until expiry |
| BullMQ state | Job data, status, repeatable schedules, worker heartbeats |
| Scheduler locks | `registerJob()` uses Redis locks to prevent duplicate job execution |
| Socket.IO adapter | Cross-instance pub/sub when horizontally scaled |

### 4.4 Graceful Degradation

- **Development**: Redis is optional; app starts with degraded functionality (in-memory fallbacks)
- **Production**: Redis is required; startup logs an error if connection fails
- All Redis consumers call `getRedis()` which returns `null` when unavailable
- `isRedisAvailable()` provides a boolean check for conditional logic

### 4.5 Manual Monitoring Commands

```bash
# Check connection
redis-cli -u $REDIS_URL ping

# Memory info
redis-cli -u $REDIS_URL info memory

# Queue lengths
redis-cli -u $REDIS_URL llen bull:WMS_QUEUE:wait
redis-cli -u $REDIS_URL llen bull:DEAD_LETTER_QUEUE:wait

# Active workers
redis-cli -u $REDIS_URL scard bull:WMS_QUEUE:workers

# Key count by pattern
redis-cli -u $REDIS_URL --scan --pattern "bull:*" | wc -l
```

---

## 5. Socket.IO Metrics

### 5.1 Connection Security

Source: `packages/backend/src/socket/setup.ts`

| Feature | Configuration |
|---|---|
| Authentication | JWT token in `socket.handshake.auth.token` |
| Rate limiting | 30 events per 10 seconds per socket |
| Token re-validation | Every 5 minutes on long-lived connections |
| Room types | `role:{roleName}`, `user:{userId}`, `doc:{documentId}` |
| Input validation | Document IDs max 64 chars, string type check |

### 5.2 Connection Lifecycle

```
Client connects
  |
  +-- JWT verification (io.use middleware)
  |     +-- Invalid -> Error("Invalid token"), connection refused
  |
  +-- Extract userId, systemRole from JWT
  +-- Join rooms: role:{role}, user:{userId}
  +-- Start token re-check timer (5 min interval)
  |
  +-- Listen for events:
  |     +-- join:document  -> verify permission, join doc:{id}
  |     +-- leave:document -> leave doc:{id}
  |
  +-- On disconnect: clear re-check timer
```

### 5.3 Emit Helpers

| Function | Target | Use Case |
|---|---|---|
| `emitToUser(io, userId, event, data)` | `user:{userId}` room | Direct notifications |
| `emitToRole(io, role, event, data)` | `role:{role}` room | Role-broadcast (SLA alerts) |
| `emitToDocument(io, docId, event, data)` | `doc:{docId}` room | Live document updates |
| `emitEntityEvent(io, event, data)` | All roles with read permission | Entity CRUD broadcasts |

`emitEntityEvent` checks RBAC permissions to determine which roles receive the event. Only roles with `read` permission on the entity's resource will see the broadcast.

### 5.4 Rate Limit Behavior

When a socket exceeds 30 events in 10 seconds:
- `join:document` emits `error:rate_limit` back to client
- `leave:document` is silently ignored
- The rate limit window resets automatically after 10 seconds

### 5.5 Key Socket Events

| Event | Direction | Description |
|---|---|---|
| `sla:breached` | Server -> role rooms | SLA deadline exceeded |
| `sla:warning` | Server -> role rooms | SLA deadline approaching (1h) |
| `inventory:reconciliation` | Server -> role rooms | Daily reconciliation results |
| `inventory:gate-reconciliation` | Server -> role rooms | Gate-vs-MI mismatch |
| `auth:expired` | Server -> user | JWT expired, force re-login |
| `join:document` | Client -> Server | Subscribe to document updates |
| `leave:document` | Client -> Server | Unsubscribe from document |

### 5.6 Structured Log Events

```
[Socket.IO] Connected: {userId} ({role})     -- info level
[Socket.IO] Disconnected: {userId}           -- debug level
[Socket.IO] Token expired for {userId}       -- info level
[Socket.IO] Missing role in JWT payload      -- warn level
[Socket.IO] join:document failed: {error}    -- error level
```

---

## 6. Health Check Endpoints

Source: `packages/backend/src/domains/system/routes/health.routes.ts`

### 6.1 Endpoint Summary

| Endpoint | Auth | HTTP Status | Purpose |
|---|---|---|---|
| `GET /api/v1/health` | None | 200 / 503 | Public health status (status + timestamp only) |
| `GET /api/v1/health/details` | Admin JWT | 200 / 503 | Full component status, memory, uptime |
| `GET /api/v1/live` | None | 200 | Kubernetes liveness probe (always 200 if process is alive) |
| `GET /api/v1/ready` | None | 200 / 503 | Kubernetes readiness probe (checks DB) |

### 6.2 Health Status Logic

```
Database UP + Redis UP  ->  healthy   (HTTP 200)
Database UP + Redis DOWN -> degraded  (HTTP 200)
Database DOWN            -> unhealthy (HTTP 503)
```

### 6.3 Detailed Health Response (Admin Only)

```json
{
  "status": "healthy",
  "version": "v1",
  "timestamp": "2026-03-12T10:30:00.000Z",
  "uptime": 86400,
  "components": {
    "database": { "status": "up", "latencyMs": 2 },
    "redis": { "status": "up", "latencyMs": 1 }
  },
  "memory": {
    "rssBytes": 134217728,
    "heapUsedBytes": 67108864,
    "heapTotalBytes": 100663296,
    "externalBytes": 16777216,
    "rssMB": "128.0 MB",
    "heapUsedMB": "64.0 MB"
  }
}
```

Non-admin users hitting `/api/v1/health/details` receive only the public response (status + timestamp).

### 6.4 Kubernetes Configuration

```yaml
livenessProbe:
  httpGet:
    path: /api/v1/live
    port: 4000
  initialDelaySeconds: 10
  periodSeconds: 30
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /api/v1/ready
    port: 4000
  initialDelaySeconds: 5
  periodSeconds: 10
  failureThreshold: 3
```

---

## 7. SLA Jobs and Cron Schedules

### 7.1 SLA Breach Detection

Source: `packages/backend/src/domains/scheduler/jobs/sla-jobs.ts`

Runs every 5 minutes, checking 7 SLA categories:

| Check | Model | SLA Source | Recipients |
|---|---|---|---|
| Approval SLA | MIRV (MI) | `slaDueDate` field | Pending approver role + admin |
| MR Stock Verification | MaterialRequisition | `stockVerificationSla` or `slaConfig.stock_verification` hours | warehouse_staff + admin |
| JO Execution | JobOrder + JoSlaTracking | `slaDueDate` or `slaConfig.jo_execution` hours | logistics_coordinator + admin |
| Gate Pass | GatePass | `slaConfig.gate_pass` hours since creation | warehouse_staff + warehouse_supervisor + admin |
| Scrap Buyer Pickup | ScrapItem | `buyerPickupDeadline` or `slaConfig.scrap_buyer_pickup` hours | scrap_committee_member + admin |
| Surplus Timeout | SurplusItem | `slaConfig.surplus_timeout` hours since OU Head approval | manager + admin |
| QCI Inspection | RFIM (QCI) | `slaConfig.qc_inspection` hours since creation | qc_officer + admin |

### 7.2 SLA Warning Detection

Same 7 categories, but triggers when the SLA deadline is within the next hour (advance warning). Also runs every 5 minutes, with batch notification queries (`getRecentNotificationRefs`) for performance.

### 7.3 Duplicate Notification Prevention

Both breach and warning jobs call `hasRecentNotification()` (or `getRecentNotificationRefs()` for batch) before sending, preventing duplicate alerts for the same document within a time window.

### 7.4 Complete Job Schedule (28 Jobs)

Source files are under `packages/backend/src/domains/`:

**SLA Jobs** (`scheduler/jobs/sla-jobs.ts`):

| Job | Interval | Lock TTL |
|---|---|---|
| `sla_breach` | 5 min | 4 min |
| `sla_warning` | 5 min | 4 min |

**Maintenance Jobs** (`scheduler/jobs/maintenance-jobs.ts`):

| Job | Interval | Lock TTL | Description |
|---|---|---|---|
| `scheduled_rules` | 1 min | 50 sec | Execute workflow automation rules |
| `email_retry` | 2 min | 90 sec | Retry failed email sends |
| `low_stock` | 30 min | 25 min | Alert on items below min/reorder level |
| `visitor_overstay` | 30 min | 25 min | Detect visitors exceeding expected duration |
| `expired_lots` | 1 hr | 50 min | Mark expired inventory lots |
| `gate_pass_expiry` | 1 hr | 50 min | Cancel gate passes past validUntil |
| `scheduled_reports` | 1 hr | 50 min | Generate daily/weekly/monthly/quarterly reports |
| `security_monitor` | 1 hr | 50 min | Detect suspicious login activity |
| `anomaly_detection` | 6 hr | 5 hr | Statistical anomaly detection on inventory |
| `token_cleanup` | 6 hr | 5 hr | Remove expired JWT refresh tokens |
| `vehicle_maintenance` | 12 hr | 11 hr | Usage-based vehicle maintenance scheduling |
| `cycle_count_auto` | 24 hr | 23 hr | Auto-create cycle counts (ABC-frequency) |
| `daily_reconciliation` | 24 hr | 23 hr | Lot totals + gate-vs-MI reconciliation |
| `asset_depreciation` | 24 hr | 2 hr | Calculate straight-line depreciation |
| `amc_expiry` | 24 hr | 2 hr | AMC/maintenance contract expiry check |
| `abc_classification` | 7 days | 6 days | Recalculate ABC classification |
| `reorder_update` | 7 days | 6 days | Auto-update reorder points from forecast |

**Expiry Jobs** (`inventory/jobs/expiry-jobs.ts`):

| Job | Interval | Lock TTL |
|---|---|---|
| `expiry_alerts` | 24 hr | 2 hr |
| `expiry_quarantine` | 12 hr | ~83 min |

**Notification Jobs** (`notifications/jobs/notification-jobs.ts`):

| Job | Interval | Lock TTL |
|---|---|---|
| `sow_equipment_return` | 24 hr | 23 hr |
| `sow_shipment_delays` | 6 hr | 5 hr |
| `sow_cycle_count` | 24 hr | 23 hr |
| `sow_rate_card_expiry` | 24 hr | 23 hr |
| `sow_vehicle_maint` | 12 hr | 11 hr |
| `sow_ncr_deadline` | 24 hr | 23 hr |
| `sow_contract_renewal` | 24 hr | 23 hr |
| `sow_overdue_tools` | 12 hr | 11 hr |

### 7.5 Lock Mechanism

Each job uses a Redis lock (`registerJob()` in `utils/job-registry.ts`) with a TTL to prevent duplicate execution across multiple instances:

- Lock is acquired before job execution
- Lock TTL is set slightly below the job interval
- If lock acquisition fails, the job is skipped
- Lock is released on job completion or TTL expiry

---

## 8. Error Tracking (Sentry)

### 8.1 Configuration

- **Backend**: `@sentry/node` imported first in `src/index.ts` for proper instrumentation
- **Frontend**: `@sentry/react` error boundary and performance monitoring
- **DSN**: Set via `SENTRY_DSN` environment variable (optional, recommended for production)

### 8.2 What Gets Captured

- Unhandled exceptions and promise rejections
- HTTP 5xx errors from the error handler middleware
- Performance traces for requests and database queries
- React component render errors (frontend)

---

## 9. Alerting Strategy

### 9.1 Recommended Alert Rules

| Alert | Condition | Severity | Channel |
|---|---|---|---|
| API Error Rate | 5xx errors > 1% of requests over 5 min | Critical | PagerDuty/Slack |
| Database Down | Health check returns `unhealthy` | Critical | PagerDuty |
| Redis Down | Health check returns `degraded` | Warning | Slack |
| DLQ Growing | Dead letter queue length > 10 | Warning | Slack |
| Queue Backlog | Any queue waiting count > 500 | Warning | Slack |
| SLA Breach Spike | > 10 SLA breach notifications in 1 hour | Warning | Email to managers |
| Memory Pressure | RSS > 1GB per instance | Warning | Slack |
| Redis Memory | Usage > 85% of maxmemory | Warning | Slack |
| Redis Latency | PING > 100ms sustained | Warning | Slack |
| Reconciliation | Daily reconciliation finds discrepancies | Warning | Slack |
| Auth Failures | > 20 failed logins from same IP in 5 min | Critical | Security team |

### 9.2 Dashboard Recommendations

**Primary dashboard (Grafana/Datadog):**
- Request rate and error rate (from Pino structured logs)
- P50/P95/P99 response time
- Active database connections
- Redis memory, latency, and connection count
- Queue lengths per queue name
- DLQ entry count
- Socket.IO active connections
- SLA breach count by category

**Secondary dashboard (Bull Board at `/admin/queues`):**
- Job completion rate per queue
- Job failure rate per queue
- DLQ triage list
- Worker status and throughput

---

## 10. Troubleshooting Quick Reference

### Queue Jobs Not Running

1. Check Redis connection: `redis-cli -u $REDIS_URL ping`
2. Open Bull Board at `/admin/queues` for stalled jobs
3. Check scheduler service logs for lock acquisition failures
4. Verify job registration in the relevant jobs file
5. Check if the lock TTL is appropriate (should be < interval)

### SLA Notifications Not Sending

1. Verify `sla_breach` and `sla_warning` jobs are running in Bull Board
2. Check `slaConfig` values in the system settings table
3. Confirm recipient roles have active employees assigned
4. Check duplicate notification prevention (`hasRecentNotification`)
5. Review Socket.IO connections for the target roles

### High Redis Memory

1. Check `bull:*` key count (old completed/failed jobs may not be pruning)
2. Verify `removeOnComplete: { count: 100 }` setting in queue config
3. Run `redis-cli info memory` for detailed breakdown
4. Consider increasing `maxmemory` or adding eviction policy
5. Check for leaked rate-limit keys (`ratelimit:*`)

### Database Slow Queries

1. Set `LOG_LEVEL=debug` temporarily for Prisma query logs
2. Review `docs/ops/database-index-strategy.md`
3. Check for missing indexes on frequently filtered columns
4. Monitor connection pool via `/api/v1/health/details` (admin)
5. Check daily reconciliation logs for data integrity issues
