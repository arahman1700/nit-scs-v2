# Developer Onboarding Guide -- Day-One Productivity

Last updated: 2026-03-12

---

## 1. Quick Start (15 Minutes)

### 1.1 Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Node.js | >= 20.0.0 LTS | Runtime |
| pnpm | >= 9.0.0 | Package manager (monorepo workspaces) |
| PostgreSQL | 16+ | Primary database |
| Redis | 7+ | Queues, caching, rate limiting (optional in dev) |
| Git | Latest | Version control |

### 1.2 Clone and Install

```bash
git clone <repo-url>
cd V2
pnpm install
```

### 1.3 Environment Setup

Create a `.env` file in the project root:

```bash
# Required
DATABASE_URL=postgresql://nit_admin:nit_scs_dev_2026@localhost:5432/nit_scs
JWT_SECRET=nit-scs-dev-only-jwt-secret-2026-do-not-use-in-production!
JWT_REFRESH_SECRET=nit-scs-dev-only-jwt-refresh-2026-do-not-use-in-production!

# Optional (Redis -- app works without it in development)
REDIS_URL=redis://localhost:6379

# Optional (defaults shown)
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Optional (production services)
SENTRY_DSN=             # Error tracking
RESEND_API_KEY=          # Email sending
VAPID_PUBLIC_KEY=        # Web push notifications
VAPID_PRIVATE_KEY=
```

The environment schema with all variables and validation rules is in `packages/backend/src/config/env.ts`.

### 1.4 Database Setup

```bash
cd packages/backend

# Generate Prisma client from schema files
npx prisma generate

# Run migrations (creates tables)
npx prisma migrate dev

# Seed reference data, templates, and demo data
pnpm prisma:seed

# (Optional) Open Prisma Studio for visual data browsing
npx prisma studio
```

### 1.5 Start Development

```bash
# From project root -- starts both frontend and backend in parallel
pnpm dev

# Or start individually:
pnpm dev:backend    # Express on port 4000
pnpm dev:frontend   # Vite on port 5173
```

### 1.6 Verify

```bash
# Backend health check
curl http://localhost:4000/api/v1/health

# Run all tests
pnpm test

# Run backend tests only
pnpm --filter @nit-scs-v2/backend test

# Run frontend tests only
pnpm --filter @nit-scs-v2/frontend test
```

---

## 2. Repository Structure

```
V2/
|-- packages/
|   |-- backend/                 # Express 5 API server
|   |   |-- prisma/
|   |   |   |-- schema/          # 17 .prisma files (155 models)
|   |   |   |-- migrations/      # Prisma migrations
|   |   |   |-- seed.ts          # Reference data seed
|   |   |   |-- seed-templates.ts # Template seed
|   |   |   |-- seed-data.ts     # Demo data seed
|   |   |   +-- seed-semantic-layer.ts # Reporting layer seed
|   |   |-- src/
|   |   |   |-- config/          # logger.ts, redis.ts, env.ts, cors.ts, sentry.ts
|   |   |   |-- domains/         # 19 domain directories (core business logic)
|   |   |   |-- events/          # Rule engine, chain notifications, action handlers
|   |   |   |-- infrastructure/  # BullMQ queues, job definitions
|   |   |   |-- middleware/      # auth, rbac, rate-limiter, error-handler, sanitize
|   |   |   |-- routes/          # Route aggregation (index.ts)
|   |   |   |-- socket/          # Socket.IO setup
|   |   |   |-- test-utils/      # prisma-mock, test-app, helpers
|   |   |   |-- utils/           # scope-filter, route-registry, jwt, prisma-helpers
|   |   |   +-- index.ts         # Server entry point
|   |
|   |-- frontend/                # React 19 SPA
|   |   |-- src/
|   |   |   |-- api/             # API client (Axios), type definitions
|   |   |   |-- components/      # Shared UI (KpiCard, SmartGrid, WorkflowBuilder)
|   |   |   |-- config/          # navigation.ts, resourceColumns.tsx
|   |   |   |-- contexts/        # Auth, Direction providers
|   |   |   |-- domains/         # React Query hooks organized by domain
|   |   |   |-- hooks/           # Custom hooks (useAutoSave, useOfflineQueue)
|   |   |   |-- layouts/         # MainLayout.tsx
|   |   |   |-- lib/             # Utility libraries
|   |   |   |-- pages/           # Route pages (organized by feature)
|   |   |   |-- styles/          # globals.css (Tailwind + glass-card system)
|   |   |   +-- utils/           # autoNumber.ts, pdf export utilities
|   |   |-- e2e/                 # End-to-end test helpers
|   |   +-- public/              # Static assets
|   |
|   +-- shared/                  # Shared TypeScript types, permissions, validation
|
|-- docs/
|   +-- ops/                     # Operational documentation
|
|-- CLAUDE.md                    # Project conventions and design system rules
+-- package.json                 # Root scripts (pnpm workspace)
```

