# NIT Supply Chain V2 -- Architecture Decision Records

> Log of significant architectural decisions for the NIT Supply Chain V2 system.
> Each ADR captures the context, decision, and consequences at the time it was made.

---

## Table of Contents

- [ADR-001: Modular Monolith over Microservices](#adr-001-modular-monolith-over-microservices)
- [ADR-002: Express 5 + Prisma 6 Stack Selection](#adr-002-express-5--prisma-6-stack-selection)
- [ADR-003: Domain-Driven Design with 19 Domains](#adr-003-domain-driven-design-with-19-domains)
- [ADR-004: JWT with Redis Blacklist for Authentication](#adr-004-jwt-with-redis-blacklist-for-authentication)
- [ADR-005: Socket.IO for Real-Time Updates](#adr-005-socketio-for-real-time-updates)
- [ADR-006: Custom Scheduler vs BullMQ](#adr-006-custom-scheduler-vs-bullmq)
- [ADR-007: Soft-Delete Pattern](#adr-007-soft-delete-pattern)
- [ADR-008: Route Factory Pattern](#adr-008-route-factory-pattern)
- [ADR-009: React Query + Zustand for Frontend State](#adr-009-react-query--zustand-for-frontend-state)
- [ADR-010: Dark Glassmorphism Design System](#adr-010-dark-glassmorphism-design-system)

---

## ADR-001: Modular Monolith over Microservices

**Status:** Accepted
**Date:** 2025-Q3

### Context

The NIT Supply Chain system manages 19 distinct business domains (inbound, outbound, inventory, logistics, workflow, etc.) with significant cross-domain data dependencies. For example:
- Creating a GRN (inbound) updates inventory levels and may trigger workflow approval steps
- A Material Issuance (outbound) references items (master-data), checks inventory, and creates gate passes (logistics)
- SLA monitoring spans multiple document types across several domains

The team considered microservices, modular monolith, and a traditional monolith.

### Decision

We chose a **modular monolith** architecture: a single deployable unit with strong internal boundaries organized by domain. Each domain has its own directory with routes, services, and schemas. Domains communicate through direct function calls and a shared Prisma client rather than network calls or message queues.

### Consequences

**Benefits:**
- Single deployment pipeline simplifies operations (one Docker image, one database, one process)
- Cross-domain transactions are straightforward -- no distributed transaction coordination needed
- Prisma's type-safe client covers all models, making cross-domain queries natural and efficient
- Lower infrastructure cost -- a single Render web service instead of 19+ services
- Developer onboarding is faster -- one repository, one build process, one debugging context
- Latency between domain interactions is zero (in-process function calls)

**Drawbacks:**
- A bug in one domain can crash the entire application
- Cannot scale domains independently (e.g., cannot add more instances for inventory without also scaling auth)
- All domains must use the same Node.js version and dependency versions
- Database schema is monolithic -- all 19 domains share one PostgreSQL database

**Mitigations:**
- Domain boundaries are enforced by directory structure and barrel exports (`index.ts`)
- Each domain only exports a `registerXxxRoutes(router)` function -- internal services are not exposed
- Graceful shutdown drains in-flight requests across all domains
- Sentry error tracking isolates errors by domain through structured logging

**Future consideration:** If a single domain requires independent scaling (e.g., real-time inventory under extreme load), it can be extracted into a separate service. The modular structure makes this extraction straightforward since domain boundaries are already defined.

---

## ADR-002: Express 5 + Prisma 6 Stack Selection

**Status:** Accepted
**Date:** 2025-Q3

### Context

We needed a backend framework and ORM for a Node.js TypeScript application that would handle complex supply chain workflows, document management, and real-time updates.

Candidates evaluated:
- **Express 5** vs Fastify vs NestJS vs Hono
- **Prisma 6** vs Drizzle vs TypeORM vs Knex

### Decision

We chose **Express 5** as the HTTP framework and **Prisma 6** as the ORM.

**Express 5** was selected because:
- Native async middleware support eliminates the need for `try/catch` wrappers -- unhandled promise rejections automatically flow to the error handler
- Express 5's `{*path}` wildcard syntax works for the SPA fallback route
- The vast Express middleware ecosystem (helmet, cors, compression, multer) is well-tested and maintained
- Team familiarity reduces onboarding time

**Prisma 6** was selected because:
- Type-safe database client generated from the schema -- all queries are validated at build time
- The `$extends` API enables the soft-delete middleware pattern (auto-filtering `deletedAt` on read queries)
- `prisma migrate` provides a robust migration workflow with history tracking and deployment safety
- Prisma Studio offers a visual database browser for debugging
- The DMMF (Data Model Meta Format) API enables runtime introspection of model fields, used by the soft-delete extension to dynamically detect which models have `deletedAt`

### Consequences

**Benefits:**
- Express 5 async support removed approximately 200 `asyncHandler` wrappers from the codebase
- Prisma's generated types ensure that schema changes surface as compile-time errors across all domains
- Migration files are plain SQL, making them auditable and manually editable when needed
- The `$extends` soft-delete middleware guarantees that deleted records are never accidentally returned

**Drawbacks:**
- Express lacks built-in request validation, dependency injection, or module structure -- these are handled by middleware (Zod, manual DI, directory conventions)
- Prisma's query engine adds ~20 MB to the container and has a cold-start penalty
- Prisma does not support raw SQL query composition -- complex analytical queries use `$queryRaw` with template literals
- Prisma's connection pooling is per-instance, not global -- each container gets its own pool

**Key versions:**
- Express: 5.1.0
- Prisma: 6.5.0
- Node.js: 20 LTS

---

## ADR-003: Domain-Driven Design with 19 Domains

**Status:** Accepted
**Date:** 2025-Q3

### Context

A supply chain management system has a large surface area. Initial prototyping used a flat file structure (`routes/grn.ts`, `routes/mi.ts`, etc.) which became unwieldy at ~50 route files. The codebase needed an organizing principle that mapped to business concepts.

### Decision

We organized the backend into **domain modules**, each representing a bounded context in the supply chain:

1. `auth` -- Authentication, permissions, security monitoring
2. `master-data` -- Items, suppliers, projects, warehouses, UOMs, regions, cities
3. `inbound` -- GRN (MRRV), QCI (RFIM), DR (OSD), ASN, inspection
4. `outbound` -- MI (MIRV), MRN (MRV), MR (MRF), pick optimization, wave planning
5. `inventory` -- Bin cards, cycle counts, surplus, scrap, expiry, ABC classification
6. `warehouse-ops` -- Zones, put-away, slotting, staging, cross-dock, yard management
7. `transfers` -- Warehouse transfers (WT), handover, IMSF
8. `logistics` -- Shipments, gate passes, transport orders, customs, tariffs
9. `job-orders` -- Job orders, labor standards
10. `equipment` -- Tools, generators, vehicles, assets, AMC, rentals
11. `workflow` -- Approvals, delegation, comments, digital signatures
12. `compliance` -- Supplier evaluation, compliance audits, visitors
13. `reporting` -- Dashboards, KPIs, reports, analytics, cost allocation
14. `system` -- Notifications, audit, settings, uploads, email, barcode, search
15. `uploads` -- File upload handling (shares infrastructure with system)

Each domain has a consistent internal structure:
```
domains/<name>/
  index.ts           # Barrel export: registerXxxRoutes(router)
  routes/            # Express route handlers
  services/          # Business logic
  schemas/           # Zod validation schemas
  jobs/              # Scheduled background jobs (optional)
```

### Consequences

**Benefits:**
- New developers can work within a single domain without understanding the entire system
- Route registration order is explicit in `routes/index.ts` -- critical for avoiding route shadowing (e.g., inventory's `/inventory/expiring` must register before master-data's `/inventory/:id`)
- Domain-specific scheduled jobs live next to the domain code they operate on
- Code ownership and review scope are naturally bounded by domain

**Drawbacks:**
- Cross-domain dependencies exist and are not formally tracked (e.g., inbound services import from inventory services)
- Some domains are much larger than others (system, reporting) while others are small (uploads)
- The V1-to-V2 naming translation (MRRV -> GRN, MIRV -> MI, etc.) adds cognitive overhead -- internal Prisma model names use V1 names while API/UI uses V2 names

---

## ADR-004: JWT with Redis Blacklist for Authentication

**Status:** Accepted
**Date:** 2025-Q3

### Context

The system needs stateless authentication for API requests while supporting token revocation (logout, forced session termination, security incidents). Pure JWT is stateless but cannot be revoked. Pure session tokens require a database lookup on every request.

### Decision

We use a **hybrid approach**: JWT for authentication with a Redis-backed token blacklist for revocation.

**Flow:**
1. Login: Server issues an access token (JWT, 15-minute expiry) and a refresh token (JWT, 7-day expiry). The refresh token is also stored in the database.
2. API requests: The `authenticate` middleware verifies the JWT signature and checks if the token's `jti` (JWT ID) is in the Redis blacklist.
3. Logout: The access token's `jti` is added to the Redis blacklist with a TTL matching the token's remaining lifetime. The refresh token is deleted from the database.
4. Refresh: The client sends the refresh token to obtain a new access token. The server verifies the refresh token exists in the database and has not expired.

### Consequences

**Benefits:**
- Most requests are fully stateless -- JWT verification is a local operation (no database call)
- Token revocation is near-instant via Redis (sub-millisecond lookup)
- Short access token lifetime (15 min) limits the window of vulnerability if Redis is unavailable
- The refresh token in the database provides a second layer of revocation control
- Sentry user context is set from the JWT payload for error tracking

**Drawbacks:**
- Redis dependency for blacklist (mitigated by in-memory fallback)
- Token rotation on `JWT_SECRET` change invalidates all tokens -- users must log in again
- The `jti` field adds 36 bytes per token (UUID)

**Fallback behavior when Redis is unavailable:**
- The `isTokenBlacklisted` function maintains a secondary in-memory `Set` of blacklisted JTIs
- When Redis is down, revocations are stored in-memory only (not shared across instances)
- The `authenticate` middleware logs a warning and continues with the in-memory check
- Risk window: a token revoked on instance A will not be blocked on instance B until Redis recovers

**Security measures:**
- JWT secrets must be at least 32 characters (enforced by Zod env validation)
- Authorization headers are stripped from Sentry error reports
- Strict auth rate limiter: 5 attempts per IP per 15-minute window on login/forgot-password
- Security monitor job runs hourly to detect suspicious login patterns

---

## ADR-005: Socket.IO for Real-Time Updates

**Status:** Accepted
**Date:** 2025-Q3

### Context

Supply chain operations require real-time visibility: when a GRN is approved, the warehouse staff's dashboard should update without a page refresh. When an SLA breach occurs, the relevant team should see an immediate notification.

Candidates: Socket.IO, Server-Sent Events (SSE), WebSocket (raw), polling.

### Decision

We use **Socket.IO** for all real-time communication.

**Architecture:**
- The Socket.IO server is attached to the same HTTP server as Express
- Authentication uses the same JWT mechanism -- tokens are verified on socket connection
- The server emits events to specific users (`emitToUser`), roles (`emitToRole`), or rooms
- The frontend Socket.IO client subscribes to events and invalidates React Query caches

**Event patterns:**
- `entity:created`, `entity:updated`, `entity:deleted` -- generic CRUD notifications
- `sla:breached`, `sla:warning` -- SLA status changes
- `notification:new` -- in-app notification delivery
- `inventory:reconciliation` -- inventory discrepancy alerts

### Consequences

**Benefits:**
- Socket.IO handles WebSocket with automatic long-polling fallback behind proxies
- Built-in room management maps naturally to roles and user-specific channels
- Reconnection with exponential backoff is handled by the Socket.IO client library
- The same CORS configuration is shared between Express and Socket.IO

**Drawbacks:**
- Socket.IO adds state to the server (connected clients map), making horizontal scaling more complex
- No message persistence -- if a client is disconnected when an event fires, it misses the event (mitigated by React Query background refetch on reconnect)
- WebSocket connections on Render free tier may be terminated during service sleep

**Future consideration:** For multi-instance deployments, Socket.IO requires a Redis adapter (`@socket.io/redis-adapter`) to broadcast events across instances. This is not currently configured because the application runs as a single instance.

---

## ADR-006: Custom Scheduler vs BullMQ

**Status:** Accepted (with planned migration path)
**Date:** 2025-Q4

### Context

The system runs 28+ background jobs (SLA monitoring, email retry, inventory expiry, reconciliation, anomaly detection, etc.). These jobs need:
- Periodic execution at defined intervals (60 seconds to 7 days)
- Distributed locking to prevent duplicate execution across instances
- Failure isolation (one job failure should not affect others)
- No external dependency beyond Redis

Candidates: BullMQ, node-cron, Agenda, custom scheduler.

### Decision

We built a **custom scheduler** using `setTimeout` loops with Redis-based distributed locks.

**Design:**
- Jobs are registered via `registerJob()` in a central registry (`job-registry.ts`)
- Domain modules register their jobs at import time (side-effect registration)
- The scheduler orchestrator (`scheduler.service.ts`) starts a sequential loop for each job
- Each tick: acquire Redis lock (SET NX EX) -> run handler -> wait interval -> repeat
- Lock TTL is always less than the interval to prevent missed executions
- Errors are caught per-job and logged; they do not propagate to other jobs

**Why not BullMQ:**
- BullMQ requires a persistent Redis connection (not just occasional commands) -- the Upstash free tier's 10k daily command limit is marginal for BullMQ's polling model
- BullMQ adds significant complexity (workers, queues, events, dashboard) for what are essentially periodic functions
- The current workload (28 jobs, single instance) does not require BullMQ's features (retries with backoff, priority queues, rate limiting, job dependencies)

### Consequences

**Benefits:**
- Zero external dependencies beyond Redis (which is already used for rate limiting)
- Trivial to understand -- each job is a function that runs periodically
- Lock acquisition is a single Redis command (SET NX EX), consuming minimal Upstash quota
- Job registration is declarative and self-documenting

**Drawbacks:**
- No retry logic with backoff -- failed jobs simply wait for the next interval
- No job queue or persistence -- if the server restarts, jobs resume from scratch
- No admin dashboard for monitoring job execution history
- Sequential loops are less precise than cron expressions for time-of-day scheduling
- No dead letter queue for permanently failing jobs

**Migration plan to BullMQ:**

When the application scales beyond a single instance or requires advanced job features, migrate to BullMQ:

1. Replace `registerJob()` with BullMQ `Queue` and `Worker` definitions
2. Keep the same handler function signatures (they receive a `JobContext` object)
3. Use BullMQ's built-in repeatable jobs instead of custom `setTimeout` loops
4. Use BullMQ's lock mechanism instead of custom Redis SET NX EX
5. Add Bull Board for admin monitoring
6. Requires a dedicated Redis instance (not Upstash free tier) for BullMQ's blocking commands

The `JobContext` interface was designed with this migration in mind -- it abstracts the scheduler's internal utilities so that job handlers do not depend on the scheduler implementation.

---

## ADR-007: Soft-Delete Pattern

**Status:** Accepted
**Date:** 2025-Q3

### Context

Supply chain documents (GRNs, MIs, job orders, etc.) must never be permanently deleted for audit and compliance reasons. However, users need the ability to "delete" records from their active workflows.

### Decision

We implement **soft delete** using a `deletedAt` timestamp column on models that support deletion.

**Implementation layers:**

1. **Prisma schema:** Models that support soft delete have a `deletedAt DateTime?` column
2. **Prisma `$extends` middleware:** The `prisma.ts` utility wraps the PrismaClient with a `$extends` extension that automatically adds `WHERE deletedAt IS NULL` to `findMany`, `findFirst`, and `count` queries for models that have a `deletedAt` field
3. **Model detection:** The extension inspects Prisma's DMMF at runtime to build a `Set<string>` of models with `deletedAt` -- no hardcoded list
4. **Delete operation:** The `crud-factory.ts` converts `delete` calls to `update` with `{ deletedAt: new Date() }` for soft-delete models
5. **Escape hatch:** To query deleted records, pass `where: { deletedAt: { not: null } }` explicitly -- the middleware skips the filter when `deletedAt` is already in the `where` clause

### Consequences

**Benefits:**
- Soft-deleted records remain in the database for audit queries and compliance
- Application code does not need to remember to filter `deletedAt` -- it is automatic
- The DMMF-based detection means adding `deletedAt` to a new model requires zero code changes
- Audit trail is preserved -- the deletion timestamp is recorded

**Drawbacks:**
- Soft-deleted records still count toward database storage (mitigated by periodic archival if needed)
- Foreign key references to soft-deleted records may cause inconsistencies if not handled carefully
- Unique constraints must account for soft-deleted records (e.g., a "deleted" item with code `ABC-123` should not block creating a new item with the same code)
- Performance: tables grow indefinitely -- indexes should cover `deletedAt` for efficient filtering

---

## ADR-008: Route Factory Pattern

**Status:** Accepted
**Date:** 2025-Q3

### Context

The system has ~100+ route endpoints across 19 domains. Many follow identical patterns: list with pagination/search/sort, get by ID, create with validation, update with validation, delete (soft). Document workflows add status transitions (submit, approve, reject, complete) with RBAC checks, audit logging, and socket events.

Writing these routes manually for every entity results in massive code duplication.

### Decision

We built two route factories:

**1. `crud-factory.ts` -- for master data entities (items, suppliers, warehouses, etc.)**

```typescript
export function createCrudRoutes(config: CrudConfig): Router
```

Given a configuration object, generates a full Express Router with:
- `GET /` -- list with pagination, search, sort, and allowed filters
- `GET /:id` -- get by ID with includes
- `POST /` -- create with Zod validation
- `PUT /:id` -- update with Zod validation
- `DELETE /:id` -- soft-delete (sets `deletedAt`)
- Built-in RBAC (either role-list or permission-matrix based)
- Automatic audit logging and socket event emission
- Scope-based data access (users see only their warehouse's data)

**2. `document-factory.ts` -- for transactional documents (GRN, MI, MRN, etc.)**

```typescript
export function createDocumentRoutes(config: DocumentRouteConfig): Router
```

Extends CRUD with:
- Status transition actions (`POST /:id/submit`, `POST /:id/approve`, etc.)
- Per-action RBAC and validation
- Audit trail with action names
- Socket events with configurable event names and data builders

### Consequences

**Benefits:**
- Adding a new master data entity requires ~30 lines of configuration instead of ~200 lines of route handlers
- All entities get consistent pagination, search, sort, audit, and RBAC behavior
- Security fixes (e.g., input sanitization, scope filtering) apply to all routes at once
- The permission-matrix RBAC (`requirePermission(resource, action)`) integrates seamlessly -- the factory checks the `resource` config and uses permission-based or role-based RBAC accordingly

**Drawbacks:**
- Factories abstract away route logic, making it harder for new developers to understand what happens on a specific endpoint
- Complex entities sometimes need escape hatches (custom route handlers alongside factory-generated ones)
- The `ActionConfig` type for document transitions has a moderately complex interface

**Usage pattern:**
```typescript
// In domains/master-data/routes/item.routes.ts
export const itemRoutes = createCrudRoutes({
  modelName: 'item',
  tableName: 'items',
  resource: 'items',
  createSchema: createItemSchema,
  updateSchema: updateItemSchema,
  searchFields: ['itemCode', 'itemDescription'],
  includes: { category: true, uom: true },
  allowedFilters: ['categoryId', 'status'],
});
```

---

## ADR-009: React Query + Zustand for Frontend State

**Status:** Accepted
**Date:** 2025-Q3

### Context

The frontend needs to manage two categories of state:
1. **Server state:** Data fetched from the API (documents, inventory levels, user profiles) -- needs caching, background refetch, optimistic updates, and pagination
2. **Client state:** UI state (sidebar open/closed, active filters, form drafts) -- needs simple get/set without network concerns

### Decision

We use **React Query v5 (TanStack Query)** for server state and **Zustand** for client state.

**React Query patterns:**
- `createResourceHooks<T>(basePath, queryKey)` generates `useList`, `useOne`, `useCreate`, `useUpdate`, `useRemove` hooks per entity
- Hooks are organized by domain: `src/domains/{domain}/hooks/`
- Socket.IO events trigger `queryClient.invalidateQueries()` for real-time cache updates
- Background refetch on window focus ensures data freshness

**Zustand patterns:**
- Small, focused stores (not one global store)
- Used for: sidebar state, notification count, offline queue, active filters

### Consequences

**Benefits:**
- React Query eliminates manual loading/error state management -- every data fetch gets `isLoading`, `isError`, `data` automatically
- The `createResourceHooks` factory generates typed hooks from a single function call, reducing boilerplate
- Cache invalidation via Socket.IO means users see updates within seconds without polling
- Zustand stores are simple functions with no boilerplate (no reducers, no actions, no dispatch)
- React Query's `staleTime` and `cacheTime` reduce redundant API calls

**Drawbacks:**
- Two state management libraries increases the conceptual surface area
- Developers must decide whether state belongs in React Query (server) or Zustand (client)
- The `createResourceHooks` factory hides the React Query configuration, making customization less obvious
- Optimistic updates require careful rollback logic

**Cache invalidation strategy:**
- Socket.IO `entity:created/updated/deleted` events invalidate the relevant query key
- On Socket.IO reconnect, all active queries are refetched
- Mutations invalidate their own query key on success
- Background refetch on window focus (5-minute stale time)

---

## ADR-010: Dark Glassmorphism Design System

**Status:** Accepted
**Date:** 2025-Q3

### Context

The NIT Supply Chain system is used in warehouse and logistics environments -- often on large monitors in control rooms, by users who work extended shifts. The design system needed to:
- Reduce eye strain during long usage sessions
- Provide clear visual hierarchy for dense data displays (KPI dashboards, tables, forms)
- Align with the Nesma brand identity
- Support both desktop and tablet form factors

### Decision

We adopted a **dark glassmorphism design system** called the "Nesma Dark Theme" built on Tailwind CSS.

**Core visual primitives:**
- `.glass-card` -- `bg-white/5 backdrop-blur-[12px] border border-white/10` with rounded-2xl corners
- `.glass-panel` -- `bg-[rgba(5,16,32,0.95)] backdrop-blur-[24px]` for sidebars and overlays
- Dark background (`#0a1628`) with semi-transparent surfaces creating depth through layering

**Color system:**
- `nesma-primary` (`#2E3192`) -- brand blue for primary actions
- `nesma-secondary` (`#80D1E9`) -- cyan accent for links, icons, interactive elements
- `nesma-accent` (`#34d399`) -- green for success states
- `nesma-gold` (`#f59e0b`) -- amber for warnings and highlights
- Status colors: emerald (success), amber (warning), red (danger), blue (info), purple (special)

**Typography:** Inter font family with a defined scale from `text-[10px]` tiny labels to `text-3xl` KPI values.

### Consequences

**Benefits:**
- Dark backgrounds reduce eye strain in dimly lit warehouse environments
- Glassmorphism creates clear visual depth without relying on drop shadows (which are hard to distinguish on dark backgrounds)
- The opacity scale (`bg-white/5`, `bg-white/10`, etc.) enables consistent layering -- each nesting level adds transparency
- Tailwind token classes (`bg-nesma-primary`, `text-nesma-secondary`) enforce consistency and make theme changes centralized
- WCAG AA contrast ratios are pre-validated for the dark theme palette

**Drawbacks:**
- `backdrop-blur` has a performance cost on low-end devices and older browsers
- The dark theme is the only theme -- there is no light mode option
- Custom Tailwind tokens (`nesma-*`) require consulting the design system documentation; standard Tailwind color names are not used
- Glassmorphism effects depend on layered content for visual impact -- empty states can look flat

**Design tokens are defined in:**
- `tailwind.config.ts` -- color tokens, extended theme
- `src/styles/globals.css` -- `.glass-card`, `.glass-panel`, `.btn-primary`, `.input-field` utility classes

---
