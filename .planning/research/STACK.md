# Technology Stack — Production Hardening

**Project:** NIT Supply Chain V2
**Researched:** 2026-03-22
**Mode:** Ecosystem (production hardening focus)

## Current Stack (No Changes Needed)

The existing stack is modern and appropriate. This document focuses on **configuration hardening**, not technology replacement.

| Layer | Technology | Version | Status |
|-------|-----------|---------|--------|
| Frontend | React 19 + Vite 6 | 19.2.4 / 6.2.0 | Current |
| Backend | Express 5 + TypeScript 5.8 | 5.1.0 | Current |
| ORM | Prisma 6 | 6.5.0 | Current |
| Database | PostgreSQL 15 | 15-alpine | Current |
| Cache/Queue | Redis 7 + BullMQ 5 | 7-alpine / 5.71.0 | Current |
| Real-time | Socket.IO 4 | 4.8.0 | Current |
| Observability | Pino 10 + Sentry 10 + prom-client 15 | 10.3.0 / 10.38.0 / 15.1.3 | Current |

---

## Critical Production Fixes (Must-Do)

### 1. Redis Memory Policy: `allkeys-lru` WILL Break BullMQ

**Confidence:** HIGH (BullMQ official docs)
**Current state:** `docker-compose.yml` line 33 sets `--maxmemory-policy allkeys-lru`
**Problem:** BullMQ stores job state in Redis keys. With `allkeys-lru`, Redis evicts BullMQ keys under memory pressure, causing silent job loss, stuck workers, and corrupt queue state. The BullMQ production guide explicitly states this is the most common misconfiguration.

**Fix:**
```yaml
# docker-compose.yml (development)
command: redis-server --appendonly yes --maxmemory 128mb --maxmemory-policy noeviction

# Production Redis (Upstash/managed)
# Set maxmemory-policy to noeviction in your provider's dashboard
```

**Rationale:** `noeviction` returns errors when memory is full instead of silently deleting keys. This surfaces the problem (upgrade Redis or optimize) rather than hiding it (corrupt job data).

### 2. BullMQ Worker `maxRetriesPerRequest` Must Be `null`

**Confidence:** HIGH (BullMQ official docs)
**Current state:** The main Redis client in `config/redis.ts` sets `maxRetriesPerRequest: 3`. The BullMQ config in `bullmq.config.ts` correctly sets `maxRetriesPerRequest: null`. However, any code that passes the shared Redis client to BullMQ will break.

**Fix:** Ensure BullMQ always uses its own connection with `maxRetriesPerRequest: null`. Never share the application Redis client with BullMQ workers.

**Rationale:** BullMQ Workers use blocking Redis commands (BRPOPLPUSH). With a retry limit, ioredis raises an exception after the limit is hit, crashing the worker. The `null` value means "retry forever," which is correct for long-lived blocking consumers.

### 3. Prisma Connection Pooling Must Be Explicitly Configured

**Confidence:** HIGH (Prisma official docs)
**Current state:** `prisma.ts` creates `new PrismaClient()` with no connection pool configuration. The `STACK.md` notes that production should use `?connection_limit=20&pool_timeout=10` but this is documentation only -- it depends on the `DATABASE_URL` string.

**Fix:** Enforce pool settings in the `DATABASE_URL` for production:
```
DATABASE_URL="postgresql://user:pass@host:5432/nit_scs?connection_limit=20&pool_timeout=10&sslmode=require"
```

Add validation in `env.ts`:
```typescript
DATABASE_URL: z.string().url().refine(
  url => {
    if (process.env.NODE_ENV !== 'production') return true;
    return url.includes('connection_limit') && url.includes('sslmode=require');
  },
  'Production DATABASE_URL must include connection_limit and sslmode=require'
),
```

**Rationale:** Prisma's default pool size is `num_cpus * 2 + 1`. On a single-core Render container that is 3 connections, which is too few for concurrent API requests. On a beefy machine, it could be too many and exhaust PostgreSQL's `max_connections`. Explicit configuration prevents both failure modes.

### 4. Express `trust proxy` Needs Tightening

**Confidence:** MEDIUM (Express official docs)
**Current state:** `app.set('trust proxy', 1)` -- trusts the first proxy hop. This is correct for Render.com's single-proxy architecture.