---

## 3. Domain-Driven Architecture

### 3.1 Backend Domains (19)

Each domain follows the same internal structure:

```
domains/{domain}/
|-- index.ts                     # Barrel: exports registerXxxRoutes(router)
|-- routes/
|   |-- foo.routes.ts            # Express route handlers
|   +-- foo.routes.test.ts       # Route integration tests
|-- services/
|   |-- foo.service.ts           # Business logic (Prisma queries)
|   +-- foo.service.test.ts      # Unit tests
+-- jobs/                        # (some domains) Scheduled background jobs
```

### 3.2 Domain Registry

All domains register through `packages/backend/src/routes/index.ts`:

| Domain | Route Files | Service Files | Primary API Prefix |
|---|---|---|---|
| auth | 6 | 6 | `/auth`, `/permissions`, `/security` |
| master-data | 2 | 2 | `/items`, `/suppliers`, `/warehouses`, `/employees` |
| inbound | 15 | 19 | `/grns`, `/qcis`, `/drs`, `/asns` |
| outbound | 12 | 18 | `/mis`, `/mrns`, `/mrs`, `/gate-passes` |
| inventory | 16 | 14 | `/inventory-levels`, `/cycle-counts`, `/surplus`, `/scrap` |
| warehouse-ops | 26 | 25 | `/warehouse-zones`, `/bin-locations`, `/wms-tasks`, `/lpns`, `/rfid`, `/waves` |
| transfers | 7 | 7 | `/stock-transfers`, `/handovers`, `/imsfs` |
| logistics | 18 | 15 | `/shipments`, `/customs`, `/transport-orders` |
| job-orders | 4 | 6 | `/job-orders` |
| equipment | 18 | 18 | `/assets`, `/amcs`, `/tools`, `/generators`, `/vehicles` |
| workflow | 16 | 10 | `/approval-steps`, `/workflow-rules`, `/comments` |
| compliance | 6 | 6 | `/compliance-audits`, `/supplier-evaluations`, `/visitors` |
| reporting | 28 | 18 | `/dashboards`, `/kpis`, `/reports`, `/roi-calculator` |
| system | 34 | 26 | `/settings`, `/search`, `/barcode`, `/email`, `/audit-trail` |
| notifications | 4 | 6 | `/notifications`, `/push-subscriptions` |
| audit | 2 | 2 | `/audit` |
| uploads | 4 | 2 | `/uploads` |
| ai-services | 2 | 6 | `/ai`, `/ai-suggestions` |
| scheduler | 0 | 2 | (no HTTP routes -- background jobs only) |

### 3.3 Route Registry (Anti-Shadowing)

The `RouteRegistry` class (`packages/backend/src/utils/route-registry.ts`) prevents Express route shadowing by:

1. Collecting all domain registrations lazily
2. Dry-running each registrar to discover routes
3. Sorting domains so static paths precede parameter paths at every depth
4. Logging conflicts and mount order at startup

You never need to worry about route registration order -- the registry handles it.

---

## 4. Prisma Multi-File Schema Workflow

### 4.1 Schema Files

The 17 schema files in `packages/backend/prisma/schema/` are numbered for clarity:

