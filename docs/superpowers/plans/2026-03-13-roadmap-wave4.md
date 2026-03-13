# Wave 4: Read Replicas + Oracle PO Integration — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add read replica routing for reporting queries and Oracle PO integration for GRN validation.

**Architecture:** Both tasks depend on external infrastructure (read replica DB, Oracle system). Implement with graceful fallbacks when infra isn't available.

**Tech Stack:** Prisma, Express, BullMQ, REST API client

---

## Task 1: Read Replica Routing

**Files:**
- Modify: `packages/backend/src/utils/prisma.ts` — add read replica client
- Modify: `packages/backend/src/domains/reporting/services/` — use read client

- [ ] **Step 1: Add read replica PrismaClient**

In `packages/backend/src/utils/prisma.ts`, add:
```typescript
// Read replica (separate PrismaClient instance)
const readUrl = process.env.DATABASE_READ_URL;

const basePrismaRead = readUrl
  ? new PrismaClient({
      datasourceUrl: readUrl,
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    })
  : basePrisma; // Fallback to primary if no read URL

export const prismaRead = basePrismaRead.$extends({
  query: {
    $allModels: {
      async findMany({ model, args, query }) {
        applySoftDeleteFilter(model, args);
        return query(args);
      },
      async findFirst({ model, args, query }) {
        applySoftDeleteFilter(model, args);
        return query(args);
      },
      async count({ model, args, query }) {
        applySoftDeleteFilter(model, args);
        return query(args);
      },
    },
  },
}) as any as PrismaClient;
```

- [ ] **Step 2: Route reporting queries through prismaRead**

In all reporting service files, import and use `prismaRead`:
```typescript
import { prismaRead } from '../../../utils/prisma.js';

// For read-only queries (dashboards, KPIs, reports):
const data = await prismaRead.mrrv.findMany({ ... });

// Keep mutations on primary prisma:
import { prisma } from '../../../utils/prisma.js';
await prisma.savedReport.update({ ... });
```

Apply to:
- `packages/backend/src/domains/reporting/services/*.ts`
- Dashboard KPI queries
- SLA compliance queries
- Any other read-heavy reporting endpoints

- [ ] **Step 3: Add .env.example entry**

```env
# Optional: Read replica database URL (falls back to primary if not set)
# DATABASE_READ_URL=postgresql://user:pass@read-replica:5432/nit_scs
```

- [ ] **Step 4: Commit**

```bash
git commit -m "perf: add read replica routing for reporting queries"
```

---

## Task 2: Oracle PO Integration (Read-Only)

**Files:**
- Create: `packages/backend/src/domains/inbound/services/oracle-po-sync.service.ts`
- Modify: Prisma schema — add PO mirror tables
- Modify: `packages/backend/src/domains/inbound/services/grn.service.ts` — PO validation
- Create: `packages/backend/src/domains/inbound/routes/purchase-order.routes.ts`
- Create: `packages/frontend/src/pages/sections/PurchaseOrderReconciliation.tsx`

- [ ] **Step 1: Add PO mirror tables to Prisma schema**

In `packages/backend/prisma/schema/03-inbound.prisma`, add:
```prisma
model PurchaseOrderMirror {
  id              String    @id @default(uuid()) @db.Uuid
  poNumber        String    @unique @map("po_number") @db.VarChar(50)
  supplierCode    String?   @map("supplier_code") @db.VarChar(50)
  supplierName    String?   @map("supplier_name") @db.VarChar(200)
  orderDate       DateTime? @map("order_date") @db.Date
  expectedDate    DateTime? @map("expected_date") @db.Date
  status          String    @default("open") @db.VarChar(20)
  totalAmount     Decimal?  @map("total_amount") @db.Decimal(15, 2)
  currency        String?   @db.VarChar(10)
  syncedAt        DateTime  @map("synced_at") @db.Timestamptz
  lines           PurchaseOrderLineMirror[]

  @@index([poNumber])
  @@index([supplierCode])
  @@map("RCV_PO_MIRROR_HEADERS")
}

model PurchaseOrderLineMirror {
  id              String    @id @default(uuid()) @db.Uuid
  poId            String    @map("po_id") @db.Uuid
  lineNumber      Int       @map("line_number")
  itemCode        String    @map("item_code") @db.VarChar(50)
  description     String?   @db.VarChar(500)
  orderedQty      Decimal   @map("ordered_qty") @db.Decimal(12, 3)
  receivedQty     Decimal   @default(0) @map("received_qty") @db.Decimal(12, 3)
  unitPrice       Decimal?  @map("unit_price") @db.Decimal(15, 2)
  uom             String?   @db.VarChar(20)
  po              PurchaseOrderMirror @relation(fields: [poId], references: [id], onDelete: Cascade)

  @@unique([poId, lineNumber])
  @@index([itemCode])
  @@map("RCV_PO_MIRROR_LINES")
}
```

- [ ] **Step 2: Generate migration**

```bash
cd packages/backend && npx prisma migrate dev --name add_po_mirror_tables
```

- [ ] **Step 3: Create Oracle PO sync service**

