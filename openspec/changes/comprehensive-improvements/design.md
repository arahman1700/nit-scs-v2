## Context

NIT Supply Chain V2 is a monorepo (React 19 + Express 5 + Prisma 6) with dark glassmorphism theme. The system currently stores JWT access tokens in localStorage and uses Authorization headers for API calls. React Query hooks use full param objects as queryKeys, leading to unnecessary cache misses. Large page components (700-1000+ lines) are not code-split. Forms lack real-time inline feedback and tables lack skeleton loading states.

## Goals / Non-Goals

**Goals:**
- Eliminate localStorage token exposure by moving to httpOnly cookie-based auth
- Add CSRF protection for all state-changing API endpoints
- Reduce unnecessary React Query re-fetches through normalized queryKeys and selective invalidation
- Improve perceived performance with skeleton loaders and optimistic updates
- Provide real-time form validation feedback without waiting for submission

**Non-Goals:**
- Full rewrite of the authentication system (keep existing JWT + refresh token flow)
- Migrating to a different state management solution
- Adding new business features or workflows
- Mobile app or PWA offline-first improvements
- Database schema changes

## Decisions

### 1. httpOnly Cookie for Access Token (over localStorage)

**Decision**: Store access token in httpOnly, Secure, SameSite=Strict cookie instead of localStorage.

**Rationale**: localStorage is accessible to any JS on the page — a single XSS vulnerability exposes the token. httpOnly cookies are invisible to JavaScript.

**Alternatives considered**:
- *In-memory only (JS variable)*: Lost on page refresh, poor UX. Rejected.
- *SessionStorage*: Still vulnerable to XSS, same problem as localStorage. Rejected.

**Impact**: Backend sets cookie via `Set-Cookie` header on login/refresh. Frontend Axios uses `withCredentials: true`. Backend middleware reads token from cookie instead of Authorization header.

### 2. Double-Submit Cookie for CSRF (over Synchronizer Token)

**Decision**: Use double-submit cookie pattern — server sets a CSRF token cookie (not httpOnly), frontend reads it and sends as `X-CSRF-Token` header on mutating requests.

**Rationale**: Stateless, no server-side token storage needed. Fits the existing Express + React architecture without session store dependency.

**Alternatives considered**:
- *Synchronizer token pattern*: Requires server-side session storage for each user. Adds complexity. Rejected.
- *SameSite=Strict only*: Insufficient alone — doesn't prevent same-site attacks. Used as defense-in-depth alongside CSRF token.

### 3. QueryKey Factory Pattern (over ad-hoc keys)

**Decision**: Introduce a `queryKeyFactory` per resource that produces consistent, normalized keys: `resource.list(filters)`, `resource.detail(id)`, `resource.all`.

**Rationale**: Current pattern uses `['grn', 'list', params]` with full param objects — object reference changes cause cache misses. Factory pattern normalizes to sorted, primitive keys.

**Impact**: All hooks in `src/api/hooks/` updated. Invalidation becomes surgical: `qc.invalidateQueries({ queryKey: grnKeys.lists() })` instead of `qc.invalidateQueries({ queryKey: ['grn'] })`.

### 4. Reusable Skeleton Components (over per-component loading)

**Decision**: Create a set of skeleton primitives (`SkeletonCard`, `SkeletonTable`, `SkeletonForm`) composable into page-level loading states.

**Rationale**: Current loading uses simple `animate-pulse` divs duplicated across components. Centralized skeletons ensure visual consistency and reduce duplication.

## Risks / Trade-offs

- **[Breaking API change]** → Migration plan below: deploy backend cookie support first with dual-mode (accept both header and cookie), then migrate frontend, then remove header support
- **[CSRF adds request overhead]** → Minimal: one cookie read + one header per request, no server storage
- **[QueryKey refactor touches many files]** → Low risk: each hook is independent, can migrate incrementally
- **[Skeleton components add bundle size]** → Negligible: skeleton components are small, static markup with CSS animations
- **[Dual-mode auth transition period]** → Time-boxed to one release cycle, then hard-cut to cookie-only

## Migration Plan

1. **Phase 1 — Backend dual-mode auth**: Add cookie-reading middleware alongside existing header-reading. Deploy backend first.
2. **Phase 2 — Frontend switch**: Update Axios interceptor to use `withCredentials: true`, add CSRF token header. Remove localStorage token storage.
3. **Phase 3 — Cleanup**: Remove Authorization header support from backend. Cookie-only.
4. **Rollback**: Each phase is independently reversible. Phase 2 rollback = revert frontend to localStorage + header.
