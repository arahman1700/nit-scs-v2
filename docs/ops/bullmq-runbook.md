# BullMQ Queue System — Operations Runbook

## Overview

NIT SCS V2 uses BullMQ (Redis-backed) for all background job scheduling. Jobs are organized into Oracle-compatible queues with automatic retry, dead-letter handling, and a web dashboard.

## Queue Architecture

| Queue | Oracle Module | Purpose | Jobs |
|-------|--------------|---------|------|
| `WMS_QUEUE` | WMS | Core WMS operations, SLA checks, reconciliation, asset management | 8 |
| `RCV_QUEUE` | RCV | Receiving — GRN, ASN, putaway processing | 0* |
| `INV_QUEUE` | INV | Stock alerts, expiry, ABC, cycle counts, anomaly detection | 9 |
| `SHIP_QUEUE` | WSH | Shipping execution — shipments, gate passes, dispatch | 0* |
| `CUST_QUEUE` | CUST | Customs clearance — tariffs, compliance documents | 0* |
| `ASN_QUEUE` | ASN | Advanced shipping notice processing | 0* |
| `GRN_QUEUE` | GRN | Goods receipt note processing | 0* |
| `PICK_QUEUE` | PICK | Picking — wave planning, pick optimization | 0* |
| `PUT_QUEUE` | PUT | Putaway — directed putaway, slotting | 0* |
| `AUD_QUEUE` | AUD | Audit & compliance — security, tokens, visitors | 3 |
| `NOTIF_QUEUE` | NOTIF | Notifications — email, push, scheduled alerts | 9 |
| `DEAD_LETTER_QUEUE` | — | Failed jobs after max retries | — |

*\* Queues provisioned for future domain-specific jobs.*

**Total: 29 jobs across 11 queues + 1 DLQ**

## Dashboard Access

- **URL**: `/admin/queues` (requires admin authentication)
- **Enabled**: Always in development; production only if `QUEUE_DASHBOARD=true`
- **Tech**: Bull Board (Express adapter)

## Common Operations

### View job status
```bash
# Via dashboard
open http://localhost:4000/admin/queues

# Via Redis CLI
redis-cli KEYS "bull:WMS_QUEUE:*" | head -20
redis-cli HGETALL "bull:WMS_QUEUE:meta"
```

### Check repeatable jobs
```bash
redis-cli ZRANGE "bull:WMS_QUEUE:repeat" 0 -1
redis-cli ZRANGE "bull:INV_QUEUE:repeat" 0 -1
```

### Clear a stuck queue
```bash
# Remove all waiting jobs
redis-cli DEL "bull:WMS_QUEUE:wait"
redis-cli DEL "bull:WMS_QUEUE:active"

# Or use Bull Board UI: select queue -> Clean All
```

### Retry a failed job
Via Bull Board UI: navigate to the failed job and click "Retry".

### Drain dead-letter queue
```bash
# List DLQ entries
redis-cli LRANGE "bull:DEAD_LETTER_QUEUE:waiting" 0 -1

# Process and remove after investigation
# Use Bull Board UI for individual job management
```

## Fallback Mode

When Redis is unavailable, the scheduler falls back to `setInterval` mode:
- Same job handlers execute on the same intervals
- No retry, no dead-letter, no distributed coordination
- Log message: `[Scheduler] Redis unavailable — falling back to setInterval mode`
- Automatic — no manual intervention needed

## Troubleshooting

### Jobs not executing
1. Check Redis connectivity: `redis-cli PING`
2. Check scheduler logs: `grep "[Scheduler]" logs/`
3. Verify workers are running: check for `Worker started` log entries
4. Check if jobs are stuck in active state (Bull Board -> Active tab)

### High memory usage
1. Check Redis memory: `redis-cli INFO memory`
2. Review `removeOnComplete` / `removeOnFail` settings
3. Clear old completed jobs via Bull Board

### Job keeps failing
1. Check DLQ for the job entry
2. Review `failedReason` in the DLQ entry
3. Check the legacy handler code for the mapped job name
4. Fix the issue and re-queue manually via Bull Board

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `QUEUE_DASHBOARD` | `false` | Enable queue dashboard in production |

## Job Priority Reference

| Priority | Meaning | Examples |
|----------|---------|----------|
| 1 | Critical | SLA breach/warning, email retry |
| 2 | High | Low stock alerts, security monitoring |
| 3 | Normal | Daily reconciliation, expiry checks |
| 4-5 | Standard | Scheduled reports, maintenance checks |
| 6-8 | Low | ABC classification, depreciation |
