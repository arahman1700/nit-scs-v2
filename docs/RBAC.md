# NIT Supply Chain System - RBAC Documentation

**Version:** 1.0
**Last Updated:** February 8, 2026
**Company:** Nesma Infrastructure & Technology (NIT) - Saudi Arabia

---

## Table of Contents

1. [Overview](#overview)
2. [System Roles](#system-roles)
3. [Role Mapping](#role-mapping)
4. [Permission Matrix](#permission-matrix)
5. [Approval Levels](#approval-levels)
6. [Backend Enforcement](#backend-enforcement)
7. [Frontend Enforcement](#frontend-enforcement)
8. [Permission Overrides](#permission-overrides)
9. [Route Guards](#route-guards)

---

## Overview

NIT Supply Chain System implements Role-Based Access Control (RBAC) across all layers:
- **Database Layer**: `systemRole` column in `employees` table
- **Backend API**: `requireRole()` middleware on all protected routes
- **Frontend UI**: `hasPermission()` function controls component visibility
- **Approvals**: Role-based approval levels for MIRV and Job Orders

**Core Principles:**
- **Admin Always Has Access**: Admin role bypasses all permission checks
- **Explicit Allow**: Users must have explicit permission; default is deny
- **Resource-level Permissions**: Permissions granted per resource (MRRV, MIRV, JO, etc.)
- **Action-level Granularity**: Create, Read, Update, Delete, Approve, Export

---

## System Roles

### 8 System Roles (Backend - Database Level)

Stored in `employees.systemRole` field:

1. **`admin`**
   - Full system access
   - All permissions on all resources
   - Can manage users, roles, settings
   - Default approval level: 5

2. **`manager`**
   - Approvals and oversight
   - Read access to most resources
   - Approval authority for high-value documents
   - Default approval level: 4

3. **`warehouse_supervisor`**
   - Warehouse operations management
   - Create/edit MRRV, MIRV, MRV
   - Approve QC inspections
   - Stock adjustments
   - Default approval level: 1

4. **`warehouse_staff`**
   - Day-to-day warehouse tasks
   - Create receiving/issuing documents
   - Update inventory
   - No approval authority
   - Default approval level: 1

5. **`logistics_coordinator`**
   - Logistics and shipping operations
   - Create/manage job orders, shipments, customs
   - Approve low-value MIRVs and JOs
   - Default approval level: 2

6. **`site_engineer`**
   - Field/project engineer
   - Request materials (MIRV, MRF)
   - Create job orders
   - Read-only access to inventory
   - Default approval level: 0

7. **`qc_officer`**
   - Quality control specialist
   - Create/complete RFIM
   - Create/update OSD reports
   - Approve QC inspections
   - Default approval level: 1

8. **`freight_forwarder`**
   - External freight agent (future)
   - Update shipment status
   - Upload customs documents
   - Read-only for other resources
   - Default approval level: 0

---

## Role Mapping

### Backend to Frontend Mapping

Backend `systemRole` (string) → Frontend `UserRole` (enum)

| Backend systemRole | Frontend UserRole | Display Name |
|--------------------|-------------------|--------------|
| `admin` | `UserRole.ADMIN` | Admin |
| `manager` | `UserRole.MANAGER` | Manager |
| `warehouse_supervisor` | `UserRole.WAREHOUSE` | Warehouse Staff |
| `warehouse_staff` | `UserRole.WAREHOUSE` | Warehouse Staff |
| `freight_forwarder` | `UserRole.TRANSPORT` | Transport Staff |
| `logistics_coordinator` | `UserRole.LOGISTICS_COORDINATOR` | Logistics Coordinator |
| `site_engineer` | `UserRole.SITE_ENGINEER` | Site Engineer |
| `qc_officer` | `UserRole.QC_OFFICER` | QC Officer |
| *(default)* | `UserRole.ENGINEER` | Engineer |

**Note:** Both `warehouse_supervisor` and `warehouse_staff` map to `UserRole.WAREHOUSE` on the frontend; backend routes distinguish between them via `requireRole()` middleware.

---

## Permission Matrix

### Action Types
- **`create`**: Create new records
- **`read`**: View existing records
- **`update`**: Edit existing records
- **`delete`**: Delete records
- **`approve`**: Approve documents (status transitions)
- **`export`**: Export to PDF/Excel

### Resources
MRRV, MIRV, MRV, RFIM, OSD, Job Orders, Gate Pass, Stock Transfer, MRF, Shipment, Customs, Inventory, Items, Projects, Suppliers, Employees, Warehouses, Generators, Fleet, Reports, Audit Log, Settings, Roles

---

### Full Permission Matrix

| Resource | Admin | Manager | Warehouse | Transport | Engineer | Logistics Coordinator | QC Officer | Site Engineer |
|----------|-------|---------|-----------|-----------|----------|----------------------|------------|---------------|
| **MRRV** | CRUD+AE | R+AE | CRU | — | — | CRU | R | — |
| **MIRV** | CRUD+AE | R+AE | RU | — | CR | CRU+A | — | CR |
| **MRV** | CRUD+AE | R+AE | CRU | — | — | CRU | — | — |
| **RFIM** | CRUD+AE | R+AE | CR | — | — | — | CRU+A | — |
| **OSD** | CRUD+E | R+E | CR | — | — | — | CRU | — |
| **Job Orders** | CRUD+AE | CR+AE | — | RU | CR | CRU+A | — | CR |
| **Gate Pass** | CRUD+E | R+E | CRU | R | — | CRU | — | — |
| **Stock Transfer** | CRUD+AE | R+AE | CR | — | — | CRU | — | — |
| **MRF** | CRUD+AE | R+AE | — | — | CR | — | — | CR |
| **Shipment** | CRUD+E | R+E | — | — | — | CRU | — | — |
| **Customs** | CRUD+E | R+E | — | — | — | CRU | — | — |
| **Inventory** | RU+E | R+E | RU | — | R | R+E | R | R |
| **Items** | CRUD+E | R+E | R | — | — | — | — | — |
| **Projects** | CRUD+E | R+E | R | R | R | — | — | R |
| **Suppliers** | CRUD+E | R+E | — | R | — | R | — | — |
| **Employees** | CRUD+E | R+E | — | — | — | — | — | — |
| **Warehouses** | CRUD+E | R+E | — | — | — | — | — | — |
| **Generators** | CRUD+E | — | — | — | — | — | — | — |
| **Fleet** | CRUD+E | — | — | RU | — | — | — | — |
| **Reports** | R+E | R+E | — | — | — | — | — | — |
| **Audit Log** | R+E | — | — | — | — | — | — | — |
| **Settings** | RU | — | — | — | — | — | — | — |
| **Roles** | R | — | — | — | — | — | — | — |

**Legend:**
- **C**: Create
- **R**: Read
- **U**: Update
- **D**: Delete
- **A**: Approve
- **E**: Export
- **—**: No access

---

### Detailed Permission Breakdown

#### Admin (Full Access)
```javascript
{
  mrrv: ['create', 'read', 'update', 'delete', 'approve', 'export'],
  mirv: ['create', 'read', 'update', 'delete', 'approve', 'export'],
  mrv: ['create', 'read', 'update', 'delete', 'approve', 'export'],
  rfim: ['create', 'read', 'update', 'delete', 'approve', 'export'],
  osd: ['create', 'read', 'update', 'delete', 'export'],
  jo: ['create', 'read', 'update', 'delete', 'approve', 'export'],
  gatepass: ['create', 'read', 'update', 'delete', 'export'],
  'stock-transfer': ['create', 'read', 'update', 'delete', 'approve', 'export'],
  mrf: ['create', 'read', 'update', 'delete', 'approve', 'export'],
  shipment: ['create', 'read', 'update', 'delete', 'export'],
  customs: ['create', 'read', 'update', 'delete', 'export'],
  inventory: ['read', 'update', 'export'],
  items: ['create', 'read', 'update', 'delete', 'export'],
  projects: ['create', 'read', 'update', 'delete', 'export'],
  suppliers: ['create', 'read', 'update', 'delete', 'export'],
  employees: ['create', 'read', 'update', 'delete', 'export'],
  warehouses: ['create', 'read', 'update', 'delete', 'export'],
  generators: ['create', 'read', 'update', 'delete', 'export'],
  fleet: ['create', 'read', 'update', 'delete', 'export'],
  reports: ['read', 'export'],
  'audit-log': ['read', 'export'],
  settings: ['read', 'update'],
  roles: ['read'],
}
```

#### Manager (Approvals + Oversight)
```javascript
{
  mrrv: ['read', 'approve', 'export'],
  mirv: ['read', 'approve', 'export'],
  mrv: ['read', 'approve', 'export'],
  rfim: ['read', 'approve', 'export'],
  osd: ['read', 'export'],
  jo: ['create', 'read', 'approve', 'export'],
  gatepass: ['read', 'export'],
  'stock-transfer': ['read', 'approve', 'export'],
  mrf: ['read', 'approve', 'export'],
  shipment: ['read', 'export'],
  customs: ['read', 'export'],
  inventory: ['read', 'export'],
  items: ['read', 'export'],
  projects: ['read', 'export'],
  suppliers: ['read', 'export'],
  employees: ['read', 'export'],
  warehouses: ['read', 'export'],
  reports: ['read', 'export'],
}
```

#### Warehouse (Receiving/Issuing)
```javascript
{
  mrrv: ['create', 'read', 'update'],
  mirv: ['read', 'update'],
  mrv: ['create', 'read', 'update'],
  rfim: ['create', 'read'],
  osd: ['create', 'read'],
  gatepass: ['create', 'read', 'update'],
  'stock-transfer': ['create', 'read'],
  inventory: ['read', 'update'],
  items: ['read'],
  projects: ['read'],
}
```

#### Transport (Fleet/Job Orders)
```javascript
{
  jo: ['read', 'update'],
  fleet: ['read', 'update'],
  suppliers: ['read'],
  gatepass: ['read'],
  projects: ['read'],
}
```

#### Engineer (Requests Only)
```javascript
{
  mirv: ['create', 'read'],
  mrf: ['create', 'read'],
  jo: ['create', 'read'],
  inventory: ['read'],
  projects: ['read'],
}
```

#### Logistics Coordinator (Logistics Operations)
```javascript
{
  mrrv: ['create', 'read', 'update'],
  mirv: ['create', 'read', 'update', 'approve'],
  mrv: ['create', 'read', 'update'],
  jo: ['create', 'read', 'update', 'approve'],
  shipment: ['create', 'read', 'update'],
  customs: ['create', 'read', 'update'],
  gatepass: ['create', 'read', 'update'],
  'stock-transfer': ['create', 'read', 'update'],
  inventory: ['read', 'export'],
  suppliers: ['read'],
}
```

#### QC Officer (Quality Control)
```javascript
{
  rfim: ['create', 'read', 'update', 'approve'],
  osd: ['create', 'read', 'update'],
  mrrv: ['read'],
  inventory: ['read'],
}
```

#### Site Engineer (Field Requests)
```javascript
{
  mirv: ['create', 'read'],
  mrf: ['create', 'read'],
  jo: ['create', 'read'],
  inventory: ['read'],
  projects: ['read'],
}
```

---

## Approval Levels

### MIRV Approval Levels (5 Levels)

Amount-based approval chain for Material Issue Report Vouchers.

| Level | Amount Range (SAR) | Required Role | SLA Hours | Label |
|-------|-------------------|---------------|-----------|-------|
| 1 | 0 – 10,000 | `warehouse_staff` | 4 | Level 1 - Storekeeper |
| 2 | 10,000 – 50,000 | `logistics_coordinator` | 8 | Level 2 - Logistics Manager |
| 3 | 50,000 – 100,000 | `manager` | 24 | Level 3 - Department Head |
| 4 | 100,000 – 500,000 | `manager` | 48 | Level 4 - Operations Director |
| 5 | >500,000 | `admin` | 72 | Level 5 - CEO |

**Logic:**
- System calculates `estimatedValue = sum(item.standardCost × qtyRequested)` at creation
- On submit, system determines required level based on `estimatedValue`
- Creates approval record with `approverRole` and `slaDueDate = now + slaHours`
- Approver with matching `systemRole` (or higher) can approve

**Example:**
- MIRV with estimatedValue = 75,000 SAR → Level 3 → `manager` role required → 24h SLA

---

### Job Order Approval Levels (4 Levels)

Amount-based approval chain for Job Orders.

| Level | Amount Range (SAR) | Required Role | SLA Hours | Label |
|-------|-------------------|---------------|-----------|-------|
| 1 | 0 – 5,000 | `logistics_coordinator` | 4 | Level 1 - Logistics Coordinator |
| 2 | 5,000 – 20,000 | `manager` | 8 | Level 2 - Logistics Manager |
| 3 | 20,000 – 100,000 | `manager` | 24 | Level 3 - Operations Director |
| 4 | >100,000 | `admin` | 48 | Level 4 - CEO |

**Logic:**
- User sets `totalAmount` on Job Order creation
- On submit, system determines required level based on `totalAmount`
- Creates approval record + SLA tracking record
- Approver with matching `systemRole` (or higher) can approve

**Example:**
- Job Order with totalAmount = 15,000 SAR → Level 2 → `manager` role required → 8h SLA

---

### MRF Approval Levels

MRF (Material Requisition Form) uses the same 5-level approval structure as MIRV.

---

### Max Approval Level by Role

Helper function to determine highest approval level a user can process:

```javascript
function getMaxApprovalLevel(role: UserRole): number {
  switch (role) {
    case UserRole.ADMIN: return 5;
    case UserRole.MANAGER: return 4;
    case UserRole.LOGISTICS_COORDINATOR: return 2;
    case UserRole.WAREHOUSE: return 1;
    case UserRole.QC_OFFICER: return 1;
    default: return 0;
  }
}
```

**Usage:**
- When displaying approval queue, only show documents where `requiredLevel <= getMaxApprovalLevel(currentUserRole)`
- Backend validates: `if (requiredLevel > userMaxLevel) return 403 Forbidden`

---

## Backend Enforcement

### Middleware: `requireRole()`

All protected routes use `requireRole()` middleware to enforce RBAC.

**Location:** `packages/backend/src/middleware/rbac.ts`

**Signature:**
```typescript
function requireRole(...allowedRoles: string[]): (req, res, next) => void
```

**Logic:**
1. Extract `req.user.systemRole` from JWT payload (set by `authenticate()` middleware)
2. Check if `systemRole` is in `allowedRoles` OR is `admin`
3. If yes: call `next()`
4. If no: return `403 Forbidden`

**Example:**
```typescript
// Only admin, manager, warehouse_supervisor can create MRRV
router.post(
  '/',
  authenticate,
  requireRole('admin', 'manager', 'warehouse_supervisor', 'warehouse_staff'),
  validate(mrrvCreateSchema),
  createMrrv
);
```

**Admin Bypass:**
```typescript
if (userRole === 'admin') {
  return next(); // Always allow admin
}
```

---

### Route Protection Examples

#### MRRV Routes
```typescript
router.get('/', authenticate, paginate, getMrrvList); // No role check (all authenticated)
router.post('/', authenticate, requireRole('admin', 'manager', 'warehouse_supervisor', 'warehouse_staff'), createMrrv);
router.put('/:id', authenticate, requireRole('admin', 'manager', 'warehouse_supervisor', 'warehouse_staff'), updateMrrv);
router.post('/:id/approve-qc', authenticate, requireRole('admin', 'manager', 'warehouse_supervisor'), approveQc);
```

#### MIRV Routes
```typescript
router.post('/', authenticate, requireRole('admin', 'manager', 'site_engineer', 'warehouse_supervisor'), createMirv);
router.post('/:id/approve', authenticate, requireRole('admin', 'manager', 'warehouse_supervisor'), approveMirv);
router.post('/:id/issue', authenticate, requireRole('admin', 'warehouse_supervisor', 'warehouse_staff'), issueMirv);
```

#### Job Order Routes
```typescript
router.post('/', authenticate, requireRole('admin', 'manager', 'logistics_coordinator', 'site_engineer'), createJo);
router.post('/:id/approve', authenticate, requireRole('admin', 'manager'), approveJo);
router.post('/:id/complete', authenticate, requireRole('admin', 'manager', 'logistics_coordinator'), completeJo);
```

#### Master Data Routes (CRUD Factory)
```typescript
// Dynamic role assignment per resource
const allowedRoles = {
  items: ['admin', 'manager'],
  projects: ['admin', 'manager'],
  suppliers: ['admin', 'manager'],
  employees: ['admin'],
  warehouses: ['admin', 'manager'],
  // etc.
};

router.post('/:resource', authenticate, requireRole(...allowedRoles[req.params.resource]), createResource);
```

---

## Frontend Enforcement

### Permission Checking

**Location:** `packages/shared/src/permissions.ts`

**Functions:**
```typescript
function hasPermission(role: UserRole, resource: string, permission: Permission): boolean
function canCreate(role: UserRole, resource: string): boolean
function canRead(role: UserRole, resource: string): boolean
function canUpdate(role: UserRole, resource: string): boolean
function canDelete(role: UserRole, resource: string): boolean
function canApprove(role: UserRole, resource: string): boolean
function canExport(role: UserRole, resource: string): boolean
```

**Example Usage:**
```typescript
import { canCreate } from '@nit-scs/shared/permissions';

// In component
const currentUserRole = useCurrentUser().data?.role;

{canCreate(currentUserRole, 'mrrv') && (
  <button onClick={createMrrv}>Create MRRV</button>
)}
```

---

### UI Conditional Rendering

**Pattern 1: Hide entire component**
```tsx
{hasPermission(role, 'mirv', 'approve') && (
  <button onClick={handleApprove}>Approve</button>
)}
```

**Pattern 2: Disable button**
```tsx
<button
  disabled={!canUpdate(role, 'mrrv')}
  onClick={handleEdit}
>
  Edit
</button>
```

**Pattern 3: Show read-only view**
```tsx
{canUpdate(role, 'mrrv') ? (
  <input value={value} onChange={handleChange} />
) : (
  <span>{value}</span>
)}
```

---

### Route Guards

**Location:** `packages/frontend/src/App.tsx`

**Role-based Redirects:**
```tsx
// On login, redirect to role's base path
const roleBasePaths: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'admin',
  [UserRole.WAREHOUSE]: 'warehouse',
  [UserRole.TRANSPORT]: 'transport',
  [UserRole.ENGINEER]: 'engineer',
  [UserRole.MANAGER]: 'manager',
  [UserRole.QC_OFFICER]: 'qc',
  [UserRole.LOGISTICS_COORDINATOR]: 'logistics',
  [UserRole.SITE_ENGINEER]: 'site-engineer',
};

useEffect(() => {
  const basePath = location.pathname.split('/')[1];
  const expectedPath = roleBasePaths[role];

  if (basePath !== expectedPath) {
    navigate(`/${expectedPath}`);
  }
}, [role, navigate]);
```

**Protected Routes:**
All routes require authentication; no public routes except `/login`.

---

## Permission Overrides

### API-based Permission Override System

Allows dynamic permission customization without code changes (future enhancement).

**Functions:**
```typescript
function getEffectivePermissions(
  role: UserRole,
  overrides?: PermissionOverrides
): ResourcePermissions

function hasPermissionWithOverrides(
  role: UserRole,
  resource: string,
  permission: Permission,
  overrides?: PermissionOverrides
): boolean
```

**Override Structure:**
```typescript
type PermissionOverrides = Record<string, ResourcePermissions>;

// Example
const overrides = {
  [UserRole.WAREHOUSE]: {
    mirv: ['create', 'read', 'update', 'approve'], // Add 'approve' permission
  },
};
```

**Usage:**
```typescript
const effectivePerms = getEffectivePermissions(role, overrides);
// Returns merged permissions (defaults + overrides)
```

**Backend Support:**
- Future: `GET /api/permissions/overrides` returns custom overrides from `permission_overrides` table
- Frontend: Fetch on login, pass to `hasPermissionWithOverrides()` checks

---

## Security Best Practices

### 1. Defense in Depth
- **Backend:** All routes protected by `requireRole()` middleware
- **Frontend:** UI hidden based on permissions (UX only; not security)
- **Database:** Row-level security policies (future enhancement)

### 2. Principle of Least Privilege
- Users granted minimum permissions needed for their role
- No "super user" besides admin
- Permissions granted per resource, not globally

### 3. Explicit Allow
- Default permission is deny (no access)
- Must be explicitly listed in `ROLE_PERMISSIONS` to grant access

### 4. Admin Bypass
- Admin always has full access (bypasses `requireRole()` checks)
- Logged in audit trail for accountability

### 5. JWT-based Stateless Auth
- No server-side session storage
- Role embedded in JWT payload (`systemRole` claim)
- Token refresh on expiry (auto-silent)

### 6. Audit Logging
- All CRUD operations logged to `audit_log` table
- Includes `performedById`, `action`, `oldValues`, `newValues`, `ipAddress`, `timestamp`
- Admin can view full audit log

---

## Role Assignment Workflow

### 1. Initial User Creation
- Admin creates employee record via `POST /api/employees`
- Sets `systemRole` (one of 8 values)
- Sets initial password (hashed with bcrypt)

### 2. Role Change
- Admin edits employee via `PUT /api/employees/:id`
- Updates `systemRole` field
- User must re-login for new role to take effect (JWT contains old role until refresh)

### 3. Role Validation
- On login, backend validates `systemRole` is one of allowed values
- If invalid: login rejected

### 4. Multi-role Users (Not Supported)
- One user = one role
- For multi-role access, create separate accounts (e.g., `john.admin@nit.sa`, `john.manager@nit.sa`)

---

## Common RBAC Scenarios

### Scenario 1: Warehouse Supervisor creates MRRV
- **Role:** `warehouse_supervisor`
- **Action:** Create MRRV
- **Check:** `canCreate('warehouse', 'mrrv')` → `true`
- **Backend:** `requireRole('admin', 'manager', 'warehouse_supervisor', 'warehouse_staff')` → Allow

### Scenario 2: Engineer requests materials
- **Role:** `site_engineer`
- **Action:** Create MIRV
- **Check:** `canCreate('site_engineer', 'mirv')` → `true`
- **Backend:** `requireRole('admin', 'manager', 'site_engineer', 'warehouse_supervisor')` → Allow

### Scenario 3: Manager approves MIRV (Level 3 - 75,000 SAR)
- **Role:** `manager`
- **Action:** Approve MIRV
- **Check:** `canApprove('manager', 'mirv')` → `true`
- **Approval Level:** 3 (50K-100K SAR)
- **Max Approval Level:** `getMaxApprovalLevel('manager')` → 4
- **Result:** Allow (4 >= 3)

### Scenario 4: Warehouse Staff tries to approve high-value MIRV (Level 4 - 150,000 SAR)
- **Role:** `warehouse_staff`
- **Action:** Approve MIRV
- **Check:** `canApprove('warehouse', 'mirv')` → `false` (no approve permission)
- **Backend:** Even if UI allowed, `requireRole('admin', 'manager', 'warehouse_supervisor')` → 403 Forbidden

### Scenario 5: QC Officer completes RFIM
- **Role:** `qc_officer`
- **Action:** Complete RFIM
- **Check:** `canApprove('qc_officer', 'rfim')` → `true`
- **Backend:** `requireRole('admin', 'qc_officer')` → Allow

---

## RBAC Testing Checklist

### Backend Tests
- [ ] Admin can access all routes
- [ ] Non-admin cannot access admin-only routes (403 Forbidden)
- [ ] Role middleware correctly rejects invalid roles
- [ ] Approval level validation enforced
- [ ] JWT with invalid systemRole rejected

### Frontend Tests
- [ ] UI elements hidden for unauthorized roles
- [ ] Route redirects work correctly for each role
- [ ] Permission checks return correct boolean
- [ ] Override system merges permissions correctly

### Integration Tests
- [ ] Create document as Engineer → Submit → Approve as Manager → Success
- [ ] Create document as Warehouse Staff → Try to approve → 403 Forbidden
- [ ] Approval chain: Level 1 user approves Level 2 document → 403 Forbidden

---

**End of RBAC.md**
