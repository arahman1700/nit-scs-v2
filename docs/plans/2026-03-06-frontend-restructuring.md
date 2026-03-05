# Frontend Domain Restructuring — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure the frontend from flat file organization into domain-driven modules, matching the backend's 14-domain architecture.

**Architecture:** Create `src/domains/` with barrel exports per domain. Keep all hook files in `api/hooks/` (no physical moves — too risky for 171 files). Domain barrels re-export from `api/hooks/`. Split monolithic `routes.tsx` (758 LOC) into domain route files. Split `formConfigs.ts` (1090 LOC) into domain form config files + registry.

**Tech Stack:** React 19, React Router v6, React Query v5, TypeScript, Vite 6

---

## Current State

| File | Lines | Problem |
|------|-------|---------|
| `api/hooks/index.ts` | 485 | Flat barrel exporting 80+ hooks from 85 files |
| `routes.tsx` | 758 | All routes, role guards, 50+ lazy imports, 40+ redirects |
| `formConfigs.ts` | 1090 | Giant switch statement for 30+ form types |
| `formConstants.ts` | ~200 | Status flows, validators, approval info |
| `formTypes.ts` | 37 | Type definitions (already extracted) |
| `utils/pdf/` | 7 files | Already split by domain (done) |

## Target State

```
src/
├── domains/
│   ├── inbound/routes.tsx        ← GRN, QCI, DR lazy imports + routes
│   ├── outbound/routes.tsx       ← MI, MRN, MR routes
│   ├── inventory/routes.tsx      ← BinCard, CycleCount, ExpiryAlert routes
│   ├── transfers/routes.tsx      ← WT, IMSF, Handover routes
│   ├── logistics/routes.tsx      ← Shipment, GatePass, RouteOptimizer routes
│   ├── job-orders/routes.tsx     ← JO, Labor routes
│   ├── equipment/routes.tsx      ← Tool, Generator, Vehicle, Asset, AMC routes
│   ├── warehouse/routes.tsx      ← WarehouseZone, Mobile workflows
│   ├── compliance/routes.tsx     ← Compliance, Visitors routes
│   ├── reporting/routes.tsx      ← KPI, Security, CostAllocation dashboards
│   └── admin/routes.tsx          ← AdminDashboard, sections, settings routes
│
├── api/hooks/index.ts            ← UNCHANGED (stays as-is for now)
├── routes.tsx                    ← Thin aggregator (~80 LOC)
└── pages/forms/
    ├── formTypes.ts              ← UNCHANGED
    ├── formConstants.ts          ← UNCHANGED
    ├── formConfigs.ts            ← Thin registry (~60 LOC)
    ├── configs/inbound.ts        ← GRN, QCI, DR form configs
    ├── configs/outbound.ts       ← MI, MRN, MR form configs
    ├── configs/transfers.ts      ← WT, IMSF, Handover configs
    ├── configs/logistics.ts      ← Shipment, GatePass configs
    ├── configs/job-orders.ts     ← JO config
    ├── configs/equipment.ts      ← Tool, Generator, Vehicle, RentalContract configs
    ├── configs/inventory.ts      ← Surplus, Scrap configs
    └── configs/compliance.ts     ← Compliance configs
```

**Key Decision:** Hook files stay in `api/hooks/` — moving 171 files risks breaking imports everywhere. The domain barrel layer can be added later as an optional enhancement. Focus on the two biggest wins: routes.tsx and formConfigs.ts.

---

### Task 1: Create domain route files (split routes.tsx)

**Files:**
- Create: `src/domains/admin/routes.tsx`
- Create: `src/domains/warehouse/routes.tsx`
- Create: `src/domains/logistics/routes.tsx`
- Create: `src/domains/transport/routes.tsx`
- Create: `src/domains/manager/routes.tsx`
- Create: `src/domains/qc/routes.tsx`
- Create: `src/domains/engineer/routes.tsx`
- Create: `src/domains/shared/routes.tsx`
- Modify: `src/routes.tsx`

**Step 1: Create the shared route utilities file**

