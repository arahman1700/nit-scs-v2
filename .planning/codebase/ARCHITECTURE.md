# Architecture

**Analysis Date:** 2026-03-22

## Pattern Overview

**Overall:** Domain-Driven Design (DDD) with layered architecture. Monorepo with 3 independently deployable packages (backend, frontend, shared) communicating via REST API + WebSocket.

**Key Characteristics:**
- 19 domain-organized backend services (auth, master-data, inbound, outbound, inventory, etc.)
- React 19 + Vite frontend with domain-organized hooks and pages
- Shared TypeScript types and validators across packages
- Document-centric patterns with status transitions and audit trails
- Real-time updates via Socket.IO + React Query cache invalidation
- RBAC with resource-based permissions stored in database
- Row-level scoping (warehouse/project) for multi-tenant operations

## Layers

**Backend (packages/backend/src):**
- Purpose: REST API + WebSocket server serving React frontend
- Location: `/Users/a.rahman/Projects/V2/packages/backend/src`
- Contains: 19 domains with routes/services, middleware, utilities, events, Socket.IO setup
- Depends on: Prisma (database), Redis (caching/tokens), Express, Socket.IO
- Used by: Frontend application

**Frontend (packages/frontend/src):**
- Purpose: React 19 SPA with real-time domain-organized UI
- Location: `/Users/a.rahman/Projects/V2/packages/frontend/src`
- Contains: Pages, components, domain hooks (React Query), contexts, utilities
- Depends on: React Query v5, Zustand, React Hook Form, Zod, Axios, Socket.IO client
- Used by: End users via browser

**Shared (packages/shared/src):**
- Purpose: Type definitions, validators, permissions matrix
- Location: `/Users/a.rahman/Projects/V2/packages/shared/src`
- Contains: TypeScript types, Zod validators, permissions, error classes, constants
- Depends on: Zod, TypeScript
- Used by: Both backend and frontend

## Data Flow

**Create Document (e.g., GRN):**

1. Frontend: User fills form → `useCreateGrn()` mutation hook
2. Frontend: `apiClient.post('/grn', {lines, headerData})` with JWT Bearer token
3. Backend: Axios request interceptor attaches token → `POST /api/v1/grn`
4. Backend: `authenticate` middleware validates JWT, checks Redis blacklist
5. Backend: `createDocumentRouter()` factory validates input with Zod schema
6. Backend: Route handler calls `grnService.create(headerData, lines, userId)`
7. Backend: Service uses Prisma to write to `mrrv` table (V1 name internally)
8. Backend: `auditAndEmit()` utility creates audit log and publishes `SystemEvent` to event bus
9. Backend: Route handler emits Socket.IO event `'grn:created'` to connected clients
10. Frontend: React Query `onSuccess` callback invalidates `['grn']` query
11. Frontend: All components using `useGrnList()` re-fetch automatically
12. Frontend: Socket.IO listener updates real-time UI for other users

**Status Transition (e.g., Submit GRN):**

1. Frontend: User clicks "Submit" → `useSubmitGrn()` mutation
2. Backend: `POST /api/v1/grn/:id/submit` with empty body
3. Backend: `requirePermission('grn', 'approve')` validates RBAC
4. Backend: `grnService.submit(id)` validates status is 'draft', transitions to 'pending_qc'
5. Backend: Creates workflow approval record if needed
6. Backend: Publishes `SystemEvent` type `'document:status_changed'`
7. Backend: Rule engine listener processes event → may trigger notifications
8. Backend: Socket.IO emits `'grn:submitted'` to role-based rooms (`role:manager`, `role:admin`)
9. Frontend: Components listening to socket event update UI immediately
10. Frontend: React Query still invalidates on response for consistency

**Real-Time Sync:**

1. Multiple users open same document
2. User A submits document → Backend emits socket event
3. Backend Socket.IO setup joins users into rooms: `role:{systemRole}` + `user:{userId}`
4. Event emitted to `role:warehouse_supervisor` room broadcasts to all supervisors
5. User B receives socket event via client Socket.IO listener
6. User B's React Query cache is invalidated → hooks refetch
7. User B's UI updates with latest status