**Fix:** For production environments behind Render/Cloudflare, `1` is correct. If you add Cloudflare in front of Render, you need `2`. Document this in env config:
```typescript
TRUST_PROXY: z.coerce.number().default(1), // 1 for Render, 2 for Cloudflare+Render
```

**Rationale:** Wrong `trust proxy` setting means `req.ip` returns the proxy's IP instead of the client's, making rate limiting useless (all requests appear from one IP) or spoofable (clients forge `X-Forwarded-For`).

---

## Express 5 Production Configuration

### Helmet Security Headers

**Confidence:** HIGH (verified in codebase + Helmet docs)
**Current state:** Good. CSP, HSTS, referrer-policy all configured in `index.ts`.

**Improvements needed:**

| Setting | Current | Recommended | Why |
|---------|---------|-------------|-----|
| CSP `report-uri` | Not set | Add `report-uri` directive pointing to Sentry CSP endpoint | Detect CSP violations in production without breaking functionality |
| CSP `upgrade-insecure-requests` | Not set | Add when serving over HTTPS | Automatically upgrade HTTP resource loads to HTTPS |
| `X-Content-Type-Options` | Default (nosniff) | Keep default | Already correct |
| HSTS preload | Enabled | Keep, but only submit to preload list after confirming HTTPS works | Cannot undo preload submission |

### Body Parser Limits

**Confidence:** HIGH
**Current state:** `express.json({ limit: '2mb' })` -- good, but needs tightening.

**Recommendation:**
```typescript
// Default: strict limit for most API endpoints
const jsonParser = express.json({ limit: '256kb' });

// Relaxed: only for file-related endpoints (uploads, Excel imports)
const largeJsonParser = express.json({ limit: '5mb' });
```

**Rationale:** 2MB is generous for most API payloads. A GRN with 500 line items is ~50KB of JSON. Tighter limits reduce memory consumption under load and limit abuse vectors.

### Compression Configuration

**Confidence:** MEDIUM
**Current state:** `app.use(compression())` with defaults.

**Recommendation:**
```typescript
app.use(compression({
  threshold: 1024,        // Don't compress responses under 1KB
  level: 6,               // Balance between speed and ratio (default is 6, which is fine)
  filter: (req, res) => {
    // Don't compress SSE/streaming responses
    if (req.headers['accept'] === 'text/event-stream') return false;
    return compression.filter(req, res);
  },
}));
```

### Graceful Shutdown

**Confidence:** HIGH (verified in codebase)
**Current state:** Already well-implemented in `index.ts` lines 203-249. Has in-flight request tracking, drain timeout (5s), force exit (10s), and proper signal handling.

**Improvements needed:**

1. **BullMQ queues are not shut down** in the `shutdown()` function. The `shutdownQueues()` function exists in `bullmq.config.ts` but is never called.

```typescript
async function shutdown(signal: string) {
  // ... existing code ...
  stopScheduler();
  io.close();
  await shutdownQueues(); // ADD THIS - closes workers before queues
  // ... rest of drain logic ...
}
```

2. **Increase drain timeout to 15s** for production. Supply chain operations (stock transfers with multiple DB writes) can take longer than 5s.

3. **Add BullMQ shutdown to the timeout**. The 10s force-exit should account for BullMQ worker drain:
```typescript
setTimeout(() => process.exit(1), 15_000); // Increase from 10s to 15s
```

---

## Prisma 6 Production Optimization

### Query Performance

**Confidence:** HIGH (Prisma official docs)

| Recommendation | Why | Impact |
|---------------|-----|--------|
| Use `select` instead of `include` for list endpoints | Reduces data transfer by 40-70% | HIGH |
| Add `relationJoins` preview feature (Prisma 6) | Uses SQL JOINs instead of multiple queries | HIGH for N+1 patterns |
| Add `@index` to all foreign keys in Prisma schema | PostgreSQL does NOT auto-index FKs | HIGH for JOIN performance |
| Use `findMany` with `cursor`-based pagination | More efficient than `skip/take` for large datasets | MEDIUM for tables > 10K rows |

**Enable relation joins in `schema.prisma`:**
```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["relationJoins"]
}
```

### Logging

**Confidence:** HIGH
**Current state:** Production logs only `['error']`. Good.

**Recommendation:** Add query event logging behind a debug flag for troubleshooting:
```typescript
const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['warn', 'error']
    : process.env.PRISMA_DEBUG === 'true'
      ? [{ emit: 'event', level: 'query' }]
      : ['error'],
});
```