Create `src/domains/routeUtils.tsx`:

```tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { UserRole } from '@nit-scs-v2/shared/types';

export const RoleGuard: React.FC<{
  currentRole: UserRole;
  allowedRoles: UserRole[];
  children: React.ReactNode;
}> = ({ currentRole, allowedRoles, children }) => {
  if (!allowedRoles.includes(currentRole)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

export const ADMIN_MANAGER_ROLES = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.SCRAP_COMMITTEE_MEMBER,
  UserRole.FINANCE_USER,
  UserRole.COMPLIANCE_OFFICER,
];
export const WAREHOUSE_ROLES = [
  UserRole.ADMIN,
  UserRole.WAREHOUSE_SUPERVISOR,
  UserRole.WAREHOUSE_STAFF,
  UserRole.GATE_OFFICER,
  UserRole.INVENTORY_SPECIALIST,
];
export const TRANSPORT_ROLES = [
  UserRole.ADMIN,
  UserRole.FREIGHT_FORWARDER,
  UserRole.TRANSPORT_SUPERVISOR,
];
export const QC_ROLES = [UserRole.ADMIN, UserRole.QC_OFFICER];
export const LOGISTICS_ROLES = [
  UserRole.ADMIN,
  UserRole.LOGISTICS_COORDINATOR,
  UserRole.TRANSPORT_SUPERVISOR,
  UserRole.SHIPPING_OFFICER,
  UserRole.CUSTOMS_SPECIALIST,
];
export const ENGINEER_ROLES = [UserRole.ADMIN, UserRole.SITE_ENGINEER];
export const MANAGER_ROLES = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.TECHNICAL_MANAGER,
];

export const ROLE_REDIRECT: Record<UserRole, string> = {
  [UserRole.ADMIN]: '/admin',
  [UserRole.MANAGER]: '/manager',
  [UserRole.WAREHOUSE_SUPERVISOR]: '/warehouse',
  [UserRole.WAREHOUSE_STAFF]: '/warehouse',
  [UserRole.LOGISTICS_COORDINATOR]: '/logistics',
  [UserRole.SITE_ENGINEER]: '/site-engineer',
  [UserRole.QC_OFFICER]: '/qc',
  [UserRole.FREIGHT_FORWARDER]: '/transport',
  [UserRole.TRANSPORT_SUPERVISOR]: '/logistics',
  [UserRole.SCRAP_COMMITTEE_MEMBER]: '/admin',
  [UserRole.TECHNICAL_MANAGER]: '/manager',
  [UserRole.GATE_OFFICER]: '/warehouse',
  [UserRole.INVENTORY_SPECIALIST]: '/warehouse',
  [UserRole.SHIPPING_OFFICER]: '/logistics',
  [UserRole.FINANCE_USER]: '/admin',
  [UserRole.CUSTOMS_SPECIALIST]: '/logistics',
  [UserRole.COMPLIANCE_OFFICER]: '/admin',
};

export const NotFoundPage: React.FC = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="glass-card rounded-2xl p-10 max-w-md text-center border border-white/10">
      <div className="text-6xl font-bold text-nesma-primary mb-4">404</div>
      <h1 className="text-xl font-semibold text-white mb-2">Page Not Found</h1>
      <p className="text-gray-400 text-sm mb-6">
        The page you are looking for does not exist or has been moved.
      </p>
      <a
        href="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-nesma-primary text-white rounded-xl hover:bg-nesma-accent transition-all text-sm"
      >
        Go to Dashboard
      </a>
    </div>
  </div>
);
```

**Step 2: Create `src/domains/admin/routes.tsx`**

Extract all admin routes (lines 262-414 of current routes.tsx) into this file. Contains: AdminDashboard, section landing pages, form routes, dashboard routes, feature pages, redirects, and the generic resource route.

