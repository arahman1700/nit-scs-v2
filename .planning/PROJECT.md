# NIT Supply Chain V2 — Production Readiness

## What This Is

Enterprise supply chain management system for NIT (Nesma Information Technology) — a full-stack monorepo handling inbound/outbound logistics, inventory management, warehouse operations, equipment tracking, compliance, and reporting. Currently in development with core functionality working but requiring comprehensive review, bug fixes, performance optimization, and feature completion before production launch.

## Core Value

The system must reliably track every material movement (in, out, transfer) with accurate inventory levels, proper approvals, and complete audit trails — if inventory data is wrong, nothing else matters.

## Requirements

### Validated

- ✓ 19-domain backend architecture (auth, master-data, inbound, outbound, inventory, warehouse-ops, transfers, logistics, job-orders, equipment, workflow, compliance, reporting, notifications, scheduler, audit, uploads, ai-services, system) — existing
- ✓ React 19 + Vite 6 frontend with domain-organized hooks and pages — existing
- ✓ Shared TypeScript types and Zod validators across packages — existing
- ✓ JWT authentication with RBAC and resource-based permissions — existing
- ✓ Real-time updates via Socket.IO + React Query cache invalidation — existing
- ✓ Document lifecycle (GRN, MI, MRN, QCI, DR, MR, WT) with status transitions — existing
- ✓ Approval workflow engine with delegation and digital signatures — existing
- ✓ Dashboard builder and report builder components — existing
- ✓ RTL Arabic support with direction toggle — existing
- ✓ Dark glassmorphism theme (Nesma design system) — existing
- ✓ Barcode/QR scanning support — existing
- ✓ PWA with offline queue — existing
- ✓ Seed data for demo/testing — existing

### Active

- [ ] Fix all known bugs (ASN UOM bug, GRN totalValue=0, bin cards hang, rate limiter logout, route shadowing)
- [ ] Fix transaction safety gaps in stock operations (inventory consistency)
- [ ] Fix approval state machine — wrap in transactions
- [ ] Resolve security concerns (SQL injection hardening, auth race condition, CORS validation, Zod string limits)
- [ ] Optimize performance (missing DB indexes, N+1 queries, Float→Decimal migration, large component refactoring)
- [ ] Eliminate code duplication (WT/stock-transfer unification, totalValue calculation utility)
- [ ] Fix frontend errors and broken pages
- [ ] Fix backend API errors
- [ ] Improve test reliability (socket hang failures)
- [ ] Add missing database indexes for high-volume tables
- [ ] Implement soft delete middleware (centralized Prisma extension)
- [ ] Production deployment configuration (CORS, rate limits, environment validation)
- [ ] Complete any incomplete features/pages

### Out of Scope

- New feature development beyond what's already started — focus is on fixing and polishing existing code
- Mobile native app — web PWA is sufficient for v1
- Migration from current stack — React 19, Vite 6, Express 5, Prisma 6 are all current
- Real-time chat/messaging — not core to supply chain operations
- AI features expansion — existing AI chat module is sufficient

## Context

**Current State:** The system has ~2,067 lines of codebase documentation across 7 analysis documents. The codebase mapper identified 30 concerns across 5 severity levels: 3 critical (ASN UOM bug, transaction safety gaps, auth race condition), 12 high-priority, 8 medium, and 7 low-priority issues.

**Technical Environment:**
- Monorepo: pnpm workspace with packages/frontend, packages/backend, packages/shared
- Stack: React 19 + Vite 6 + Express 5 + Prisma 6 + TypeScript 5.8
- Database: PostgreSQL via Prisma ORM
- Cache/Sessions: Redis
- Real-time: Socket.IO
- Testing: Vitest + Playwright + MSW + Testing Library

**Known Critical Issues:**
1. ASN UOM assignment bug (assigns itemId instead of uomId)
2. Stock operations not consistently wrapped in transactions
3. Bin cards computed endpoint hangs (no pagination/timeout)
4. Rate limiter causes session loss on rapid navigation
5. 23 route shadowing warnings on startup

## Constraints

- **Tech Stack**: Must keep current stack (React 19, Vite 6, Express 5, Prisma 6) — all are modern and appropriate
- **Data Integrity**: All stock operations must be transactional — partial commits are unacceptable
- **Backward Compatibility**: V1 Prisma model names (MRRV, MIRV, etc.) are kept internally; V2 names at API/UI boundary
- **Arabic Support**: RTL layout must work correctly across all pages
- **Security**: Must pass basic security review before production (CORS, rate limiting, input validation)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fix-first approach (no new features) | System has working features that need stabilization before adding more | — Pending |
| Brownfield review methodology | Systematic domain-by-domain review ensures nothing is missed | — Pending |
| Transaction safety as top priority | Inventory inconsistency is the highest-risk production issue | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-22 after initialization*
