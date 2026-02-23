# System Hardening & Completion Design

**Date:** 2026-02-23
**Status:** Approved
**Goal:** Bring the NIT Supply Chain V2 system to 100% completion across security, error handling, type safety, test coverage, and architecture.

## Audit Baseline

| Metric | Current | Target |
|--------|---------|--------|
| Tests | 1,883 pass | ~3,500+ |
| Backend service test coverage | 55% (42/76) | 100% |
| Backend route test coverage | 7% (6/85) | 100% |
| Frontend component test coverage | 14% (6/42) | 100% |
| Frontend hook test coverage | 1.2% (1/81) | 100% |
| `as any` in production | 1 | 0 |
| npm vulnerabilities | 6 (4 high) | 0 |
| Silent error handling defects | 23 | 0 |
| Discriminated union usage | 0 | 3+ |

## Phase 1: Security Hardening

### 1.1 Token Blacklist Resilience
- **File:** `auth.service.ts`
- **Change:** Add `warn` logging in `isTokenBlacklisted()` catch block
- **Rationale:** Redis failure currently silently allows revoked tokens

### 1.2 Rate Limiter Fallback
- **File:** `rate-limiter.ts`
- **Change:** Replace `.catch(() => next())` with in-memory fallback
- **Rationale:** Redis failure currently bypasses all rate limiting

### 1.3 Global API Rate Limiting
- **File:** `index.ts`
- **Change:** Add `rateLimiter(100, 60_000)` on `/api/v1`
- **Rationale:** Only auth endpoints have rate limiting currently

### 1.4 Replace xlsx with exceljs
- **Files:** `import.service.ts`, `package.json`
- **Change:** Migrate from `xlsx` to `exceljs`
- **Rationale:** xlsx has 2 unpatched HIGH vulnerabilities (prototype pollution, ReDoS)

### 1.5 Helmet CSP Configuration
- **File:** `index.ts`
- **Change:** Explicit CSP directives, HSTS with preload
- **Rationale:** Default Helmet does not set strict CSP

### 1.6 ESLint Ban on Unsafe Raw Queries
- **File:** `eslint.config.js`
- **Change:** Ban `$queryRawUnsafe` and `$executeRawUnsafe`
- **Rationale:** Prevent future SQL injection via unsafe Prisma methods

### 1.7 Scheduler Unhandled Promises
- **File:** `scheduler.service.ts`
- **Change:** Wrap initial run calls in `Promise.allSettled()`
- **Rationale:** 4 async calls without await/catch can crash the process

### 1.8 Offline Queue Promise Safety
- **File:** `offlineQueue.ts`
- **Change:** Add `.catch()` to `syncAll()` calls
- **Rationale:** Unhandled rejections can crash the browser tab

## Phase 2: Error Handling (23 fixes)

### Critical (3)
- Token blacklist silent fallback (covered in Phase 1)
- Scheduler fire-and-forget (covered in Phase 1)
- Offline queue unhandled promises (covered in Phase 1)

### High (8)
- Push notification `.catch(() => {})` -> add logging
- Rate limiter bypass (covered in Phase 1)
- `console.error` in mi.service.ts -> structured logger
- Frontend push service `console.error` -> proper error propagation
- SLA config refresh silent fallback -> add logging
- Email template not found -> throw error or return result
- Lock acquisition silent proceed -> add logging
- optionalAuth swallowed errors -> add debug logging

### Medium (12)
- System config getSetting silent fallback -> add logging
- Redis disconnect catch -> log error
- useFormSubmit generic message -> extract server error details
- useOfflineQueue silent catch -> log to console.warn
- BarcodeScanner stop catch -> acceptable (cleanup)
- isPushSubscribed catch -> acceptable
- Chain notification fire-and-forget -> use retry queue
- Auth routes unnamed catch -> add error variable
- RuleEngine template literal logging -> structured object
- ScheduledRuleRunner same issue -> fix
- ChainNotificationHandler same issue -> fix
- upload.routes console.warn -> structured logger

## Phase 3: Type System Improvements

### 3.1 Per-Document Status Types
- Derive from `STATUS_FLOWS` constants
- `GrnStatus`, `MiStatus`, `MrStatus`, etc.
- Apply to respective document interfaces

### 3.2 VoucherLineItem Split
- `BaseLineItem` with common fields
- `GrnLineItem`, `MiLineItem`, `MrnLineItem` extensions
- Remove cross-domain optional fields

### 3.3 JobOrder Discriminated Union
- Split into `TransportJO`, `RentalJO`, `ScrapJO`, `GeneratorJO`, `EquipmentJO`
- Discriminant: `joType` field

### 3.4 Validator Input Typing
- Change `Record<string, unknown>` to `Partial<MRRV>`, etc.
- Zero runtime impact, compile-time safety

### 3.5 Backend ListParams Fix
- `sortDir: string` -> `sortDir: 'asc' | 'desc'`

### 3.6 Deprecated Field Cleanup
- Remove or isolate deprecated fields from main interfaces

## Phase 4: Test Coverage -> 100%

### Backend Services (34 files)
Priority order: scheduler, permissions, dynamic-docs, widget-data, then remainder.

### Backend Routes (79 files)
Factory-generated routes get template tests; custom routes get handwritten tests.

### Frontend Components (36 files)
Snapshot + interaction tests for UI components.

### Frontend Hooks (80 files)
Mock-based unit tests for React Query hooks.

## Phase 5: Architecture Cleanup

### 5.1 Scheduler Refactoring
- Split `scheduler.service.ts` (1,380 LOC) into:
  - `cron-matcher.ts`
  - `sla-checker.ts`
  - `email-retry.ts`
  - `lot-expiry.ts`
  - `scheduler-orchestrator.ts`

### 5.2 Dead Code Removal
- Remove `EngineerDashboard` (replaced by `SiteEngineerDashboard`)
- Clean ManagerDashboard "Documents" tab placeholder

### 5.3 Unused Dependencies
- Remove `pino-pretty` (devDep, backend)
- Remove `@hookform/resolvers` (dep, frontend)

### 5.4 Prisma Relations
- Add explicit `onDelete` to 80 relations currently using default Restrict

### 5.5 routes.tsx Split (optional)
- Split 37KB file by domain if time permits
