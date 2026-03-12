# Team Onboarding Guide — Day-One Productivity

Last updated: 2026-03-12

---

## Quick Start (15 minutes)

### Prerequisites

- Node.js 20+ LTS
- pnpm 9+
- PostgreSQL 16+
- Redis 7+
- Git

### Setup

```bash
# 1. Clone and install
git clone <repo-url> && cd V2
pnpm install

# 2. Environment
cp packages/backend/.env.example packages/backend/.env
# Edit .env: DATABASE_URL, REDIS_URL, JWT_SECRET

# 3. Database
cd packages/backend
npx prisma generate
npx prisma db push
npx prisma db seed    # seeds demo data

# 4. Start development
cd ../..
pnpm dev              # starts both frontend (5173) and backend (3000)
```

### Verify

```bash
# Backend health
curl http://localhost:3000/health

# Run tests
pnpm test             # all tests
pnpm test:backend     # backend only (4,796 tests)
```

---

## Repository Structure

```
V2/
+-- packages/
|   +-- backend/             # Express 5 API server
|   |   +-- prisma/
|   |   |   +-- schema/      # 17 .prisma files (155 models)
|   |   |   +-- seed-data.ts # Demo seed data
|   |   |   +-- seed-semantic-layer.ts
|   |   +-- src/
|   |   |   +-- config/      # logger, redis, env
|   |   |   +-- domains/     # 14 domain directories (business logic)
|   |   |   +-- infrastructure/ # BullMQ, cron, event bus
|   |   |   +-- middleware/   # auth, rbac, rate-limit, validate, sanitize
|   |   |   +-- test-utils/   # prisma-mock, test-app, helpers
|   |   |   +-- utils/        # scope-filter, crud-factory, response, jwt
|   |   |   +-- index.ts      # Server entry point
|   |
|   +-- frontend/            # React 19 SPA
|   |   +-- src/
|   |   |   +-- domains/     # React Query hooks per domain
|   |   |   +-- components/  # Shared UI components
|   |   |   +-- pages/       # Route pages
|   |   |   +-- config/      # navigation, columns
|   |   |   +-- layouts/     # MainLayout
|   |   |   +-- contexts/    # Auth, Direction providers
|   |
|   +-- shared/              # Shared types and utilities
|
+-- docs/
|   +-- ops/                 # Operational documentation (you are here)
|
+-- CLAUDE.md                # Project conventions and design system
+-- CLAUDE-FINAL-REPORT.md   # Architecture report
```

---

## Domain-Driven Architecture

### Backend Domains

Each domain follows the same pattern:

```
domains/{domain}/
+-- index.ts          # Barrel file: exports registerXxxRoutes(router)
+-- routes/
|   +-- foo.routes.ts       # Express route handlers
|   +-- foo.routes.test.ts  # Route integration tests
+-- services/
    +-- foo.service.ts      # Business logic (Prisma queries)
    +-- foo.service.test.ts # Unit tests
```

### The 14 Domains

| Domain | API Prefix | Responsibility |
|--------|-----------|----------------|
| auth | `/api/v1/auth` | Login, JWT, permissions |
| master-data | `/api/v1/master-data` | Items, suppliers, warehouses |
| inbound | `/api/v1/inbound` | GRN, QCI, ASN, receiving |
| outbound | `/api/v1/outbound` | MI, MRN, MR, wave picking |
| inventory | `/api/v1/inventory` | Stock, cycle counts, ABC |
| warehouse-ops | `/api/v1/warehouse-ops` | Zones, putaway, LPN, RFID |
| transfers | `/api/v1/transfers` | Stock transfers, handover |
| logistics | `/api/v1/logistics` | Shipments, customs, 3PL |
| job-orders | `/api/v1/job-orders` | Work orders |
| equipment | `/api/v1/equipment` | Assets, AMC, rentals |
| workflow | `/api/v1/workflow` | Approvals, rules |
| compliance | `/api/v1/compliance` | Audits, visitors |
| reporting | `/api/v1/reporting` | Dashboards, KPIs |
| system | `/api/v1/system` | Notifications, uploads, SLA |

---

## Adding a New Feature (Step by Step)

### 1. Add Prisma Model

Edit the appropriate schema file in `packages/backend/prisma/schema/`:

```prisma
// In the relevant schema file (e.g., 13-warehouse-ops.prisma)
model NewFeature {
  id          String   @id @default(uuid())
  name        String
  warehouseId String
  status      String   @default("draft")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  warehouse   Warehouse @relation(fields: [warehouseId], references: [id])

  @@map("WMS_NEW_FEATURES")  // Oracle table name
  @@index([warehouseId])
  @@index([status])
}
```

Then generate:

```bash
npx prisma generate
npx prisma db push    # development
# or: npx prisma migrate dev --name add-new-feature  # with migration
```

### 2. Create Service

```typescript
// packages/backend/src/domains/warehouse-ops/services/new-feature.service.ts

import { prisma } from '../../../utils/prisma.js';
import { NotFoundError } from '@nit-scs-v2/shared';

/** List features with pagination and optional warehouse filter. */
export async function listFeatures(params: {
  warehouseId?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;
  const where = params.warehouseId ? { warehouseId: params.warehouseId } : {};

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

/** Get a single feature by ID. Throws NotFoundError if not found. */
export async function getFeatureById(id: string) {
  const record = await prisma.newFeature.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('NewFeature', id);
  return record;
}
```

### 3. Create Routes