```
00-generators.prisma        # Prisma generator + datasource config
01-reference.prisma          # Regions, cities, ports, UOMs
02-master-data.prisma        # Items, suppliers, employees, warehouses
03-inbound.prisma            # MRRV (GRN), RFIM (QCI), OSD (DR), ASN
04-outbound.prisma           # MIRV (MI), MRV (MRN), gate passes
05-job-orders.prisma         # Job orders, labor standards
06-inventory.prisma          # Inventory levels, lots
07-logistics.prisma          # Shipments, customs, freight
08-system.prisma             # Notifications, audit, settings
09-workflow.prisma            # Approval steps, delegation
10-email-dashboard.prisma    # Email queue, dashboards, saved reports
11-v2-modules.prisma         # Cycle counts, surplus, scrap, zones, bins
12-advanced-ops.prisma       # Rate cards, tariffs, SLA tracking
13-warehouse-ops.prisma      # Put-away, slotting, staging, cross-dock
14-equipment-compliance.prisma # Assets, AMC, tools, generators
15-sow-modules.prisma        # Visitors, sensors, packing, yard
16-logistics-enhancement.prisma # LPN, RFID, WMS tasks, waves, allocations, 3PL
```

### 4.2 Naming Convention

All models use `@@map("ORACLE_TABLE_NAME")` to map to Oracle-style uppercase table names:

```prisma
model LicensePlate {
  id          String @id @default(uuid()) @db.Uuid
  lpnNumber   String @unique @map("lpn_number") @db.VarChar(30)
  // ...
  @@map("WMS_LICENSE_PLATES")
}
```

- **Model name**: PascalCase (`LicensePlate`)
- **Oracle table**: UPPER_SNAKE_CASE with module prefix (`WMS_LICENSE_PLATES`)
- **Column map**: snake_case via `@map("column_name")`

### 4.3 Common Workflow

```bash
# After editing a schema file:
cd packages/backend

# Regenerate Prisma client
npx prisma generate

# Create a migration
npx prisma migrate dev --name add-license-plates

# (In production)
npx prisma migrate deploy
```

### 4.4 Adding a New Model

1. Choose the appropriate schema file (or create a new numbered file)
2. Define the model with `@id @default(uuid()) @db.Uuid`
3. Add `@@map("MODULE_TABLE_NAME")` with Oracle convention
4. Add `@@index(...)` for frequently queried columns
5. Run `npx prisma generate` then `npx prisma migrate dev`

---

## 5. Adding a New Feature (Step by Step)

### Step 1: Define the Prisma Model

Edit the appropriate schema file. Example in `13-warehouse-ops.prisma`:

```prisma
model NewFeature {
  id          String   @id @default(uuid()) @db.Uuid
  name        String   @db.VarChar(200)
  warehouseId String   @map("warehouse_id") @db.Uuid
  status      String   @default("draft") @db.VarChar(20)
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz

  warehouse Warehouse @relation(fields: [warehouseId], references: [id], onDelete: Restrict)

  @@index([warehouseId, status])
  @@map("WMS_NEW_FEATURES")
}
```

Then: `npx prisma generate && npx prisma migrate dev --name add-new-feature`

### Step 2: Create the Service

`packages/backend/src/domains/warehouse-ops/services/new-feature.service.ts`:

```typescript
import type { Prisma } from '@prisma/client';
import { prisma } from '../../../utils/prisma.js';
import { NotFoundError } from '@nit-scs-v2/shared';

export async function listFeatures(params: {
  warehouseId?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;
  const where: Prisma.NewFeatureWhereInput = {};
  if (params.warehouseId) where.warehouseId = params.warehouseId;

  const [data, total] = await Promise.all([
    prisma.newFeature.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.newFeature.count({ where }),
  ]);

  return { data, total, page, pageSize };
}

export async function getFeatureById(id: string) {
  const record = await prisma.newFeature.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('NewFeature', id);
  return record;
}

export async function createFeature(data: Prisma.NewFeatureUncheckedCreateInput) {
  return prisma.newFeature.create({ data });
}
```

