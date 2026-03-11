# NIT Supply Chain V2 -- Incident Response Guide

> Last updated: 2026-03-12
> Service: `nit-scs-v2` | On-call rotation: Engineering team

---

## Table of Contents

1. [Severity Classification](#1-severity-classification)
2. [First Responder Checklist](#2-first-responder-checklist)
3. [Common Incidents and Resolution](#3-common-incidents-and-resolution)
4. [Escalation Procedures](#4-escalation-procedures)
5. [Post-Incident Review Template](#5-post-incident-review-template)

---

## 1. Severity Classification

| Severity | Definition | Response Time | Examples |
|----------|-----------|---------------|----------|
| **P1 -- Critical** | Service is completely down or data is being corrupted. All users are affected. | Immediate (within 15 minutes) | Database unreachable, application crash loop, authentication broken for all users, data loss |
| **P2 -- Major** | A core feature is broken but the service is partially functional. Multiple users affected. | Within 1 hour | Document creation failing, real-time updates not working, scheduler completely stopped, email delivery failed for all |
| **P3 -- Minor** | A non-critical feature is degraded. Limited user impact. | Within 4 hours | Redis down (fallback active), PDF export broken, one scheduled job failing, slow queries on a specific page |
| **P4 -- Low** | Cosmetic issue, documentation error, or minor inconvenience. | Next business day | UI alignment issue, non-critical log warning spam, stale cache data |

### When to Upgrade Severity

- P3 -> P2: If the issue persists for more than 2 hours and workarounds are impractical
- P2 -> P1: If more than 50% of users are unable to perform their primary workflow
- Any severity: Immediately upgrade to P1 if data integrity is at risk

---

## 2. First Responder Checklist

When an incident is reported, follow this sequence:

### Step 1: Assess (2 minutes)

- [ ] Confirm the issue is real (not a local network/browser problem)
- [ ] Determine severity using the classification above
- [ ] Start an incident log with timestamp, reporter, and initial symptoms

### Step 2: Triage (5 minutes)

- [ ] Check the health endpoint:
  ```bash
  curl -s https://your-app.onrender.com/api/health | jq
  ```
- [ ] Check Render service status (Dashboard -> Services -> nit-scs-v2)
- [ ] Check Sentry for recent errors (sentry.io -> nit-scs-v2 project)
- [ ] Check Render logs for error patterns:
  - Filter for `ERROR`, `FATAL`, `unhandled`, `SIGTERM`
- [ ] Check PostgreSQL status (Render Dashboard -> Databases -> nit-scs-v2-db)

### Step 3: Communicate (within SLA response time)

- [ ] Notify affected users that the issue is acknowledged
- [ ] For P1/P2: Post in the team channel with:
  - What is broken
  - Estimated impact
  - Who is investigating
  - Next update time (every 30 minutes for P1, every hour for P2)

### Step 4: Investigate and Resolve

- [ ] Follow the relevant section in [Common Incidents](#3-common-incidents-and-resolution)
- [ ] Document all actions taken with timestamps
- [ ] Verify the fix with the original reporter

### Step 5: Close

- [ ] Confirm the incident is resolved
- [ ] Update the incident log with resolution details
- [ ] For P1/P2: Schedule a post-incident review within 48 hours

---

## 3. Common Incidents and Resolution

### 3.1 Database Connection Failures

**Symptoms:**
- Health endpoint returns `{"status": "unhealthy"}` (HTTP 503)
- Readiness probe returns `{"status": "not_ready"}`
- Application logs show `PrismaClientInitializationError` or `Can't reach database server`
- All API requests return 500 errors

**Diagnosis:**
```bash
# Check health endpoint for database component
curl -s https://your-app.onrender.com/api/v1/health/details \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .components.database

# Check Render database status
# Dashboard > Databases > nit-scs-v2-db > Metrics

# Verify connection from a local machine (if you have the connection string)
psql "$DATABASE_URL" -c "SELECT 1"
```

**Resolution:**

| Cause | Fix |
|-------|-----|
| Render database maintenance | Wait for Render to complete maintenance (usually < 5 minutes). The app will auto-reconnect. |
| Connection pool exhaustion | Restart the service. Add `?connection_limit=20&pool_timeout=10` to `DATABASE_URL` if not present. |
| Database disk full (free tier: 1GB) | Run cleanup queries to remove old audit logs and notifications. Consider upgrading the database plan. |
| Network issue between service and database | Restart the service. If persistent, contact Render support. |
| Credentials changed | Update `DATABASE_URL` in Render environment variables and redeploy. |

**Cleanup queries for disk space:**
```sql
-- Delete audit logs older than 90 days
DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';

-- Delete read notifications older than 30 days
DELETE FROM notifications WHERE is_read = true AND created_at < NOW() - INTERVAL '30 days';

-- Delete expired refresh tokens
DELETE FROM refresh_tokens WHERE expires_at < NOW();
```

---

### 3.2 Redis Connection Failures

**Symptoms:**
- Health endpoint returns `{"status": "degraded"}` (HTTP 200 -- not 503)
- Logs show `Redis connection error` or `Redis connect() promise rejected`
- Rate limiting falls back to in-memory (per-instance, not distributed)
- Token blacklisting falls back to in-memory
- Scheduler locks always acquired (all instances run all jobs)

**Diagnosis:**
```bash
# Check health endpoint for Redis component
curl -s https://your-app.onrender.com/api/v1/health/details \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .components.redis

# Test Redis connectivity (Upstash)
redis-cli --tls -u "$REDIS_URL" ping
```

**Resolution:**

| Cause | Fix |
|-------|-----|
| Upstash daily command limit exceeded (10k on free tier) | Wait until the next UTC day for limit reset, or upgrade the plan. The app continues to function with in-memory fallback. |
| Upstash outage | Check Upstash status page. The app degrades gracefully. |
| Invalid `REDIS_URL` | Verify the URL in Render env vars. Ensure `rediss://` prefix for TLS. |
| TLS handshake failure | Ensure the `REDIS_URL` uses `rediss://` (double s) for Upstash. |

**Important:** Redis failures are non-fatal. The application continues to serve requests with these degradations:
- Rate limiting uses in-memory Map (not shared across instances)
- Token blacklist uses in-memory Set (revoked tokens may work on other instances)
- Scheduler locks are not enforced (jobs may run on all instances simultaneously)
- The `/api/health` endpoint reports `degraded` instead of `healthy`

---

### 3.3 JWT Token Issues

**Symptoms:**
- Users receive 401 "Invalid or expired token" errors
- Users receive 401 "Token has been revoked" errors
- Login succeeds but subsequent requests fail

**Diagnosis:**
```bash
# Decode a token (without verification) to check expiry
echo "<TOKEN>" | cut -d. -f2 | base64 -d 2>/dev/null | jq '{exp: .exp, iat: .iat, userId: .userId, expTime: (.exp | todate)}'

# Check if server time is correct
curl -s https://your-app.onrender.com/api/health | jq .timestamp
```

**Resolution:**

| Cause | Fix |
|-------|-----|
| Token expired normally | Client should use the refresh token to obtain a new access token (POST `/api/v1/auth/refresh`). |
| `JWT_SECRET` changed between deploys | If the secret was rotated, all existing tokens are invalid. Users must log in again. This is expected. |
| Clock skew between client and server | Check server timestamp via health endpoint. JWT allows a small tolerance but large skew breaks validation. |
| Token blacklisted after logout | Expected behavior. The user must log in again. |
| Redis down + token revoked | The in-memory blacklist fallback is used. If the revocation was recorded before Redis went down, it will be honored. If not, the token remains valid until expiry. |

**Emergency: Force all users to re-authenticate:**
```bash
# Rotate JWT_SECRET in Render env vars and redeploy
# All existing access tokens become invalid immediately
# All refresh tokens also become invalid (uses JWT_REFRESH_SECRET)
```

---

### 3.4 Rate Limiter Blocking Legitimate Traffic

**Symptoms:**
- Users receive 429 "Too many requests" responses
- The `Retry-After` header indicates seconds until the limit resets
- `X-RateLimit-Remaining: 0` in response headers

**Diagnosis:**
```bash
# Check rate limit headers from a request
curl -s -I https://your-app.onrender.com/api/v1/health | grep -i ratelimit

# Check Redis for rate limit keys
redis-cli --tls -u "$REDIS_URL" KEYS "rl:*"

# Check a specific IP's rate limit counter
redis-cli --tls -u "$REDIS_URL" GET "rl:global:<IP_ADDRESS>"
redis-cli --tls -u "$REDIS_URL" TTL "rl:global:<IP_ADDRESS>"
```

**Current Rate Limits:**

| Limiter | Max Requests | Window | Key Pattern |
|---------|-------------|--------|-------------|
| Global | 500 per IP | 60 seconds | `rl:global:<IP>` |
| Auth (login/forgot-password) | 5 per IP per path | 15 minutes | `rl:auth:<IP>:<path>` |
| AI endpoints | 30 per user | 1 hour | `rl:ai:<userId>` |

**Resolution:**

| Cause | Fix |
|-------|-----|
| Legitimate high traffic from a single IP | Clear the specific key: `redis-cli DEL "rl:global:<IP>"`. Consider increasing the limit. |
| User locked out of login | Clear the auth key: `redis-cli DEL "rl:auth:<IP>:/auth/login"`. |
| Automated script hitting the API too fast | The rate limiter is working correctly. Advise the script author to add backoff. |
| Shared corporate IP affecting multiple users | Consider adding the IP to an allowlist or increasing the global limit. |
| Redis down + high traffic | In-memory fallback is per-instance. If behind a load balancer, each instance tracks independently, effectively multiplying the limit. |

**Temporarily increase the rate limit:**

The rate limit is configured in `packages/backend/src/routes/index.ts`:
```typescript
router.use(rateLimiter(500, 60_000)); // 500 requests per 60 seconds per IP
```
Change the value and redeploy. There is no runtime configuration for this.

---

### 3.5 Socket.IO Disconnections

**Symptoms:**
- Real-time notifications stop appearing
- Dashboard data does not update automatically
- Browser console shows WebSocket connection errors
- Multiple `disconnect`/`reconnect` events in logs

**Diagnosis:**
```bash
# Check if WebSocket upgrade is working
curl -s -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  https://your-app.onrender.com/socket.io/?EIO=4&transport=polling

# Check active Socket.IO connections (from detailed health if available)
curl -s https://your-app.onrender.com/api/v1/health/details \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq
```

**Resolution:**

| Cause | Fix |
|-------|-----|
| Render free tier sleep | Free tier services sleep after 15 minutes of inactivity. Upgrade to a paid plan for always-on. |
| CORS blocking WebSocket | Ensure `CORS_ORIGIN` includes the frontend URL. Socket.IO server uses the same CORS config as Express. |
| Client reconnect storm | Socket.IO has built-in exponential backoff. If many clients reconnect simultaneously, server may be briefly overloaded. This is self-resolving. |
| Proxy/firewall blocking WebSocket | Socket.IO falls back to long-polling automatically. Check if the proxy allows `Upgrade: websocket` headers. |
| Server restart | Socket.IO clients auto-reconnect. Verify the `reconnection: true` setting in the frontend client config. |

---

### 3.6 Scheduler Job Failures

**Symptoms:**
- SLA breach/warning notifications stop arriving
- Expired lots are not being marked
- Low stock alerts not triggered
- Logs show `[Scheduler] <job_name> failed: <error>`

**Diagnosis:**
```bash
# Search logs for scheduler errors
# Render Dashboard > Logs > Filter: "[Scheduler]"

# Check if scheduler is running (look for startup log)
# "[Scheduler] Starting background job scheduler"
# "[Scheduler] All jobs registered"

# Check Redis locks (a stuck lock prevents re-execution)
redis-cli --tls -u "$REDIS_URL" KEYS "scheduler:lock:*"
redis-cli --tls -u "$REDIS_URL" TTL "scheduler:lock:sla_breach"
```

**Resolution:**

| Cause | Fix |
|-------|-----|
| Database query timeout in job | The job will retry on the next interval. Check for slow queries and add indexes if needed. |
| Stuck Redis lock | Clear the lock: `redis-cli DEL "scheduler:lock:<job_name>"`. The job will acquire the lock on the next tick. |
| All jobs stopped after error | Restart the service. Individual job errors do not affect other jobs, but a crash in the scheduler lifecycle stops all. |
| Job running too long (exceeds lock TTL) | The lock expires and another execution may start concurrently. Review the job's database queries for performance. |
| Scheduled rules not initializing | Check logs for `[Scheduler] Failed to initialize scheduled rules`. Verify workflow rules in the database have valid `nextRunAt` values. |

**Manual check for specific job issues:**
```sql
-- Check if email retry is working
SELECT status, COUNT(*) FROM email_queue GROUP BY status;

-- Check if lot expiry marking is working
SELECT COUNT(*) FROM inventory_lots WHERE status = 'active' AND expiry_date < NOW();

-- Check if gate pass expiry is working
SELECT COUNT(*) FROM gate_passes WHERE status IN ('approved', 'pending') AND valid_until < NOW();
```

---

### 3.7 High Memory/CPU Usage

**Symptoms:**
- Response times increasing
- Health check shows high RSS memory (> 500 MB)
- Render logs show `FATAL ERROR: Heap out of memory`
- Container killed by OOM (Out of Memory) killer

**Diagnosis:**
```bash
# Check memory via detailed health endpoint
curl -s https://your-app.onrender.com/api/v1/health/details \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .memory

# Check Render metrics
# Dashboard > Services > nit-scs-v2 > Metrics > Memory / CPU
```

**Resolution:**

| Cause | Fix |
|-------|-----|
| Memory leak in long-running process | Restart the service. If recurring, check for unbounded arrays/maps in scheduler jobs or Socket.IO rooms. |
| Large query result sets | Add pagination. Check for `findMany` calls without `take` limits in domain services. |
| Too many concurrent Socket.IO connections | Monitor connection count. Consider implementing connection limits per user. |
| In-memory rate limiter growing unbounded | The cleanup interval runs every 60 seconds. If many unique IPs hit the service (DDoS), the map grows. Connect Redis to use the Redis-backed limiter instead. |
| Prisma query engine caching | Prisma caches prepared statements. This is normal growth. If it exceeds container limits, increase the container memory. |

**Emergency memory reduction:**
1. Restart the service (quickest fix)
2. If recurring, add `NODE_OPTIONS="--max-old-space-size=384"` to environment variables to set a hard heap limit
3. Check recent code changes for:
   - Unbounded array accumulation in scheduler jobs
   - Missing `take` limits in Prisma queries
   - Large file processing without streaming

---

## 4. Escalation Procedures

### Escalation Matrix

| Severity | First Responder | Escalation 1 (30 min) | Escalation 2 (1 hour) |
|----------|----------------|----------------------|----------------------|
| P1 | On-call engineer | Engineering lead | CTO / Project manager |
| P2 | On-call engineer | Engineering lead | -- |
| P3 | Any engineer | On-call engineer | -- |
| P4 | -- (next business day) | -- | -- |

### When to Escalate

Escalate immediately if:
- You cannot identify the root cause within 15 minutes (P1) or 30 minutes (P2)
- The fix requires access you do not have (database admin, Render admin, DNS)
- The issue affects data integrity (records being created/modified incorrectly)
- Multiple systems are failing simultaneously (may indicate infrastructure-level issue)

### External Escalation

| Service | How to Contact | When |
|---------|---------------|------|
| Render | Render Dashboard -> Support, or support@render.com | Infrastructure issues (networking, database, deployments) |
| Upstash | Upstash Console -> Support | Redis connectivity or performance issues |
| Sentry | N/A (self-service) | Error tracking platform issues |
| Resend | Resend Dashboard -> Support | Email delivery failures |

---

## 5. Post-Incident Review Template

Complete this template within 48 hours of resolving a P1 or P2 incident.

---

### Incident Report: [TITLE]

**Date:** YYYY-MM-DD
**Severity:** P1 / P2
**Duration:** HH:MM (from detection to resolution)
**Impact:** [Number of affected users, affected features]

### Timeline

| Time (UTC) | Event |
|-----------|-------|
| HH:MM | Issue first reported by [who] |
| HH:MM | First responder [who] begins investigation |
| HH:MM | Root cause identified: [brief description] |
| HH:MM | Fix deployed / mitigation applied |
| HH:MM | Service confirmed restored |

### Root Cause

[2-3 paragraphs describing the technical root cause. Be specific about the code, configuration, or infrastructure component that failed and why.]

### Detection

- How was the incident detected? (monitoring alert, user report, health check)
- Could we have detected it earlier? How?

### Resolution

[Step-by-step description of what was done to resolve the incident. Include specific commands, code changes, or configuration updates.]

### Impact

- Users affected: [number or percentage]
- Data impact: [any data loss, corruption, or inconsistency]
- Business impact: [SLA violations, workflow interruptions]

### Action Items

| Priority | Action | Owner | Due Date |
|----------|--------|-------|----------|
| P1 | [Immediate fix or prevention] | [Name] | [Date] |
| P2 | [Monitoring improvement] | [Name] | [Date] |
| P3 | [Long-term architectural change] | [Name] | [Date] |

### Lessons Learned

- What went well during the response?
- What could have gone better?
- What will we change to prevent this class of incident?

---
