# Monitoring & Alerting Guide

Last updated: 2026-03-12

---

## Overview

NIT Supply Chain V2 uses Pino for structured logging, BullMQ for job queue monitoring,
Redis for cache observability, and Socket.IO for real-time metrics. This guide covers
how to monitor and alert on each layer.

---

## 1. Pino Structured Logging

### Configuration

```typescript
// packages/backend/src/config/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' }
    : undefined,
});
```

### Log Levels

| Level | Usage | Example |
|-------|-------|---------|
| `fatal` | Process cannot continue | Database connection lost |
| `error` | Operation failed | Job failed after max retries |
| `warn` | Degraded but functional | Cache miss, slow query |
| `info` | Normal operations | Server started, job completed |
| `debug` | Development detail | Query parameters, cache hits |
| `trace` | Verbose debugging | Full request/response bodies |

### Log Format (Production)

```json
{
  "level": 30,
  "time": 1710230400000,
  "pid": 1234,
  "msg": "Job completed",
  "jobId": "abc-123",
  "jobName": "sla-check",
  "queue": "WMS_QUEUE",
  "duration": 45
}
```

### Key Log Patterns to Monitor

```
# Failed jobs (should alert)
{"level":50,"msg":"Job failed","queue":"*","attempts":3}

# Dead letter queue entries (critical)
{"level":40,"msg":"Job moved to dead-letter queue"}

# Slow queries (performance)
{"level":40,"msg":"Slow query","duration":">1000ms"}

# Auth failures (security)
{"level":40,"msg":"Authentication failed","ip":"*"}
```

---

## 2. BullMQ Queue Monitoring

### Queue Health Metrics

| Metric | Source | Alert Threshold |
|--------|--------|----------------|
| Waiting jobs | `queue.getWaitingCount()` | > 100 |
| Active jobs | `queue.getActiveCount()` | > 50 |
| Failed jobs | `queue.getFailedCount()` | > 0 (any) |
| DLQ depth | `dlq.getWaitingCount()` | > 0 (immediate) |
| Completed/min | Worker metrics | < 10 (throughput drop) |

### 11 Queues to Monitor

| Queue | SLA | Max Wait |
|-------|-----|----------|
| WMS_QUEUE | 5 min | Critical operations |
| RCV_QUEUE | 10 min | Receiving processing |
| INV_QUEUE | 30 min | Inventory calculations |
| SHIP_QUEUE | 5 min | Shipment dispatch |
| CUST_QUEUE | 15 min | Customs processing |
| ASN_QUEUE | 10 min | ASN processing |
| GRN_QUEUE | 10 min | GRN processing |
| PICK_QUEUE | 5 min | Pick optimization |
| PUT_QUEUE | 10 min | Putaway assignment |
| AUD_QUEUE | 60 min | Audit non-critical |
| NOTIF_QUEUE | 5 min | User notifications |

### Dead Letter Queue

Jobs that fail after 3 attempts (exponential backoff: 5s, 25s, 125s) are moved
to `DEAD_LETTER_QUEUE`. Each DLQ entry contains:

```json
{
  "originalQueue": "WMS_QUEUE",
  "originalJobName": "sla-check",
  "originalJobId": "job-123",
  "data": { ... },
  "failedReason": "Connection timeout",
  "attempts": 3,
  "movedAt": "2026-03-12T10:00:00.000Z"
}
```

### BullMQ Dashboard Setup

```typescript
// Mount Bull Board at /admin/queues (production)
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

const serverAdapter = new ExpressAdapter();
createBullBoard({
  queues: getAllQueues().map(q => new BullMQAdapter(q)),
  serverAdapter,
});
app.use('/admin/queues', serverAdapter.getRouter());
```

---

## 3. Redis Monitoring

### Key Metrics

| Metric | Command | Alert |
|--------|---------|-------|
| Memory usage | `INFO memory` | > 80% maxmemory |
| Connected clients | `INFO clients` | > 100 |
| Keyspace hits/misses | `INFO stats` | Hit rate < 70% |
| Expired keys | `INFO stats` | Rapid increase |
| Blocked clients | `INFO clients` | > 0 sustained |

### Cache Patterns Used

| Pattern | TTL | Purpose |
|---------|-----|---------|
| `cache:permissions:{userId}` | 5 min | RBAC permission cache |
| `cache:workflow-rules` | 10 min | Workflow rule engine |
| `cache:kpi:{dashboardId}` | 2 min | Dashboard KPI data |
| `rate-limit:{ip}:{route}` | 1 min | API rate limiting |
| `session:{token}` | 24 hr | JWT refresh tokens |

### Cache Invalidation Points

| Event | Invalidated Cache |
|-------|------------------|
| Permission updated | `cache:permissions:*` |
| Workflow rule changed | `cache:workflow-rules` |
| Document status changed | Related KPI caches |
| User role changed | `cache:permissions:{userId}` |

---

## 4. Socket.IO Metrics

### Connection Monitoring

| Metric | Description |
|--------|-------------|
| Active connections | Total WebSocket connections |
| Rooms | Active room subscriptions |
| Messages/sec | Event throughput |
| Disconnections/min | Connection stability |

### Room-Based Events

```
warehouse:{id}    -- warehouse-scoped events
document:{type}:{id} -- document-specific updates
user:{id}         -- user notifications
dashboard:global  -- system-wide broadcasts
```

### Event Types

| Event | Room | Payload |
|-------|------|---------|
| `document:statusChanged` | `document:{type}:{id}` | `{ status, updatedBy }` |
| `notification:new` | `user:{id}` | `{ title, body, link }` |
| `kpi:updated` | `dashboard:global` | `{ kpiId, value }` |
| `task:assigned` | `user:{id}` | `{ taskId, taskType }` |

---

## 5. SLA Jobs & Cron Schedules

### Scheduled Jobs

| Job | Schedule | Queue | Purpose |
|-----|----------|-------|---------|
| SLA Check | Every 5 min | WMS_QUEUE | Document SLA violations |
| Token Cleanup | Every 1 hr | AUD_QUEUE | Expired security tokens |
| ABC Analysis | Daily 2 AM | INV_QUEUE | ABC classification refresh |
| Expiry Alerts | Daily 6 AM | INV_QUEUE | Near-expiry notifications |
| Stock Alerts | Every 15 min | INV_QUEUE | Low stock warnings |
| View Refresh | Every 30 min | INV_QUEUE | Materialized view refresh |

### SLA Thresholds

| Document | Pending SLA | Approval SLA |
|----------|------------|-------------|
| GRN | 24 hours | 48 hours |
| MI | 24 hours | 48 hours |
| QCI | 12 hours | 24 hours |
| MR | 24 hours | 72 hours |

---

## 6. Health Check Endpoints

### Endpoints

| Path | Purpose | Expected |
|------|---------|----------|
| `GET /health` | Basic liveness | `{ status: 'ok' }` |
| `GET /health/ready` | Readiness (DB + Redis) | `{ db: 'ok', redis: 'ok' }` |

### Kubernetes Probes

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 30

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
```

---

## 7. Sentry Integration (Recommended)

### Setup

```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,  // 10% of transactions
});

// Add Sentry middleware
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

### Alert Rules

| Condition | Severity | Action |
|-----------|----------|--------|
| Error rate > 5% | Critical | PagerDuty |
| P95 latency > 2s | Warning | Slack |
| DLQ depth > 0 | Critical | Email + Slack |
| Auth failures > 10/min | Critical | Security team |
| Memory > 80% | Warning | Auto-scale |