### Connection Lifecycle

**Confidence:** HIGH
**Current state:** Uses global singleton pattern. Good.

**Missing:** The `$disconnect()` in shutdown is called, but there is no explicit `$connect()` at startup with error handling. Prisma lazy-connects on first query, which means the first API request pays the connection penalty.

**Recommendation:**
```typescript
// In index.ts, after httpServer.listen():
prisma.$connect().then(() => {
  logger.info('Prisma connected to database');
}).catch(err => {
  logger.error({ err }, 'Failed to connect to database');
  process.exit(1);
});
```

---

## PostgreSQL Production Tuning

**Confidence:** MEDIUM (general best practices, specific values depend on deployment hardware)

### Critical Settings for Render/Docker Deployment

For a single Render instance with 1-2GB RAM:

| Parameter | Default | Recommended | Rationale |
|-----------|---------|-------------|-----------|
| `shared_buffers` | 128MB | 256MB (25% of RAM) | PostgreSQL data cache |
| `effective_cache_size` | 4GB | 768MB (75% of 1GB) | Query planner hint for index decisions |
| `work_mem` | 4MB | 8MB | Per-sort/hash operation; OLTP needs modest amounts |
| `maintenance_work_mem` | 64MB | 128MB | For VACUUM, CREATE INDEX operations |
| `max_connections` | 100 | 30 | Single app instance with pool_size=20 needs: 20 + 5 (admin) + 5 (buffer) |
| `random_page_cost` | 4.0 | 1.1 | For SSD storage (all cloud providers) -- encourages index use |
| `effective_io_concurrency` | 1 | 200 | For SSD storage |
| `checkpoint_completion_target` | 0.9 | 0.9 | Already optimal |
| `wal_buffers` | -1 (auto) | 16MB | Adequate for write-heavy supply chain ops |
| `log_min_duration_statement` | -1 (off) | 500 | Log queries slower than 500ms |

### Index Strategy

**Confidence:** HIGH (this is a known gap from PROJECT.md)

**Must-add indexes for supply chain queries:**
- All `status` columns on document tables (MRRV, MIRV, MRV, etc.) -- most queries filter by status
- All `warehouseId` foreign keys -- warehouse-scoped queries are the most common pattern
- All `createdAt` columns -- date-range filtering on every list endpoint
- Composite index on `(warehouseId, status, createdAt)` for the most common dashboard query pattern
- `documentNumber` columns -- unique lookups by document number

### pg_stat_statements

**Recommendation:** Enable `pg_stat_statements` extension in production to identify slow queries:
```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

This allows querying the top slow/frequent queries without application-level changes.

---

## Redis Production Configuration

### Managed Redis (Upstash) Recommendations

**Confidence:** HIGH (Upstash docs + ioredis docs)

| Setting | Current | Recommended | Why |
|---------|---------|-------------|-----|
| Eviction policy | `allkeys-lru` (docker-compose) | `noeviction` | **CRITICAL** -- BullMQ requires this |
| Persistence | AOF (docker-compose) | AOF with `appendfsync everysec` | Balance durability vs performance |
| TLS | Auto-detected via `rediss://` | Always use `rediss://` in production | Encrypt data in transit |
| `maxRetriesPerRequest` (app client) | 3 | 3 for app, `null` for BullMQ | Already correct, but document the split |

### ioredis Connection Hardening

**Confidence:** HIGH (verified in codebase)
**Current state:** Already well-hardened in `config/redis.ts`. Exponential backoff, jitter, health checks, memory monitoring, TLS detection, error throttling.

**One gap:** The `commandTimeout: 5_000` may be too aggressive for large `SCAN` operations or `INFO` commands under load. Recommend `10_000` for command timeout:
```typescript
commandTimeout: 10_000, // 10s per-command timeout
```

### Separate Redis Instances

**Confidence:** MEDIUM (BullMQ best practice)
**Recommendation:** Use separate Redis instances (or at least separate databases) for:
1. **Application cache** (sessions, rate limiting, token blacklist) -- database 0
2. **BullMQ queues** (job state) -- database 1 or separate instance

This prevents a BullMQ memory spike from evicting cache keys and vice versa. On Upstash free tier this may not be feasible, but plan for it on paid tiers.

---

## Socket.IO Production Scaling