### Step 3: Create the Routes

`packages/backend/src/domains/warehouse-ops/routes/new-feature.routes.ts`:

```typescript
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { requirePermission } from '../../../middleware/rbac.js';
import { sendSuccess, sendCreated, sendError } from '../../../utils/response.js';
import { resolveWarehouseScope } from '../../../utils/scope-filter.js';
import * as svc from '../services/new-feature.service.js';

const router = Router();
router.use(authenticate);

router.get('/',
  requirePermission('warehouse_zone', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const wh = resolveWarehouseScope(req.user!, req.query.warehouseId as string);
      if (wh === null) return sendError(res, 403, 'Access denied');
      const result = await svc.listFeatures({
        warehouseId: wh || undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
      });
      sendSuccess(res, result.data, { page: result.page, pageSize: result.pageSize, total: result.total });
    } catch (err) { next(err); }
  },
);

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await svc.getFeatureById(req.params.id);
    sendSuccess(res, record);
  } catch (err) { next(err); }
});

router.post('/',
  requirePermission('warehouse_zone', 'create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await svc.createFeature(req.body);
      sendCreated(res, record);
    } catch (err) { next(err); }
  },
);

export default router;
```

### Step 4: Register in Domain Barrel

`packages/backend/src/domains/warehouse-ops/index.ts`:

```typescript
import newFeatureRoutes from './routes/new-feature.routes.js';

export function registerWarehouseOpsRoutes(router: Router) {
  // ... existing routes ...
  router.use('/new-features', newFeatureRoutes);
}
```

### Step 5: Write Tests

Follow the existing test patterns. Use `vitest` with `prisma-mock`:

```typescript
// new-feature.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPrismaMock } from '../../../test-utils/prisma-mock.js';

// Mock Prisma
const { mockPrisma } = vi.hoisted(() => ({ mockPrisma: {} as any }));
vi.mock('../../../utils/prisma.js', () => ({ prisma: mockPrisma }));

import * as svc from './new-feature.service.js';

beforeEach(() => {
  Object.assign(mockPrisma, createPrismaMock());
});

describe('listFeatures', () => {
  it('returns paginated results', async () => {
    mockPrisma.newFeature.findMany.mockResolvedValue([{ id: '1', name: 'Test' }]);
    mockPrisma.newFeature.count.mockResolvedValue(1);

    const result = await svc.listFeatures({});
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
  });
});
```

### Step 6: Add Frontend Hook

`packages/frontend/src/domains/warehouse-ops/hooks/useNewFeatures.ts`:

```typescript
import { createResourceHooks } from '@/domains/master-data/hooks/useMasterData';

export const {
  useList: useNewFeatures,
  useOne: useNewFeature,
  useCreate: useCreateNewFeature,
  useUpdate: useUpdateNewFeature,
  useRemove: useRemoveNewFeature,
} = createResourceHooks<{ id: string; name: string }>('/new-features', 'new-features');
```

---

## 6. Key Patterns

### 6.1 createResourceHooks (Frontend)

The generic CRUD hook factory generates React Query hooks for any resource:

```typescript
import { createResourceHooks } from '@/domains/master-data/hooks/useMasterData';

const { useList, useOne, useCreate, useUpdate, useRemove } =
  createResourceHooks<MyType>('/api-path', 'query-key');
```

Source: `packages/frontend/src/domains/master-data/hooks/useMasterData.ts`

Generated hooks:
- `useList(params?)` -- `useQuery` with pagination support
- `useOne(id)` -- `useQuery` for single record (auto-disabled when id is undefined)
- `useCreate()` -- `useMutation` with auto cache invalidation
- `useUpdate()` -- `useMutation` with auto cache invalidation
- `useRemove()` -- `useMutation` with auto cache invalidation

### 6.2 Scope Filter (Row-Level Security)

Source: `packages/backend/src/utils/scope-filter.ts`

Three scope levels based on user role:

| Scope | Roles | Filter Applied |
|---|---|---|
| Unrestricted | admin, manager, qc_officer, logistics_coordinator, and 8 more | `{}` (no filter) |
| Warehouse-scoped | warehouse_supervisor, warehouse_staff, gate_officer, inventory_specialist | `{ warehouseId: user.assignedWarehouseId }` |
| Project-scoped | site_engineer | `{ projectId: user.assignedProjectId }` |

Usage in routes:

```typescript
import { resolveWarehouseScope } from '../../../utils/scope-filter.js';

// Returns: warehouseId (scoped), undefined (unrestricted), null (forbidden)
const resolved = resolveWarehouseScope(req.user!, req.query.warehouseId as string);
if (resolved === null) return sendError(res, 403, 'Access denied');
```

### 6.3 Route Registry

Source: `packages/backend/src/utils/route-registry.ts`

The RouteRegistry prevents Express route shadowing by analyzing all registered routes and mounting them in safe order. You do not need to manually manage registration order -- just `register()` and `mount()`.

### 6.4 Response Helpers

```typescript
import { sendSuccess, sendCreated, sendError } from '../../../utils/response.js';

sendSuccess(res, data);                     // 200 + { success: true, data }
sendSuccess(res, data, { page, total });    // 200 + { success: true, data, page, total }
sendCreated(res, data);                     // 201 + { success: true, data }
sendError(res, 400, 'Validation failed');   // 400 + { success: false, error }
```

### 6.5 V1 to V2 Naming Map

Internal Prisma model names differ from display names:

| V1 (Prisma Model) | V2 (API/UI Name) | Description |
|---|---|---|
| MRRV | GRN | Goods Receipt Note |
| MIRV | MI | Material Issue |
| MRV | MRN | Material Return Note |
| RFIM | QCI | Quality Control Inspection |
| OSD | DR | Discrepancy Report |
| MRF | MR | Material Requisition |
| StockTransfer | WT | Warehouse Transfer |

---

## 7. Naming Conventions

| Item | Convention | Example |
|---|---|---|
| Prisma model | PascalCase | `LicensePlate`, `WmsTask` |
| Oracle table | UPPER_SNAKE + module prefix | `WMS_LICENSE_PLATES` |
| Service file | kebab-case + `.service.ts` | `lpn.service.ts` |
| Route file | kebab-case + `.routes.ts` | `lpn.routes.ts` |
| Test file | same name + `.test.ts` | `lpn.service.test.ts` |
| React hook file | camelCase + `.ts` | `useMasterData.ts` |
| React component file | PascalCase + `.tsx` | `KpiCard.tsx`, `CrossDockDashboard.tsx` |
| API path segments | kebab-case | `/api/v1/wms-tasks`, `/api/v1/stock-allocations` |
| Queue name | UPPER_SNAKE | `WMS_QUEUE`, `INV_QUEUE` |
| Job name (legacy) | snake_case | `sla_breach`, `abc_classification` |
| Job name (Oracle) | UPPER_SNAKE | `SCM_SLA_BREACH_CHECK`, `INV_ABC_CLASSIFICATION` |
| Domain barrel export | `registerXxxRoutes` | `registerWarehouseOpsRoutes` |

---

## 8. Common Tasks Reference

### Running Tests

```bash
# All tests (both packages)
pnpm test

# Backend tests only
pnpm --filter @nit-scs-v2/backend test

# Single test file
npx vitest run packages/backend/src/domains/warehouse-ops/services/lpn.service.test.ts

# Watch mode
npx vitest packages/backend/src/domains/warehouse-ops/
```

### Prisma Operations

```bash
cd packages/backend

# Regenerate client after schema change
npx prisma generate

# Create migration
npx prisma migrate dev --name description-of-change

# Deploy migrations (production)
npx prisma migrate deploy

# Check migration status
npx prisma migrate status

# Visual database browser
npx prisma studio

# Seed data
pnpm prisma:seed
```

### Type Checking

```bash
# Backend type check
npx tsc --noEmit -p packages/backend/tsconfig.json

# Frontend type check
npx tsc --noEmit -p packages/frontend/tsconfig.json
```

### Linting and Formatting