Create `packages/backend/src/domains/inbound/services/oracle-po-sync.service.ts`:
```typescript
import { prisma } from '../../../utils/prisma.js';
import { logger } from '../../../config/logger.js';

interface OraclePOConfig {
  baseUrl: string;
  apiKey?: string;
  username?: string;
  password?: string;
}

function getConfig(): OraclePOConfig | null {
  const baseUrl = process.env.ORACLE_PO_BASE_URL;
  if (!baseUrl) return null;
  return {
    baseUrl,
    apiKey: process.env.ORACLE_PO_API_KEY,
    username: process.env.ORACLE_PO_USERNAME,
    password: process.env.ORACLE_PO_PASSWORD,
  };
}

export async function syncPurchaseOrders(): Promise<{ synced: number; errors: number }> {
  const config = getConfig();
  if (!config) {
    logger.warn('[OraclePO] No ORACLE_PO_BASE_URL configured, skipping sync');
    return { synced: 0, errors: 0 };
  }

  let synced = 0;
  let errors = 0;

  try {
    // Fetch POs from Oracle REST API
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;

    const response = await fetch(`${config.baseUrl}/purchase-orders?status=open`, { headers });
    if (!response.ok) throw new Error(`Oracle API returned ${response.status}`);

    const { data: orders } = await response.json();

    for (const order of orders) {
      try {
        await prisma.purchaseOrderMirror.upsert({
          where: { poNumber: order.poNumber },
          create: {
            poNumber: order.poNumber,
            supplierCode: order.supplierCode,
            supplierName: order.supplierName,
            orderDate: order.orderDate ? new Date(order.orderDate) : null,
            expectedDate: order.expectedDate ? new Date(order.expectedDate) : null,
            status: order.status || 'open',
            totalAmount: order.totalAmount,
            currency: order.currency,
            syncedAt: new Date(),
            lines: {
              create: (order.lines || []).map((line: any, idx: number) => ({
                lineNumber: line.lineNumber || idx + 1,
                itemCode: line.itemCode,
                description: line.description,
                orderedQty: line.orderedQty,
                receivedQty: line.receivedQty || 0,
                unitPrice: line.unitPrice,
                uom: line.uom,
              })),
            },
          },
          update: {
            status: order.status,
            syncedAt: new Date(),
          },
        });
        synced++;
      } catch (err) {
        errors++;
        logger.error(`[OraclePO] Failed to sync PO ${order.poNumber}: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    logger.error(`[OraclePO] Sync failed: ${(err as Error).message}`);
  }

  return { synced, errors };
}

export async function validateGrnAgainstPO(poNumber: string, items: Array<{ itemCode: string; qty: number }>) {
  const po = await prisma.purchaseOrderMirror.findUnique({
    where: { poNumber },
    include: { lines: true },
  });

  if (!po) return { valid: true, warnings: ['PO not found in mirror — skipping validation'] };

  const warnings: string[] = [];
  for (const item of items) {
    const poLine = po.lines.find(l => l.itemCode === item.itemCode);
    if (!poLine) {
      warnings.push(`Item ${item.itemCode} not found in PO ${poNumber}`);
      continue;
    }
    const remaining = Number(poLine.orderedQty) - Number(poLine.receivedQty);
    if (item.qty > remaining) {
      warnings.push(`Item ${item.itemCode}: receiving ${item.qty} but only ${remaining} remaining on PO`);
    }
  }

  return { valid: warnings.length === 0, warnings };
}
```

- [ ] **Step 4: Register sync job in scheduler**

In maintenance-jobs.ts, add:
```typescript
{
  name: 'po_sync',
  interval: 15 * 60 * 1000, // 15 minutes
  lockDuration: 14 * 60 * 1000,
  handler: async (ctx) => {
    const { syncPurchaseOrders } = await import('../../inbound/services/oracle-po-sync.service.js');
    const result = await syncPurchaseOrders();
    ctx.log('info', `[Scheduler] PO sync: ${result.synced} synced, ${result.errors} errors`);
  },
}
```

- [ ] **Step 5: Add PO validation to GRN creation**

In `grn.service.ts`, add validation before GRN creation:
```typescript
import { validateGrnAgainstPO } from './oracle-po-sync.service.js';

// In create function, if poNumber is provided:
if (data.poNumber) {
  const validation = await validateGrnAgainstPO(data.poNumber, data.lines);
  if (!validation.valid) {
    // Return warnings but don't block (soft validation)
    result.warnings = validation.warnings;
  }
}
```

- [ ] **Step 6: Create PO routes for viewing/reconciliation**

Create `packages/backend/src/domains/inbound/routes/purchase-order.routes.ts`:
```typescript
// GET /api/v1/inbound/purchase-orders — list PO mirrors
// GET /api/v1/inbound/purchase-orders/:poNumber — PO detail with lines
// GET /api/v1/inbound/purchase-orders/:poNumber/reconciliation — PO vs received qty comparison
// POST /api/v1/inbound/purchase-orders/sync — trigger manual sync (admin only)
```

- [ ] **Step 7: Create reconciliation dashboard page**

Create `packages/frontend/src/pages/sections/PurchaseOrderReconciliation.tsx`:
- Table: PO number, supplier, item, ordered qty, received qty, variance
- Status badges: fully received, partial, over-received
- Filter by supplier, date range, status
- Glass-card styling with SmartGrid

- [ ] **Step 8: Add .env.example entries**

```env
# Optional: Oracle PO Integration (REST API)
# ORACLE_PO_BASE_URL=https://oracle.company.com/api/v1
# ORACLE_PO_API_KEY=your-api-key
```

- [ ] **Step 9: Commit**

```bash
git commit -m "feat: add Oracle PO read-only integration with GRN validation and reconciliation"
```