## Key Abstractions

**Document Router Factory (`createDocumentRouter`):**
- Purpose: Eliminate CRUD route boilerplate across 19 domains
- Examples: `packages/backend/src/utils/document-factory.ts`
- Pattern: Takes config (service functions, schemas, RBAC roles, action definitions) → returns Express Router with list/get/create/update + status-transition actions
- Handles: Validation, RBAC, pagination, optimistic locking, audit logging, socket emission

**SystemEvent + EventBus:**
- Purpose: Domain events for workflow, rules, notifications
- Examples: `packages/backend/src/events/event-bus.ts`, `rule-engine.ts`
- Pattern: Service emits `SystemEvent` → EventBus publishes to in-memory EventEmitter → listeners (rule engine, notifications) react asynchronously
- Events: `'document:status_changed'`, `'document:created'`, `'approval:requested'`, etc.

**React Query Hooks (Domain-Organized):**
- Purpose: Encapsulate API calls + caching per domain
- Examples: `packages/frontend/src/domains/inbound/hooks/useGrn.ts`
- Pattern: Factory pattern using `createResourceHooks<GRN>('/grn', 'grn')` → exports `useGrnList`, `useGrn`, `useCreateGrn`, `useUpdateGrn`, action hooks
- Cache invalidation: Routes invalidate `['grn']` query → all `useGrnList()` instances refetch

**RBAC + Permissions Matrix:**
- Purpose: Role-based + resource-based access control
- Examples: `packages/backend/src/middleware/rbac.ts`, `packages/shared/src/permissions.ts`
- Pattern: Database permissions table stores {role, resource, action} → middleware checks before route handler runs
- Fallback: Document factory accepts `createRoles: ['admin', 'manager']` for legacy backward-compat

**Scope Filter (Multi-Tenant Row-Level Security):**
- Purpose: Ensure users only see documents in their warehouse/project
- Examples: `packages/backend/src/utils/scope-filter.ts`
- Pattern: Service layer wraps Prisma queries with `buildScopeFilter()` → adds WHERE clauses filtering by warehouseId/projectId
- Used: In list queries, get-by-ID, updates to prevent unauthorized access

**Route Registry (Conflict-Safe Mounting):**
- Purpose: Prevent Express static route shadowing by parameterized routes
- Examples: `packages/backend/src/utils/route-registry.ts`
- Pattern: Lazy domain registration → dry-run each domain on temp router → analyze for conflicts → mount in safe order (static before params)

## Entry Points

**Backend API:**
- Location: `packages/backend/src/index.ts`
- Triggers: `npm run dev:backend` starts Express server on port 4000
- Responsibilities:
  - Express app setup (middleware stack: helmet, CORS, body parser, auth, logging)
  - Route aggregation via RouteRegistry
  - Socket.IO server initialization
  - Redis connection
  - Event system startup (rule engine, notifications, scheduler)
  - Graceful shutdown handling (drain in-flight requests, close connections)
  - In production: serves frontend SPA from `frontend/dist`

**Frontend App:**
- Location: `packages/frontend/src/App.tsx`
- Triggers: Vite dev server on port 5173 or built SPA at root
- Responsibilities:
  - BrowserRouter setup (React Router)
  - DirectionProvider (RTL support)
  - AuthGuard component → checks auth state, routes to login or MainLayout
  - Suspense boundaries with fallback loaders

**Auth Guard:**
- Location: `packages/frontend/src/components/AuthGuard.tsx`
- Triggers: App component render
- Responsibilities:
  - Check localStorage for token
  - `useCurrentUser()` query to validate token
  - Establish Socket.IO connection on login
  - Route to LoginPage if unauthenticated
  - Route to MainLayout + role-based routes if authenticated
  - Handle logout (disconnect socket, clear localStorage, clear React Query cache)