### Single-Instance Deployment (Current Plan)

**Confidence:** HIGH
**Current state:** No Redis adapter configured. Socket.IO runs in-memory.

**For Render free tier (single instance), this is correct.** No Redis adapter or sticky sessions needed.

**When you scale to 2+ instances**, you MUST add:
```typescript
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();

io.adapter(createAdapter(pubClient, subClient));
```

And configure sticky sessions at the load balancer, OR disable HTTP long-polling:
```typescript
const io = new SocketIOServer(httpServer, {
  cors: corsOptions,
  transports: ['websocket'], // Skip long-polling, eliminates sticky session requirement
});
```

### Connection Limits

**Confidence:** MEDIUM
**Current state:** No explicit `maxHttpBufferSize` or connection limit.

**Recommendation:**
```typescript
const io = new SocketIOServer(httpServer, {
  cors: corsOptions,
  maxHttpBufferSize: 1e6,      // 1MB max message size (default is 1e6, explicit is better)
  pingTimeout: 20000,           // 20s (default is 20s, fine)
  pingInterval: 25000,          // 25s (default is 25s, fine)
  connectTimeout: 10000,        // 10s to complete handshake
  // Limit connections per IP (not built-in, implement in middleware)
});
```

---

## Frontend Production Build Optimization

### Vite Build Configuration

**Confidence:** HIGH (verified in codebase)
**Current state:** Has manual chunks for `recharts`, `@dnd-kit`, and `socket.io-client`. Missing critical vendor splits.

**Recommended `manualChunks`:**
```typescript
manualChunks: {
  // React core (~140KB gzipped)
  'vendor-react': ['react', 'react-dom', 'react-router-dom'],
  // Data layer (~45KB gzipped)
  'vendor-data': ['@tanstack/react-query', 'axios', 'zustand'],
  // Form handling (~25KB gzipped)
  'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
  // Charts (~80KB gzipped)
  'vendor-charts': ['recharts'],
  // DnD (~20KB gzipped)
  'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
  // Table (~15KB gzipped)
  'vendor-table': ['@tanstack/react-table', '@tanstack/react-virtual'],
  // Socket.IO client (~20KB gzipped)
  'vendor-socket': ['socket.io-client'],
},
```

**Rationale:** Splitting React, data-layer, and form libraries into separate chunks means they are cached independently. When you update application code, users do not re-download React. This reduces repeat-visit load time by 40-60%.

### Source Maps in Production

**Confidence:** HIGH
**Current state:** `sourcemap: true` -- generates source maps and ships them.

**Recommendation:** Change to `sourcemap: 'hidden'` for production. This generates source maps (for Sentry upload) but does NOT reference them in the built files, so browsers cannot access them.

```typescript
build: {
  sourcemap: 'hidden', // Generate for Sentry, don't expose to users
}
```

### Bundle Analysis

**Recommendation:** Add `rollup-plugin-visualizer` as a dev dependency for ongoing bundle monitoring:
```bash
pnpm --filter @nit-scs-v2/frontend add -D rollup-plugin-visualizer
```

---

## Observability Stack Hardening

### Pino Logging

**Confidence:** HIGH (verified in codebase)
**Current state:** Well-configured. JSON in production, pretty in dev, ISO timestamps, service name, request/response serializers.

**Improvements:**

1. **Add `redact` configuration** to prevent PII in logs:
```typescript
export const logger = pino({
  // ... existing config ...
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token', '*.secret'],
    censor: '[REDACTED]',
  },
});
```

2. **Use `pino-http`** instead of the custom `requestLogger` middleware for automatic request/response correlation with child loggers:
```typescript
import pinoHttp from 'pino-http';
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));
```

3. **Add AsyncLocalStorage** for request-scoped correlation IDs without passing logger through function arguments.

### Sentry Configuration

**Confidence:** HIGH (verified in codebase)
**Current state:** Good. PII redaction, trace sampling, release tagging.

**Improvements:**

| Setting | Current | Recommended | Why |
|---------|---------|-------------|-----|
| `tracesSampleRate` | 0.3 (prod) | Start with 0.1, increase if quota allows | 30% is expensive on Sentry's paid plans; 10% is sufficient for identifying patterns |
| `profilesSampleRate` | Not set | 0.1 | CPU profiling for slow endpoint identification |
| `integrations` | Default | Add `prismaIntegration` | Auto-instruments Prisma queries in Sentry traces |
| `ignoreErrors` | Not set | Add `['ECONNRESET', 'EPIPE', 'socket hang up']` | Don't waste Sentry quota on client disconnections |

