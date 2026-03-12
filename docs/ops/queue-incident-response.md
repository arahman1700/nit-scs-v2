# Queue Incident Response Playbook

## Severity Classification

| Severity | Condition | Response Time | Examples |
|----------|-----------|---------------|----------|
| P1 Critical | SLA jobs not running, email queue backed up | 15 min | Redis down in production, all workers crashed |
| P2 High | Single queue stalled, DLQ growing | 1 hour | One worker stuck, specific job type failing |
| P3 Medium | Job delays, intermittent failures | 4 hours | Network latency spikes, memory pressure |
| P4 Low | Minor job failures, non-critical alerts | Next business day | Optional job fails, dashboard inaccessible |

## Incident Playbooks

### INC-01: Redis Connection Lost

**Symptoms**: `[Scheduler] Redis unavailable — falling back to setInterval mode` in logs

**Impact**: Jobs continue via setInterval (no retry/DLQ), rate limiting disabled

**Response**:
1. Check Redis status: `redis-cli PING`
2. Check Redis logs for OOM or crash
3. If managed Redis (Upstash/ElastiCache): check provider status page
4. If self-hosted: restart Redis service, check disk space
5. Backend auto-reconnects with exponential backoff (up to 30s intervals, 20 attempts)
6. Verify recovery: look for `Redis ready — accepting commands` in logs

### INC-02: SLA Breach Jobs Not Running

**Symptoms**: No SLA notifications being generated, documents exceeding deadlines without alerts

**Response**:
1. Check Bull Board: `/admin/queues` → WMS_QUEUE
2. Look for active/waiting jobs named `SCM_SLA_BREACH_CHECK`
3. If no repeatable registered: restart the backend (re-registers all jobs)
4. If job is failing: check DLQ for error details
5. Verify Prisma/database connectivity (SLA jobs query document tables)

### INC-03: Dead Letter Queue Growing

**Symptoms**: DLQ count increasing in Bull Board

**Response**:
1. Open Bull Board → DEAD_LETTER_QUEUE
2. Examine `failedReason` for each DLQ entry
3. Group by `originalJobName` to identify pattern
4. Common causes:
   - Database connection timeout → check Prisma connection pool
   - External service down → check email/push notification services
   - Data integrity issue → check for missing required fields
5. Fix root cause, then retry jobs from DLQ via Bull Board

### INC-04: Worker Stuck / Job Taking Too Long

**Symptoms**: Job in "active" state for extended period, other jobs in same queue not processing

**Response**:
1. Bull Board → select queue → Active tab
2. Note the stuck job's name and data
3. Check if the underlying handler has a long-running query
4. If safe to abort: use Bull Board to fail the job manually
5. If worker is unresponsive: restart backend (graceful shutdown closes workers)
6. Consider adding `lockDuration` to job options if recurring

### INC-05: Email Queue Backed Up

**Symptoms**: `ONT_EMAIL_RETRY` jobs accumulating, emails not being sent

**Response**:
1. Check email service status (SMTP/Resend)
2. Check `processQueuedEmails` error logs
3. If SMTP is down: emails will accumulate and retry (5 attempts with exponential backoff)
4. If SMTP credentials expired: update `.env` and restart
5. Monitor DLQ for permanently failed email jobs

## Recovery Procedures

### Full Queue Reset (Last Resort)
```bash
# Stop the application first
# Clear all BullMQ keys for a specific queue
redis-cli KEYS "bull:WMS_QUEUE:*" | xargs redis-cli DEL

# Restart application — jobs will be re-registered as repeatables
```

### Restart Single Worker
Not supported individually — restart the backend process. Workers are managed as a group.

### Re-register All Jobs
Restart the backend. `startScheduler()` is idempotent — it removes existing repeatables before re-adding.

## Post-Incident

After resolution:
1. Clear any test/debug data from DLQ
2. Verify all 11 queues have active repeatable jobs (Bull Board)
3. Monitor for 30 minutes to confirm stability
4. Document root cause and update this playbook if needed