**Domain Routes:**
- Location: `packages/backend/src/domains/{domain}/index.ts`
- Triggers: RouteRegistry in `packages/backend/src/routes/index.ts` calls `register{Domain}Routes(router)`
- Responsibilities: Barrel export that mounts all routes for a domain (e.g., `registerInboundRoutes` mounts `/grn`, `/qci`, `/dr`, `/asn` sub-routers)

## Error Handling

**Strategy:** Centralized error handler middleware. Services throw `AppError` subclasses. Global handler catches and formats JSON response.

**Patterns:**

**Backend Error Hierarchy:**
```typescript
// packages/shared/src/errors.ts
class AppError extends Error {
  constructor(statusCode, message, code) { ... }
}

class NotFoundError extends AppError { ... }    // 404
class ConflictError extends AppError { ... }    // 409
class ValidationError extends AppError { ... }  // 400
class PermissionError extends AppError { ... }  // 403
```

**Error Handler Middleware:**
- Location: `packages/backend/src/middleware/error-handler.ts`
- Catches all errors from route handlers
- For `AppError`: returns `{ success: false, message, code, errors? }`
- For Prisma.PrismaClientKnownRequestError: maps P2002 (duplicate) → 409, P2025 (not found) → 404
- For unknown errors: returns 500 with generic message in production, full error in dev
- Sends to Sentry if statusCode >= 500

**Frontend Error Handling:**
- Axios response interceptor catches 401 (expired token) → queues refresh, retries
- Axios response interceptor catches 409 (optimistic locking version conflict) → shows toast, invalidates all queries
- Error boundary component wraps route pages → shows fallback UI on render error
- useMutation `onError` callbacks toast user-friendly messages

## Cross-Cutting Concerns

**Logging:**
- Backend: Pino logger in `packages/backend/src/config/logger.ts`
- Structured JSON logs with levels: debug, info, warn, error
- RequestLogger middleware captures method, path, status, duration
- Sensitive headers stripped

**Validation:**
- Backend: Zod schemas in `packages/backend/src/schemas/document.schema.ts`
- Document factory validates all requests against schema
- Dynamic validation for custom fields returns 422 with field errors
- Frontend: React Hook Form + Zod for client-side validation

**Authentication:**
- JWT access tokens (short-lived, in localStorage)
- Refresh tokens (httpOnly cookies, long-lived)
- `authenticate` middleware verifies Bearer token signature
- Redis blacklist checks for token revocation
- Socket.IO middleware validates JWT on connection + re-validates every 5 minutes

**Authorization:**
- Resource-based RBAC: `requirePermission('resource', 'action')` middleware
- Fallback to role lists for backward-compat: `requireRole(['admin', 'manager'])`
- Socket.IO: document type → resource mapping (e.g., `mrrv` → `grn`) for permission checks
- Scope filtering: row-level access by warehouseId/projectId

**Caching:**
- Redis: Token blacklist, rate-limit counters, session data
- React Query: Automatic query caching with stale-time = 0 (always refetch on mount, cache for immediate re-renders)
- HTTP cache headers: `/assets/*` → 1 year immutable, other static → no-cache

**Rate Limiting:**
- Backend HTTP: 500 requests/minute per client IP (middleware)
- Socket.IO: 30 events/10 seconds per socket
- Shared Redis store for distributed rate-limit counters

**Monitoring:**
- Prometheus metrics: `packages/backend/src/infrastructure/metrics/prometheus.ts`
- Tracks requests by method/path/status, event bus publishes, errors
- `/api/v1/metrics` endpoint (public, no auth)
- Sentry integration: captures exceptions >= 500, sets user context on auth

**Audit Trail:**
- Prisma AuditLog model records {resource, resourceId, action, userId, timestamp, changes}
- `auditAndEmit()` utility in every route handler → persists audit log before sending response
- `/audit/logs` endpoint for querying history

---

*Architecture analysis: 2026-03-22*