```tsx
import React from 'react';
import { Route, Navigate } from 'react-router-dom';
import { UserRole } from '@nit-scs-v2/shared/types';
import { RoleGuard, ADMIN_MANAGER_ROLES } from '../routeUtils';

// Lazy imports — admin section
const AdminDashboard = React.lazy(() =>
  import('@/pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })),
);
const AdminResourceList = React.lazy(() =>
  import('@/pages/AdminResourceList').then(m => ({ default: m.AdminResourceList })),
);
// ... (all other admin lazy imports from current routes.tsx lines 84-249)

export function adminRoutes(currentRole: UserRole) {
  return (
    <>
      {/* paste all <Route> elements from lines 262-414 */}
    </>
  );
}
```

**Step 3: Create route files for each role section**

Repeat the pattern for:
- `src/domains/warehouse/routes.tsx` — warehouse routes (lines 416-473)
- `src/domains/transport/routes.tsx` — transport routes (lines 475-491)
- `src/domains/manager/routes.tsx` — manager routes (lines 493-549)
- `src/domains/qc/routes.tsx` — QC routes (lines 551-599)
- `src/domains/logistics/routes.tsx` — logistics routes (lines 601-673)
- `src/domains/engineer/routes.tsx` — site engineer routes (lines 675-707)
- `src/domains/shared/routes.tsx` — shared feature routes (lines 709-752)

Each file exports a function like `warehouseRoutes(currentRole: UserRole)` that returns `<>...</>` with Route elements.

**Step 4: Rewrite `src/routes.tsx` as thin aggregator**

```tsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { UserRole } from '@nit-scs-v2/shared/types';
import { ROLE_REDIRECT, NotFoundPage } from './domains/routeUtils';
import { adminRoutes } from './domains/admin/routes';
import { warehouseRoutes } from './domains/warehouse/routes';
import { transportRoutes } from './domains/transport/routes';
import { managerRoutes } from './domains/manager/routes';
import { qcRoutes } from './domains/qc/routes';
import { logisticsRoutes } from './domains/logistics/routes';
import { engineerRoutes } from './domains/engineer/routes';
import { sharedRoutes } from './domains/shared/routes';

export const AppRouteDefinitions: React.FC<{
  currentRole: UserRole;
}> = ({ currentRole }) => (
  <Routes>
    <Route
      path="/"
      element={
        <Navigate to={ROLE_REDIRECT[currentRole] || '/warehouse'} />
      }
    />
    {adminRoutes(currentRole)}
    {warehouseRoutes(currentRole)}
    {transportRoutes(currentRole)}
    {managerRoutes(currentRole)}
    {qcRoutes(currentRole)}
    {logisticsRoutes(currentRole)}
    {engineerRoutes(currentRole)}
    {sharedRoutes(currentRole)}
    <Route path="*" element={<NotFoundPage />} />
  </Routes>
);
```

**Step 5: Verify build passes**

Run: `pnpm --filter frontend build`
Expected: Build succeeds with zero errors.

**Step 6: Commit**

```bash
git add packages/frontend/src/domains/ packages/frontend/src/routes.tsx
git commit -m "refactor(frontend): split routes.tsx into domain route files"
```

---

### Task 2: Split formConfigs.ts into domain config files

**Files:**
- Create: `src/pages/forms/configs/inbound.ts`
- Create: `src/pages/forms/configs/outbound.ts`
- Create: `src/pages/forms/configs/transfers.ts`
- Create: `src/pages/forms/configs/logistics.ts`
- Create: `src/pages/forms/configs/job-orders.ts`
- Create: `src/pages/forms/configs/equipment.ts`
- Create: `src/pages/forms/configs/inventory.ts`
- Modify: `src/pages/forms/formConfigs.ts`

**Step 1: Create domain config files**

Extract each `case` from the giant switch statement into domain files. Each file exports a function that returns `FormConfig | FormSectionConfig[]`:

```typescript
// src/pages/forms/configs/inbound.ts
import { Package, ClipboardCheck, AlertTriangle } from 'lucide-react';
import type { FormConfig, FormConfigOptions } from '../formTypes';

export function getGrnConfig(options: FormConfigOptions): FormConfig {
  // ... extracted from case 'mrrv' / case 'grn'
}

export function getQciConfig(options: FormConfigOptions): FormConfig {
  // ... extracted from case 'rfim' / case 'qci'
}

export function getDrConfig(options: FormConfigOptions): FormConfig {
  // ... extracted from case 'osd' / case 'dr'
}
```

