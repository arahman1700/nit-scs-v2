# NIT Supply Chain V2 — System Documentation

## Overview

NIT Supply Chain V2 is an enterprise supply chain management system focused on warehouse, logistics, transport, and equipment operations. It is a monorepo with a React frontend, Express backend, and shared TypeScript types/validators. The system is designed for complex, multi-role workflows with strict document state transitions, real-time updates, and auditable inventory movement.

Key goals:

- End-to-end warehouse + logistics workflows with strong RBAC
- Consistent document lifecycles across modules
- Real-time UI updates via Socket.IO + React Query cache invalidation
- Strong auditability (inventory lots, reservations, workflow approvals)
- No Purchase Order (PO) module (handled externally via Oracle)
- English-only UI

## Monorepo Structure

```
packages/
  backend/         Express 5 + Prisma 6 + Socket.IO
  frontend/        React 19 + Vite 6 + Tailwind
  shared/          Types, validators, permissions, constants
```

Top-level config:

- `pnpm-workspace.yaml` — workspace definition
- `tsconfig.base.json` — shared TypeScript config
- `docker-compose.yml`, `render.yaml` — deployment scaffolding

## Tech Stack

Frontend:

- React 19 + Vite 6
- Tailwind CSS 3.4 (Nesma dark theme, glassmorphism)
- React Query v5 (server state)
- Zustand (client state)
- React Hook Form + Zod (forms)
- Socket.IO client (real-time)

Backend:

- Express 5
- Prisma 6 (PostgreSQL)
- Socket.IO server (real-time)
- Redis (token blacklist, scheduler locks)
- Zod (request validation)

Shared:

- TypeScript domain types
- Validators + status state machine
- Permission matrix for roles/resources

## Core Domain Modules

### Materials & Inventory

- **GRN (Goods Receipt)**: receive, QC, store, and stock lots
- **MI (Material Issue)**: request, approve, reserve, issue, track costs
- **MRN (Material Return)**: return stock, restock good lots, block damaged lots
- **MR (Material Requisition)**: request materials, stock check, conversion to MI/IMSF/JO
- **Inventory**: FIFO lots, reservations, optimistic locking on levels/lots

### Logistics & Transport

- **WT (Warehouse Transfer)**: transfer between warehouses, ship/receive/complete
- **Gate Pass**: outbound/inbound movements, auto-expiry
- **Shipment**: in transit/delivered flow with notifications

### Quality

- **QCI (RFIM)**: QC inspection for GRN workflows
- **DR (Damage Report)**: over/short/damage claims and resolution

### Equipment & Operations

- **Job Order (JO)**: transport, rental, generator, scrap operations
- **Generator Maintenance & Fuel**
- **Scrap / Surplus**
- **Tools**

## Document Lifecycle & State Management

Document states are enforced via a shared state machine:

- `packages/shared/src/utils/stateMachine.ts`
- `assertTransition()` protects invalid transitions

Many document flows publish system events:

- `document:status_changed` is the primary event for workflow notifications

## Event Bus & Notifications

Event system:

- `packages/backend/src/events/event-bus.ts`
- `SystemEvent` is the central typed payload

Notification rules:

- `packages/backend/src/events/chain-notification-handler.ts`
- Creates Notification records for downstream roles
- Examples: MI approved → warehouse staff; GRN stored → project manager

Additional events:

- `inventory:low_stock` → low stock alerts to warehouse supervisors
- `inventory:blocked_lots_created` → QC inspection notification for damaged returns

## Real-Time Updates

Backend uses Socket.IO to publish updates and trigger React Query cache invalidation. Key write flows publish Socket.IO events and invalidate cached queries so dashboards and list pages update instantly.

## Inventory Mechanics

- FIFO lots (`inventory_lots`) with per-lot quantities
- Reservations (`qty_reserved`) and consumption logging (`lot_consumptions`)
- Optimistic locking on `inventory_levels` and `inventory_lots`
- Low-stock alerts with Notification creation

## Approval & Workflow Engine

Approval engine:

- `packages/backend/src/services/approval.service.ts`
- SLA tracking, approval routing by amount and role

Workflow rules:

- `packages/backend/src/events/rule-engine.ts`
- Rules can trigger actions based on scheduled or event-driven conditions

## Scheduler Jobs

Defined in `packages/backend/src/services/scheduler.service.ts`:

- SLA breach + warning checks
- Email retry queue
- Expired inventory lot marking
- Low stock scanning
- Token cleanup
- ABC classification
- Cycle count auto-creation
- Gate pass expiry (auto-cancel)
- Scheduled workflow rules

## RBAC & Security

- Permission matrix in `packages/shared/src/permissions.ts`
- Row-level security filters at service layer
- JWT access/refresh tokens with Redis blacklist
- Audit logging for critical inventory operations

## Frontend Architecture

Key directories:

- `src/pages/` — routed views organized by domain
- `src/components/` — shared UI components
- `src/api/hooks/` — React Query hooks (factory pattern)
- `src/utils/` — helpers (autoNumber, pdfExport, etc.)

Patterns:

- `SectionLandingPage` for domain landing pages
- `LineItemsTable` for document line item editing
- `createResourceHooks()` for consistent CRUD hooks

## Backend Architecture

Key directories:

- `src/services/` — domain service layer (business logic)
- `src/routes/` — Express routes for documents/resources
- `src/events/` — event bus + workflow engine
- `src/utils/` — helpers

Core patterns:

- `createDocumentRouter()` for document routes
- `createCrudRouter()` for master data

## Environment & Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Configure env:
   - Copy `.env.example` to `.env`
   - Set database + Redis credentials

3. Prisma:

   ```bash
   pnpm --filter @nit-scs-v2/backend prisma:migrate
   pnpm --filter @nit-scs-v2/backend prisma:seed
   ```

4. Run dev servers:
   ```bash
   pnpm --filter @nit-scs-v2/backend dev
   pnpm --filter @nit-scs-v2/frontend dev
   ```

## Testing & Build

Run all tests:

```bash
pnpm --filter @nit-scs-v2/shared test
pnpm --filter @nit-scs-v2/backend test
pnpm --filter @nit-scs-v2/frontend test
```

Build:

```bash
pnpm --filter @nit-scs-v2/shared build
pnpm --filter @nit-scs-v2/backend build
pnpm --filter @nit-scs-v2/frontend build
```

## Notes & Constraints

- No Purchase Order module (POs handled externally in Oracle)
- English-only UI
- All dashboards are considered equally important

---

## Session 4 — System Audit & Fixes (Feb 2026)

### Critical Fixes Applied

1. **Auth Middleware Race Condition** — `auth.ts` converted to async/await for Redis blacklist check
2. **Employee passwordHash Exposure** — CRUD factory now supports `omitFields` config; employee route excludes passwordHash
3. **ASN uomId Data Corruption** — `asn.service.ts:254` now resolves item's default UOM via Prisma lookup
4. **QCI Route V1/V2 Mismatch** — `qci.routes.ts` switched from rfim.service to qci.service (EventBus, transactions, conditional completion)
5. **MRN Route V1/V2 Mismatch** — `mrn.routes.ts` switched from mrv.service to mrn.service (EventBus, blocked-lot logic)
6. **Surplus Transaction Safety** — `surplus.service.ts` action() wrapped in $transaction + EventBus added

### EventBus Integration (Gap Closure)

Added EventBus events to all services that were missing them:

- `osd.service.ts` — sendClaim, resolve now emit events + use assertTransition
- `scrap.service.ts` — All 6 status transitions emit events via helper
- `handover.service.ts` — startVerification, complete emit events
- `surplus.service.ts` — action() now emits events
- `tool-issue.service.ts` — create and returnTool emit events
- `generator-maintenance.service.ts` — create, startProgress, complete, markOverdue emit events
- `rental-contract.service.ts` — create, submit, approve, activate, extend, terminate emit events
- `shipment.service.ts` — updateStatus, deliver (already had), cancel now emit events + uses assertTransition

### State Machine Enforcement

- `shipment.service.ts` — Now uses `assertTransition` instead of manual status checks; transition map updated to allow `cleared → delivered` and `cancelled` from non-terminal states
- `osd.service.ts` — Already uses `assertTransition` from prior fix

### Schema Changes

- 12 Float→Decimal conversions (CycleCountLine, PackingSession, PackingLine, StagingAssignment, PutAwayRule, LaborStandard)
- 7 new database indexes (Mrrv, GatePass, OsdReport)

### Frontend Fixes

- `FormFieldRenderer.tsx` — WCAG label association (htmlFor + id on all input types)
- `HandoverForm.tsx` — Toast feedback on create/update/workflow actions + error handling
- `ToolForm.tsx` — Toast feedback on create/update + error handling
- `AdminResourceList.tsx` — aria-label on all icon action buttons (View, PDF, Edit, Delete)
- `Header.tsx` — Mobile search button now functional (toggles search dropdown)

### Shared Package Additions

- `validateTool` validator added with 4 rules (TOOL-V001 to TOOL-V004) + 1 warning
- `validateGeneratorMaintenance` already existed
- Shipment TRANSITION_MAP updated to include cancelled transitions

### Frontend Config Additions

- `formConfigs.ts` — Added Tool and Generator form configs with appropriate sections, fields, icons
- `VALIDATOR_MAP` — Added tool and generator_maintenance entries

### Cleanup

- Deleted deprecated `wt.service.ts` (replaced by stock-transfer.service.ts, no remaining imports)

### Test Results

- All 1,812 tests pass: 314 shared + 1,424 backend + 74 frontend
- 18 test assertions updated to match new assertTransition error messages and proper state flows

---

If you need a deeper module-by-module breakdown (fields, endpoints, or UI flows), extend this document or generate an appendix per module.