```bash
# Lint all packages
pnpm lint

# Format all source files
pnpm format

# Check formatting without modifying
pnpm format:check
```

### Building for Production

```bash
# Build everything
pnpm build

# Build specific package
pnpm build:backend
pnpm build:frontend

# Start production backend
cd packages/backend && node dist/index.js
```

---

## 9. Environment Variables Reference

Validated by Zod schema in `packages/backend/src/config/env.ts`:

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | -- | PostgreSQL connection string |
| `JWT_SECRET` | Yes | (dev fallback) | JWT access token secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | Yes | (dev fallback) | JWT refresh token secret (min 32 chars) |
| `JWT_EXPIRES_IN` | No | `15m` | Access token TTL |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | Refresh token TTL |
| `PORT` | No | `4000` | Server port |
| `NODE_ENV` | No | `development` | `development`, `production`, `test` |
| `CORS_ORIGIN` | No | `http://localhost:3000` | Allowed CORS origin |
| `REDIS_URL` | No | -- | Redis connection string |
| `SENTRY_DSN` | No | -- | Sentry error tracking DSN |
| `RESEND_API_KEY` | No | -- | Resend email API key |
| `RESEND_FROM_EMAIL` | No | -- | Email sender address |
| `RESEND_FROM_NAME` | No | `NIT Logistics` | Email sender name |
| `RESEND_WEBHOOK_SECRET` | No | -- | Resend webhook verification |
| `VAPID_PUBLIC_KEY` | No | -- | Web push VAPID public key |
| `VAPID_PRIVATE_KEY` | No | -- | Web push VAPID private key |
| `VAPID_SUBJECT` | No | `mailto:admin@nit-scs.com` | VAPID subject |
| `AI_ENABLED` | No | -- | Enable AI suggestion features |
| `QUEUE_DASHBOARD` | No | -- | Enable Bull Board in production |

---

## 10. Common Pitfalls

1. **`Item` type has `name` not `nameEn`** -- check actual Prisma model fields
2. **Mutation `onSuccess` callbacks** -- let TypeScript infer the param type; do not annotate
3. **`getRequiredApprovalLevel()`** accepts `'mi' | 'jo' | 'mr'` (not `'mirv'`)
4. **`LineItemsTable` props** -- `items` + `onItemsChange` (not `onChange`)
5. **Icons** -- always use `lucide-react`, never install other icon libraries
6. **Colors** -- never hardcode hex/rgba; use Tailwind tokens (`bg-nesma-primary`, `text-gray-400`)
7. **Card styling** -- always `glass-card rounded-2xl p-6` for content cards
8. **Import paths** -- use `@/` alias for frontend imports (maps to `packages/frontend/src/`)
9. **Route registration** -- add to domain barrel `index.ts`, not directly to the router
10. **New roles** -- must be added to `MainLayout.tsx` -> `roleBasePaths`

---

## 11. Useful References

| Document | Path | Content |
|---|---|---|
| Design System | `CLAUDE.md` | Colors, components, typography, patterns |
| Architecture | `docs/ops/full-architecture-overview.md` | Domain map, API flow, queue topology |
| Oracle Mapping | `docs/ops/prisma-oracle-mapping.md` | Table name mapping |
| Deployment | `docs/ops/deployment-playbook.md` | Render, Redis, K8s |
| Queue Ops | `docs/ops/bullmq-runbook.md` | Queue monitoring |
| Incident Response | `docs/ops/incident-response-guide.md` | Runbooks |
| GRN/ASN Workflow | `docs/ops/grn-asn-runbook.md` | Receiving flow |
| RFID/LPN/WMS | `docs/ops/rfid-lpn-mobile.md` | Mobile workflows |
| 3PL/Customs | `docs/ops/3pl-customs-integration-guide.md` | Logistics flows |
| Monitoring | `docs/ops/monitoring-alerting.md` | Logging, alerting, health checks |
| Index Strategy | `docs/ops/database-index-strategy.md` | Composite index design |
| Redis Ops | `docs/ops/redis-monitoring.md` | Redis monitoring deep dive |