### Prometheus Metrics

**Confidence:** HIGH (verified in codebase)
**Current state:** Good foundation with HTTP duration, total requests, DB query duration, EventBus, BullMQ, and cache metrics.

**Missing metrics for production:**

| Metric | Type | Why |
|--------|------|-----|
| `nodejs_active_connections` | Gauge | Detect connection leaks |
| `prisma_pool_active_connections` | Gauge | Detect pool exhaustion |
| `socketio_connected_clients` | Gauge | Track WebSocket load |
| `business_documents_created_total` | Counter (by type) | Business KPI monitoring |

---

## Environment Variable Hardening

**Confidence:** HIGH (verified in codebase)

### Production-Required Variables (Add to Zod Schema)

The current env schema marks too many things as optional. In production, these should be required:

```typescript
// env.ts — production overrides
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: process.env.NODE_ENV === 'production'
    ? z.string().url()      // REQUIRED in production
    : z.string().optional(), // Optional in dev
  JWT_SECRET: z.string().min(64, 'Production JWT_SECRET should be 64+ chars'),
  JWT_REFRESH_SECRET: z.string().min(64),
  // ... etc
});
```

### Variables to Add

| Variable | Type | Default | Purpose |
|----------|------|---------|---------|
| `SHUTDOWN_TIMEOUT_MS` | number | 15000 | Graceful shutdown drain timeout |
| `BODY_SIZE_LIMIT` | string | '256kb' | JSON body parser limit |
| `LOG_LEVEL` | string | 'info' | Runtime log level control |
| `PRISMA_DEBUG` | boolean | false | Enable Prisma query logging |
| `METRICS_ENABLED` | boolean | true | Toggle Prometheus metrics |
| `QUEUE_DASHBOARD` | boolean | false | Already exists, good |

---

## Docker/Deployment Hardening

### Dockerfile Improvements

**Confidence:** HIGH (verified in codebase)
**Current state:** Good multi-stage build, non-root user, health check.

**Improvements:**

1. **Pin Node.js version** instead of `node:20-alpine`:
```dockerfile
FROM node:20.18-alpine AS deps
```
Prevents surprise breakages from minor Node.js updates.

2. **Add `.dockerignore`** to reduce build context size (verify it exists):
```
node_modules
.git
*.md
.env*
.planning
```

3. **Add `dumb-init`** for proper signal forwarding to Node.js:
```dockerfile
RUN apk add --no-cache dumb-init
CMD ["dumb-init", "sh", "start.sh"]
```
**Rationale:** Node.js does not handle SIGTERM correctly when running as PID 1 in a container. `dumb-init` ensures signals are properly forwarded.

4. **Set Node.js memory limit** to match container allocation:
```dockerfile
ENV NODE_OPTIONS="--max-old-space-size=512"
```

---

## Alternatives Considered

| Category | Current | Considered | Why Not |
|----------|---------|-----------|---------|
| ORM | Prisma 6 | Drizzle ORM | Existing schema across 17 files; migration cost is enormous; Prisma 6 performance is adequate |
| Job Queue | BullMQ 5 | pg-boss | BullMQ is already integrated across 11 queues; Redis is already deployed |
| Bundler | Vite 6 (Rollup) | Vite 8 (Rolldown) | Vite 8 just released; wait for ecosystem stabilization before upgrading |
| Logger | Pino 10 | Winston | Pino is 5x faster than Winston in benchmarks; already in use |
| Redis Client | ioredis 5 | node-redis | ioredis has better TypeScript support and cluster handling; already in use |
| Container Runtime | Node.js 20 | Node.js 22 | Node 20 is LTS until April 2026; upgrade to 22 LTS after production launch stabilizes |

---

## Installation (New Production Dependencies)

```bash
# Backend production dependencies (none needed -- stack is complete)

# Backend dev dependencies for analysis
pnpm --filter @nit-scs-v2/backend add -D clinic autocannon

# Frontend dev dependencies for bundle analysis
pnpm --filter @nit-scs-v2/frontend add -D rollup-plugin-visualizer

# Container improvement
# Add to Dockerfile: apk add --no-cache dumb-init
```