**Step 2: Rewrite formConfigs.ts as registry**

```typescript
// src/pages/forms/formConfigs.ts
import type { FormConfig, FormConfigOptions } from './formTypes';
export type { FormFieldDef, FormSectionConfig, FormConfig, FormConfigOptions } from './formTypes';
export { STATUS_FLOWS, EDITABLE_STATUSES, VALIDATOR_MAP, getApprovalInfo } from './formConstants';

import { getGrnConfig, getQciConfig, getDrConfig } from './configs/inbound';
import { getMiConfig, getMrnConfig, getMrConfig } from './configs/outbound';
import { getWtConfig, getImsfConfig, getHandoverConfig } from './configs/transfers';
import { getShipmentConfig, getGatePassConfig } from './configs/logistics';
import { getJoConfig } from './configs/job-orders';
import {
  getToolConfig,
  getToolIssueConfig,
  getGeneratorFuelConfig,
  getGeneratorMaintenanceConfig,
  getRentalContractConfig,
  getWarehouseZoneConfig,
  getVehicleMaintenanceConfig,
} from './configs/equipment';
import { getSurplusConfig, getScrapConfig } from './configs/inventory';

const CONFIG_REGISTRY: Record<
  string,
  (options: FormConfigOptions) => FormConfig
> = {
  mrrv: getGrnConfig, grn: getGrnConfig,
  rfim: getQciConfig, qci: getQciConfig,
  osd: getDrConfig,   dr: getDrConfig,
  mirv: getMiConfig,   mi: getMiConfig,
  mrv: getMrnConfig,   mrn: getMrnConfig,
  mrf: getMrConfig,    mr: getMrConfig,
  stock_transfer: getWtConfig, wt: getWtConfig,
  imsf: getImsfConfig,
  handover: getHandoverConfig,
  shipment: getShipmentConfig,
  gate_pass: getGatePassConfig,
  jo: getJoConfig,
  tool: getToolConfig,
  tool_issue: getToolIssueConfig,
  generator_fuel: getGeneratorFuelConfig,
  generator_maintenance: getGeneratorMaintenanceConfig,
  rental_contract: getRentalContractConfig,
  warehouse_zone: getWarehouseZoneConfig,
  vehicle_maintenance: getVehicleMaintenanceConfig,
  surplus: getSurplusConfig,
  scrap: getScrapConfig,
};

export function getFormConfig(
  formType: string,
  options: FormConfigOptions,
): FormConfig | undefined {
  const factory = CONFIG_REGISTRY[formType];
  return factory ? factory(options) : undefined;
}
```

**Step 3: Verify build passes**

Run: `pnpm --filter frontend build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add packages/frontend/src/pages/forms/
git commit -m "refactor(frontend): split formConfigs into domain config files"
```

---

### Task 3: Verify everything works end-to-end

**Step 1: Full frontend build**

Run: `pnpm --filter frontend build`
Expected: Zero errors, zero warnings about missing exports.

**Step 2: TypeScript check**

Run: `pnpm --filter frontend exec tsc --noEmit`
Expected: Zero type errors.

**Step 3: Backend build (sanity check)**

Run: `pnpm --filter backend build`
Expected: No regressions.

**Step 4: Run backend tests**

Run: `pnpm --filter backend test`
Expected: All tests pass (same count as before).

**Step 5: Final commit if any fixups needed**

```bash
git add -A
git commit -m "fix(frontend): address restructuring build issues"
```

---

## What's NOT in This Plan (Deferred)

1. **Moving hook files into domains/** — 171 files, high risk, low reward since barrel already works
2. **Moving page files into domains/** — pages are already organized by feature subdirectories
3. **Backend route file physical moves** — domain barrels already delegate; files can stay in `src/routes/`
4. **Scheduler registry pattern** — separate concern, not blocking anything
5. **Soft delete pattern** — requires Prisma Client Extension, separate task