```typescript
// packages/backend/src/domains/warehouse-ops/routes/new-feature.routes.ts

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { requirePermission } from '../../../middleware/rbac.js';
import { sendSuccess, sendError } from '../../../utils/response.js';
import { resolveWarehouseScope as _resolveWarehouseScope } from '../../../utils/scope-filter.js';
import * as featureService from '../services/new-feature.service.js';

const router = Router();

router.use(authenticate);
router.use(requirePermission('warehouse_zone', 'read'));

function resolveWarehouseScope(req: Request, warehouseId: string | undefined) {
  return _resolveWarehouseScope(req.user!, warehouseId);
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resolved = resolveWarehouseScope(req, req.query.warehouseId as string);
    if (resolved === null) return sendError(res, 403, 'You do not have access to this warehouse');
    const result = await featureService.listFeatures({
      warehouseId: resolved,
      page: req.query.page ? Number(req.query.page) : undefined,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
    });
    sendSuccess(res, result.data, { page: result.page, pageSize: result.pageSize, total: result.total });
  } catch (err) {
    next(err);
  }
});

export default router;
```

### 4. Register in Domain Index

```typescript
// packages/backend/src/domains/warehouse-ops/index.ts
import newFeatureRoutes from './routes/new-feature.routes.js';

export function registerWarehouseOpsRoutes(router: Router) {
  // ... existing routes ...
  router.use('/new-features', newFeatureRoutes);
}
```

### 5. Write Tests

```typescript
// packages/backend/src/domains/warehouse-ops/services/new-feature.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
// ... follow existing test patterns in the codebase
```

### 6. Add Frontend Hook

```typescript
// packages/frontend/src/domains/warehouse-ops/hooks/useNewFeatures.ts
import { createResourceHooks } from '@/api/hooks';

export const {
  useList: useNewFeatures,
  useOne: useNewFeature,
  useCreate: useCreateNewFeature,
} = createResourceHooks('/warehouse-ops/new-features', 'new-features');
```

---

## Key Patterns

### Scope Filter (Row-Level Security)

```typescript
import { resolveWarehouseScope } from '../../../utils/scope-filter.js';

// Returns: warehouseId (scoped), undefined (unrestricted), null (forbidden)
const resolved = resolveWarehouseScope(req.user!, req.query.warehouseId);
if (resolved === null) return sendError(res, 403, 'Access denied');
```

### CRUD Factory

```typescript
// Generates standard CRUD hooks for React Query
import { createResourceHooks } from '@/api/hooks';
const { useList, useOne, useCreate, useUpdate, useRemove } =
  createResourceHooks<ItemType>('/api/path', 'cache-key');
```

### Response Helpers

```typescript
import { sendSuccess, sendCreated, sendError } from '../../../utils/response.js';

sendSuccess(res, data);                    // 200 + { success: true, data }
sendSuccess(res, data, { page, total });   // 200 + pagination
sendCreated(res, data);                    // 201 + { success: true, data }
sendError(res, 400, 'Validation failed');  // 400 + { success: false, error }
```

### Prisma Mock (Testing)

```typescript
import { createPrismaMock } from '../../../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => ({ mockPrisma: {} as PrismaMock }));
vi.mock('../../../utils/prisma.js', () => ({ prisma: mockPrisma }));

beforeEach(() => {
  Object.assign(mockPrisma, createPrismaMock());
});
```

---

## Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Prisma model | PascalCase | `LicensePlate` |
| Oracle table | UPPER_SNAKE + prefix | `WMS_LICENSE_PLATES` |
| Service file | kebab-case + `.service.ts` | `lpn.service.ts` |
| Route file | kebab-case + `.routes.ts` | `lpn.routes.ts` |
| Test file | kebab-case + `.test.ts` | `lpn.service.test.ts` |
| React hook | camelCase + `use` prefix | `useLpnList` |
| React component | PascalCase | `LpnDetailPage.tsx` |
| API path | kebab-case | `/api/v1/warehouse-ops/lpn` |
| Queue name | UPPER_SNAKE | `WMS_QUEUE` |
| BullMQ job | camelCase | `slaCheck` |

---

## Common Tasks

### Run specific test file

```bash
npx vitest run packages/backend/src/domains/warehouse-ops/services/lpn.service.test.ts
```

### Generate Prisma client after schema change

```bash
cd packages/backend && npx prisma generate
```

### Check for type errors

```bash
npx tsc --noEmit -p packages/backend/tsconfig.json
npx tsc --noEmit -p packages/frontend/tsconfig.json
```

### Lint check

```bash
npx eslint packages/backend/src packages/frontend/src --max-warnings=0
```

### Build frontend

```bash
cd packages/frontend && npx vite build
```

---

## Useful References

| Doc | Path | Content |
|-----|------|---------|
| Design System | `CLAUDE.md` | Colors, components, patterns |
| Architecture | `docs/ops/full-architecture-overview.md` | Domain map, API flow |
| Oracle Mapping | `docs/ops/prisma-oracle-mapping.md` | Table name mapping |
| Deployment | `docs/ops/deployment-playbook.md` | Render, Redis, K8s |
| Queue Ops | `docs/ops/bullmq-runbook.md` | Queue monitoring |
| Incident Response | `docs/ops/incident-response-guide.md` | Runbooks |
| GRN/ASN Workflow | `docs/ops/grn-asn-runbook.md` | Receiving flow |
| RFID/LPN/WMS | `docs/ops/rfid-lpn-mobile.md` | Mobile workflows |
| 3PL/Customs | `docs/ops/3pl-customs-integration-guide.md` | Logistics flows |
| Monitoring | `docs/ops/monitoring-alerting.md` | Logging, alerting |