---

## Summary: Priority Order of Changes

| Priority | Change | Risk if Skipped | Effort |
|----------|--------|----------------|--------|
| P0 | Fix Redis `maxmemory-policy` to `noeviction` | BullMQ job loss, corrupt queues | 5 min |
| P0 | Add `shutdownQueues()` to graceful shutdown | Worker data loss on deploy | 10 min |
| P0 | Enforce production env validation (REDIS_URL required, connection pool params) | Silent failures, pool exhaustion | 30 min |
| P1 | Add missing database indexes (FK columns, status, createdAt) | Slow queries as data grows | 2 hrs |
| P1 | Split vendor chunks in Vite config | Unnecessary bandwidth on deploys | 30 min |
| P1 | Add Pino `redact` paths for PII | Sensitive data in log aggregation | 15 min |
| P1 | Install `dumb-init` in Dockerfile | Ungraceful container shutdown | 10 min |
| P1 | Change source maps to `hidden` | Source code exposed to users | 5 min |
| P2 | Explicit Prisma `$connect()` at startup | Slow first request | 10 min |
| P2 | Enable `relationJoins` preview feature | N+1 queries on includes | 15 min |
| P2 | PostgreSQL tuning (shared_buffers, work_mem) | Suboptimal query performance | 30 min |
| P2 | Reduce Sentry trace sample rate | Expensive Sentry bills | 5 min |
| P3 | Add bundle visualizer for ongoing monitoring | No visibility into bundle growth | 15 min |
| P3 | Add AsyncLocalStorage for request-scoped logging | Harder to trace requests across services | 1 hr |
| P3 | Plan Socket.IO Redis adapter for multi-instance | Cannot scale horizontally | 2 hrs (when needed) |

---

## Sources

### Official Documentation (HIGH confidence)
- [Express.js Production Performance Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
- [Express.js Production Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Prisma Connection Pool Documentation](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-pool)
- [Prisma Query Optimization](https://www.prisma.io/docs/orm/prisma-client/queries/query-optimization-performance)
- [Prisma Best Practices](https://www.prisma.io/docs/orm/more/best-practices)
- [BullMQ Going to Production](https://docs.bullmq.io/guide/going-to-production)
- [Socket.IO Redis Adapter](https://socket.io/docs/v4/redis-adapter/)
- [Redis Security Best Practices](https://redis.io/docs/latest/operate/oss_and_stack/management/security/)
- [Helmet.js Documentation](https://helmetjs.github.io/)

### Verified Web Sources (MEDIUM confidence)
- [Express 5 Production Setup Guide](https://janhesters.com/blog/how-to-set-up-express-5-for-production-in-2025)
- [PostgreSQL Performance Tuning Best Practices 2025](https://www.mydbops.com/blog/postgresql-parameter-tuning-best-practices)
- [Scaling Socket.IO: Redis Adapters and Namespace Partitioning](https://medium.com/@connect.hashblock/scaling-socket-io-redis-adapters-and-namespace-partitioning-for-100k-connections-afd01c6938e7)
- [Pino Logger Complete Node.js Guide](https://signoz.io/guides/pino-logger/)
- [Vite 6 Build Optimization Guide](https://markaicode.com/vite-6-build-optimization-guide/)
- [Production-Grade Logging with Pino](https://www.dash0.com/guides/logging-in-node-js-with-pino)
- [How to Secure Redis in Production](https://oneuptime.com/blog/post/2026-01-21-redis-secure-production/view)
- [Node.js Graceful Shutdown with Terminus](https://github.com/godaddy/terminus)

### Codebase Verification (HIGH confidence)
- `packages/backend/src/config/redis.ts` -- Redis client with hardening already in place
- `packages/backend/src/config/logger.ts` -- Pino structured logging configured
- `packages/backend/src/config/env.ts` -- Zod environment validation
- `packages/backend/src/index.ts` -- Express setup, middleware chain, graceful shutdown
- `packages/backend/src/infrastructure/queue/bullmq.config.ts` -- BullMQ queue/worker factory
- `packages/backend/src/utils/prisma.ts` -- Prisma singleton with soft-delete extension
- `packages/backend/Dockerfile` -- Multi-stage build with non-root user
- `packages/frontend/vite.config.ts` -- Build configuration with PWA
- `docker-compose.yml` -- PostgreSQL 15 + Redis 7 development setup
