# Phase 4: Infrastructure and Deployment - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase makes the system deployable to production via CI/CD with proper configuration, graceful shutdown, and environment validation. Covers: Redis eviction policy (INFR-01), BullMQ shutdown (INFR-02), Prisma migration format (INFR-03), env validation (INFR-04), source maps (INFR-05), Dockerfile hardening (INFR-06), body parser limits (INFR-07), request timeouts (INFR-08), Prisma connection pool (INFR-09).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation choices are at Claude's discretion — pure infrastructure phase:
- Redis: change maxmemory-policy from allkeys-lru to noeviction in docker-compose and docs (INFR-01)
- BullMQ: wire shutdownQueues() into graceful shutdown handler in index.ts with 15s drain timeout (INFR-02)
- Prisma: re-baseline migration format to consistent timestamp naming (INFR-03)
- Env: enforce REDIS_URL required + connection_limit in DATABASE_URL via Zod refine (INFR-04)
- Vite: set sourcemap to 'hidden' for production builds (INFR-05)
- Docker: install dumb-init, pin Node.js version in Dockerfile (INFR-06)
- Express: tighten body parser to 256KB default (INFR-07)
- Express: add request timeouts to all routes, 30s default (INFR-08)
- Prisma: explicit $connect() at startup with connection pool configured (INFR-09)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/backend/src/index.ts` — Express setup, middleware chain, graceful shutdown handler
- `packages/backend/src/infrastructure/queue/bullmq.config.ts` — BullMQ configuration with shutdownQueues()
- `packages/backend/src/config/env.ts` — Zod environment validation (already has CORS validation from Phase 3)
- `packages/backend/src/utils/prisma.ts` — Prisma singleton with extensions
- `docker-compose.yml` — Redis configuration
- `Dockerfile` — Docker build configuration
- `packages/frontend/vite.config.ts` — Vite build configuration

### Established Patterns
- Environment validation via Zod in env.ts
- Graceful shutdown handler already exists in index.ts but doesn't drain BullMQ
- Prisma migrations in packages/backend/prisma/migrations/

### Integration Points
- Redis config in docker-compose.yml
- BullMQ workers started in index.ts
- Prisma connect called implicitly (needs explicit $connect())
- Express body parser configured in index.ts middleware chain

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
