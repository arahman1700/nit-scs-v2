# System Architecture

Technical architecture documentation for the NIT Supply Chain System.

## Table of Contents

1. [System Overview](#system-overview)
2. [Backend Architecture](#backend-architecture)
3. [Frontend Architecture](#frontend-architecture)
4. [Shared Package](#shared-package)
5. [Authentication Flow](#authentication-flow)
6. [Data Flow](#data-flow)
7. [Real-Time Synchronization](#real-time-synchronization)
8. [Database Schema](#database-schema)
9. [API Design](#api-design)
10. [Security](#security)

---

## System Overview

The NIT Supply Chain System is built as a **pnpm monorepo** with three packages:

```
┌─────────────────────────────────────────────────────────────┐
│                     NIT-SCS Monorepo                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   @nit-scs   │  │   @nit-scs   │  │   @nit-scs   │     │
│  │    /shared   │  │   /backend   │  │  /frontend   │     │
│  │              │  │              │  │              │     │
│  │ Types        │◄─┤ Express 5    │◄─┤ React 19     │     │
│  │ Validators   │  │ Prisma       │  │ React Query  │     │
│  │ Constants    │  │ Socket.IO    │  │ Zustand      │     │
│  │ Permissions  │  │ PostgreSQL   │  │ Tailwind     │     │
│  │ Formatters   │  │ JWT Auth     │  │ Socket.IO    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                            ▲                  │             │
│                            │                  │             │
│                            └──────────────────┘             │
│                          WebSocket/HTTP                     │
└─────────────────────────────────────────────────────────────┘
```

**Design Principles:**
- **Separation of Concerns:** Three-tier architecture (shared logic, server, client)
- **Type Safety:** End-to-end TypeScript with strict mode
- **Real-Time First:** Socket.IO for instant updates across all clients
- **API-First:** RESTful API with Zod validation at every layer
- **Code Reuse:** Shared types and validators prevent drift between frontend/backend

---

## Backend Architecture

### Technology Stack

- **Runtime:** Node.js 20+ (ES Modules)
- **Framework:** Express 5.1
- **Database:** PostgreSQL 15
- **ORM:** Prisma 6.5 (55 models, 1599-line schema)
- **Real-Time:** Socket.IO 4.8
- **Authentication:** JWT (jsonwebtoken 9.0)
- **Validation:** Zod 3.24
- **Security:** Helmet, CORS, bcryptjs
- **File Upload:** Multer 2.0 (10MB limit)
- **Logging:** Morgan

### Middleware Stack

Middleware is applied in **strict order** (order matters for security and correctness):

```
Request
   │
   ▼
1. helmet()              ─── Security headers
   │
   ▼
2. cors(options)         ─── CORS policy
   │
   ▼
3. express.json(10mb)    ─── Parse JSON bodies
   │
   ▼
4. morgan('dev')         ─── HTTP logging
   │
   ▼
5. requestId             ─── Generate unique request ID
   │
   ▼
6. rateLimiter(200/min)  ─── Prevent abuse (200 req/min per IP)
   │
   ▼
7. /api/health           ─── Health check (no auth)
   │
   ▼
8. Routes                ─── Application routes
   │  ├─ authenticate()      (JWT verification, injects req.user)
   │  ├─ requireRole(...)    (RBAC, checks req.user.systemRole)
   │  ├─ validate(schema)    (Zod, validates req.body/query/params)
   │  └─ Controller logic
   │
   ▼
9. errorHandler          ─── Catch-all error handler (must be last)
   │
   ▼
Response
```

**Key Middleware Details:**
- `requestId`: Generates `req.id` (UUID) for tracing
- `rateLimiter(limit, window)`: In-memory rate limiting (configurable per route)
- `authenticate()`: JWT verification, sets `req.user` with `{ id, systemRole, ... }`
- `requireRole(roles)`: RBAC check, returns 403 if `req.user.systemRole` not in `roles`
- `validate(schema, source)`: Zod validation, sets `res.locals.validatedBody/Query/Params`
- `errorHandler`: Catches all errors, logs, returns JSON error response

### Route Modules

The backend has **22 route modules**:

| Route File | Base Path | Purpose | RBAC |
|------------|-----------|---------|------|
| `auth.routes.ts` | `/api/auth` | Login, logout, refresh token, forgot password | Public |
| `master-data.routes.ts` | `/api` | 15 CRUD endpoints (regions, projects, items, etc.) | Role-based per resource |
| `mrrv.routes.ts` | `/api/mrrv` | Material Receiving Report Voucher | Warehouse, Admin |
| `mirv.routes.ts` | `/api/mirv` | Material Issue Report Voucher | Warehouse, Admin |
| `mrv.routes.ts` | `/api/mrv` | Material Return Voucher | Warehouse, Admin |
| `rfim.routes.ts` | `/api/rfim` | Request for Inspection of Materials | QC, Admin |
| `osd.routes.ts` | `/api/osd` | Over/Short/Damage Report | QC, Admin |
| `job-order.routes.ts` | `/api/job-orders` | Job Orders (via logistics.routes) | Logistics, Admin |
| `gate-pass.routes.ts` | `/api/gate-passes` | Gate Passes (via logistics.routes) | Logistics, Admin |
| `stock-transfer.routes.ts` | `/api/stock-transfers` | Stock Transfers (via logistics.routes) | Logistics, Admin |
| `mrf.routes.ts` | `/api/mrf` | Material Requisition Form (via logistics.routes) | Logistics, Admin |
| `shipment.routes.ts` | `/api/shipments` | Shipments (via logistics.routes) | Logistics, Admin |
| `notification.routes.ts` | `/api/notifications` | User notifications | Authenticated |
| `audit.routes.ts` | `/api/audit` | Audit log queries | Admin, Manager |
| `dashboard.routes.ts` | `/api/dashboard` | KPI aggregations | Authenticated |
| `settings.routes.ts` | `/api/settings` | System settings (file-based JSON) | Admin |
| `upload.routes.ts` | `/api/upload` | File upload (Multer) | Authenticated |
| `permissions.routes.ts` | `/api/permissions` | RBAC permission queries | Admin |
| `task.routes.ts` | `/api/tasks` | Task management | Authenticated |
| `company-document.routes.ts` | `/api/documents` | Company document library | Authenticated |
| `reports.routes.ts` | `/api/reports` | Report generation | Admin, Manager |
| `logistics.routes.ts` | `/api` | Mounts job-order, gate-pass, stock-transfer, mrf, shipment | Logistics, Admin |

**Note:** `logistics.routes.ts` is a parent router that mounts 5 sub-routers.

### CRUD Factory Pattern

The backend uses a **factory pattern** to generate CRUD routes for master data (15 resources):

**File:** `packages/backend/src/utils/crud-factory.ts`

```typescript
createCrudRouter(config: CrudConfig): Router
```

**Generated Routes:**
- `GET /api/{resource}` - List with pagination, search, sort
- `GET /api/{resource}/:id` - Get by ID
- `POST /api/{resource}` - Create (with Zod validation)
- `PUT /api/{resource}/:id` - Update (with Zod validation)
- `DELETE /api/{resource}/:id` - Delete (soft or hard)

**Features:**
- Automatic Zod validation (config.createSchema, config.updateSchema)
- Search across multiple fields (config.searchFields)
- Pagination (via `paginate()` middleware, sets `res.locals.pagination`)
- Sorting (query param `?sortBy=fieldName&order=asc|desc`)
- Prisma includes (config.includes for relations)
- Audit logging (via `createAuditLog()` service)
- Socket.IO events (emits `entity:created/updated/deleted`)
- RBAC (config.allowedRoles enforces role checks on write operations)

**Example Usage:**

```typescript
// packages/backend/src/routes/master-data.routes.ts
const regionRouter = createCrudRouter({
  modelName: 'region',
  tableName: 'regions',
  createSchema: createRegionSchema,
  updateSchema: updateRegionSchema,
  searchFields: ['regionName', 'regionNameAr'],
  defaultSort: 'regionName',
  allowedRoles: ['admin', 'manager'],
});

router.use('/regions', regionRouter);
```

**15 Master Data Resources:**
1. Regions
2. Warehouses
3. Projects
4. Employees
5. Suppliers
6. Items (materials/parts)
7. Categories
8. Locations (bins)
9. Cost Centers
10. Departments
11. Currencies
12. Units of Measure
13. Item Groups
14. Warehouse Types
15. Job Order Types

### Services Layer

The backend has **6 core services**:

1. **auth.service.ts** - User authentication, password hashing, JWT generation
2. **audit.service.ts** - Audit log creation (`createAuditLog(tableName, action, recordId, userId, changes)`)
3. **document-number.service.ts** - Auto-numbering (`generateDocumentNumber(prefix, year)` → `MRRV-2026-0001`)
4. **inventory.service.ts** - FIFO inventory accounting, reservation, deduction
5. **notification.service.ts** - Create and broadcast notifications
6. **approval.service.ts** - Multi-level approval workflow logic

**Inventory Service (FIFO):**
- Tracks inventory across warehouse locations
- Implements FIFO (First In First Out) accounting
- Supports reservation (MIRV Approved) and deduction (MIRV Issued)
- Prevents negative inventory with CHECK constraints + application logic
- Updates `inventory_transactions` for every movement

### Prisma ORM

**Schema Stats:**
- **Models:** 55
- **Lines:** 1599
- **Primary Keys:** UUIDs (`@default(uuid()) @db.Uuid`)
- **Timestamps:** `createdAt`, `updatedAt` on all major models
- **Relations:** Foreign keys with `onDelete: Cascade/SetNull`

**Core Model Groups:**

1. **Master Data (15 models):** Region, Warehouse, Project, Employee, Supplier, Item, etc.
2. **Documents (12 models):** MRRV, MIRV, MRV, RFIM, OSD, JobOrder, GatePass, StockTransfer, MRF, Shipment, Customs, etc.
3. **Inventory (5 models):** Inventory, InventoryTransaction, Reservation, StockCount, StockAdjustment
4. **Approvals (3 models):** ApprovalWorkflow, ApprovalLevel, ApprovalHistory
5. **System (10 models):** User, Role, Permission, AuditLog, Notification, Task, CompanyDocument, SystemSettings, DocumentCounter, etc.
6. **Logistics (5 models):** JobOrder (7 types), Fleet, Vehicle, Driver, Route

**Auto-Numbering:**
- `DocumentCounter` table: `{ prefix, year, lastNumber }`
- Service generates: `PREFIX-YYYY-NNNN` (e.g., `MRRV-2026-0042`)
- Atomic increment with Prisma transactions

### Socket.IO

**Connection:**
- JWT authentication on handshake (`auth.token`)
- Middleware validates token, sets `socket.data.user`
- Clients join rooms: `user:{userId}`, `role:{systemRole}`, `document:{docType}:{docId}`

**Events Emitted by Backend:**

| Event | Payload | Trigger |
|-------|---------|---------|
| `document:status` | `{ documentType, documentId, status }` | Document status change |
| `entity:created` | `{ entity, id }` | CRUD create operation |
| `entity:updated` | `{ entity, id }` | CRUD update operation |
| `entity:deleted` | `{ entity, id }` | CRUD delete operation |
| `approval:requested` | `{ documentType, documentId, level }` | Approval requested |
| `approval:approved` | `{ documentType, documentId, level, approver }` | Approval granted |
| `approval:rejected` | `{ documentType, documentId, level, reason }` | Approval rejected |
| `notification:new` | `{ notificationId, userId, message }` | New notification |
| `inventory:updated` | `{ itemId, warehouseId, quantity }` | Inventory change |
| `task:assigned` | `{ taskId, assignedTo }` | Task assigned |
| `task:completed` | `{ taskId, completedBy }` | Task completed |

**Broadcast Helper:**

```typescript
// packages/backend/src/socket/setup.ts
emitToAll(io, event, payload);  // Broadcast to all connected clients
emitToRoom(io, room, event, payload);  // Emit to specific room
```

**File:** `packages/backend/src/socket/setup.ts` (50 lines)

---

## Frontend Architecture

### Technology Stack

- **Framework:** React 19.2
- **Routing:** React Router 7.13
- **State Management:**
  - **Zustand 5.0** - App state (auth token, user role)
  - **React Query 5.65** - Server state (caching, invalidation)
- **UI Framework:** Tailwind CSS 3.4
- **HTTP Client:** Axios 1.8 (with interceptors for JWT refresh)
- **Real-Time:** Socket.IO Client 4.8
- **Charts:** Recharts 3.7
- **Drag & Drop:** dnd-kit 6.3 (for Kanban boards)
- **Icons:** Lucide React 0.563
- **PDF Export:** jsPDF 4.1 + jspdf-autotable 5.0
- **Build Tool:** Vite 6.2

### Code-Splitting

All 40+ page components are lazy-loaded using `React.lazy()`:

```typescript
const AdminDashboard = React.lazy(() =>
  import('@/pages/AdminDashboard').then(m => ({ default: m.AdminDashboard }))
);
```

**Benefits:**
- Faster initial load (only loads login page)
- Smaller bundles per route
- Vite automatically code-splits into 65+ chunks

**Suspense Fallback:**

```tsx
<Suspense fallback={<PageLoader />}>
  <Routes>...</Routes>
</Suspense>
```

### Routing Architecture

**File:** `packages/frontend/src/App.tsx` (389 lines)

**Role-Based Routing:**

| Role | Base Path | Dashboard | Permissions |
|------|-----------|-----------|-------------|
| Admin | `/admin` | AdminDashboard | Full system access |
| Manager | `/manager` | ManagerDashboard | Approvals, reports |
| Warehouse Supervisor | `/warehouse` | WarehouseDashboard | Warehouse ops + approvals |
| Warehouse Staff | `/warehouse` | WarehouseDashboard | Warehouse ops only |
| Logistics Coordinator | `/logistics` | LogisticsCoordinatorDashboard | Job orders, shipments |
| Site Engineer | `/site-engineer` | SiteEngineerDashboard | Material requests |
| QC Officer | `/qc` | QCOfficerDashboard | Quality inspections |
| Freight Forwarder | `/transport` | TransportDashboard | Shipping, customs |

**Section Landing Pages:**

The admin section has 7 "landing pages" with tab-based navigation:

1. `/admin/inventory` - InventorySectionPage (Stock Levels, Dashboard, Shifting, Non-Moving)
2. `/admin/receiving` - ReceivingSectionPage (MRRV, Gate Passes, Shipments, Customs)
3. `/admin/issuing` - IssuingSectionPage (MIRV, Stock Transfers, MRF)
4. `/admin/quality` - QualitySectionPage (RFIM, OSD, MRV)
5. `/admin/logistics` - LogisticsSectionPage (Kanban, All Jobs, Fleet, SLA, Payments, Map)
6. `/admin/master` - MasterDataSectionPage (15 master data tabs)
7. `/admin/system` - AdminSystemPage (Roles, Audit Log, Settings, Reports)

**Legacy Route Redirects:**

Old routes (from pre-refactor UI) redirect to new section pages:

```tsx
<Route path="/admin/warehouse/mrrv" element={<Navigate to="/admin/receiving?tab=mrrv" replace />} />
<Route path="/admin/transport/board" element={<Navigate to="/admin/logistics?tab=kanban" replace />} />
```

**Form Routes:**

Generic form routes handle create/edit for any resource:

```tsx
<Route path="/admin/forms/:formType" element={<ResourceForm />} />
<Route path="/admin/forms/:formType/:id" element={<ResourceForm />} />
```

### State Management

**Zustand Store (`packages/frontend/src/store/appStore.ts`):**

```typescript
interface AppState {
  token: string | null;
  refreshToken: string | null;
  setTokens: (token: string, refreshToken: string) => void;
  clearTokens: () => void;
  // Persists to localStorage
}
```

**React Query (Server State):**

- All API calls use React Query hooks
- Automatic caching, deduplication, background refetching
- Invalidation via `queryClient.invalidateQueries({ queryKey })`

**Example Hook:**

```typescript
// packages/frontend/src/api/hooks/useMasterData.ts
export function useRegions() {
  return useQuery({
    queryKey: ['regions'],
    queryFn: () => api.get('/regions').then(r => r.data),
  });
}
```

**Factory Pattern for Master Data:**

```typescript
function createCrudHook(resource: string) {
  return {
    useList: () => useQuery({ queryKey: [resource], ... }),
    useGet: (id) => useQuery({ queryKey: [resource, id], ... }),
    useCreate: () => useMutation({ mutationFn: (data) => api.post(resource, data) }),
    useUpdate: () => useMutation({ mutationFn: ({ id, data }) => api.put(`${resource}/${id}`, data) }),
    useDelete: () => useMutation({ mutationFn: (id) => api.delete(`${resource}/${id}`) }),
  };
}
```

**16 React Query Hook Files:**
- `useAuth.ts` - Login, logout, refresh, forgot password, me
- `useMasterData.ts` - Factory hooks for 15 master data resources
- `useMrrv.ts` - MRRV CRUD + approve/reject
- `useMirv.ts` - MIRV CRUD + approve/issue/cancel
- `useMrv.ts` - MRV CRUD + approve/complete
- `useRfim.ts` - RFIM CRUD + assign/complete
- `useOsd.ts` - OSD CRUD + approve/resolve
- `useJobOrders.ts` - Job Orders CRUD + assign/complete
- `useGatePass.ts` - Gate Pass CRUD + approve/issue
- `useShipment.ts` - Shipment CRUD + customs clearance
- `useInventory.ts` - Inventory queries + adjustments
- `useNotifications.ts` - Notifications list + mark read
- `useDashboard.ts` - KPI queries
- `useTasks.ts` - Task CRUD + assign/complete
- `useDocuments.ts` - Company document library
- `useReports.ts` - Report generation

### Real-Time Synchronization

**File:** `packages/frontend/src/socket/useRealtimeSync.ts` (89 lines)

**Purpose:** Invalidates React Query caches when Socket.IO events are received.

**Mount Location:** `Layout` component (runs once per session)

**Event Handlers:**

```typescript
useEffect(() => {
  const socket = getSocket();

  // Document lifecycle
  socket.on('document:status', ({ documentType }) => {
    queryClient.invalidateQueries({ queryKey: [documentType] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  });

  // Approvals
  socket.on('approval:approved', ({ documentType }) => {
    queryClient.invalidateQueries({ queryKey: [documentType] });
  });

  // Inventory
  socket.on('inventory:updated', () => {
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
  });

  // Generic entity events (catch-all)
  socket.on('entity:created', ({ entity }) => {
    queryClient.invalidateQueries({ queryKey: [entity] });
  });

  // ... etc
}, [queryClient]);
```

**Result:** When any user creates/updates/deletes a resource, all connected clients automatically refetch and update their UI.

### UI Design System

**Design Language:** Glassmorphism with Nesma brand colors

**Colors (Tailwind Config):**

```javascript
colors: {
  nesma: {
    primary: '#0066CC',    // Nesma Blue
    secondary: '#FF9900',  // Nesma Orange
    dark: '#0A1929',       // Dark background
    light: '#F5F7FA',      // Light background
  },
}
```

**Key Components:**

1. **Sidebar** - Collapsible, role-based navigation, responsive (mobile drawer)
2. **Header** - User profile, notifications, logout
3. **KpiCard** - Dashboard metrics with gradient backgrounds
4. **ConfirmDialog** - Reusable confirmation modal (delete, approve, etc.)
5. **SectionLandingPage** - Generic section layout with tabs
6. **SectionTabBar** - Tab navigation for section pages
7. **Toaster** - Global toast notifications (event-emitter pattern)
8. **IdaratechLogo** - SVG logo component

**Responsive Breakpoints:**
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

**Accessibility:**
- Keyboard navigation
- ARIA labels
- Focus states

---

## Shared Package

**Purpose:** Share types, validators, constants, and utilities between backend and frontend.

**File:** `packages/shared/src/index.ts`

```typescript
export * from './types/index.js';
export * from './validators/index.js';
export * from './constants/index.js';
export * from './permissions.js';
export * from './formatters.js';
```

### Types (10 files)

1. **auth.types.ts** - User, Role, LoginRequest, TokenResponse
2. **document.types.ts** - MRRV, MIRV, MRV, RFIM, OSD
3. **inventory.types.ts** - Inventory, InventoryTransaction, Reservation
4. **logistics.types.ts** - JobOrder (7 types), GatePass, StockTransfer, MRF, Shipment
5. **master-data.types.ts** - Region, Warehouse, Project, Employee, Supplier, Item, etc.
6. **approval.types.ts** - ApprovalWorkflow, ApprovalLevel, ApprovalHistory
7. **notification.types.ts** - Notification, NotificationPreferences
8. **system.types.ts** - AuditLog, SystemSettings, DocumentCounter
9. **common.types.ts** - Pagination, ApiResponse, ErrorResponse
10. **task.types.ts** - Task, TaskAssignment, TaskComment

### Validators (Zod Schemas)

All Zod schemas for request/response validation:

- `auth.validator.ts` - loginSchema, registerSchema, forgotPasswordSchema
- `document.validator.ts` - createMrrvSchema, updateMirvSchema, etc.
- `master-data.validator.ts` - createRegionSchema, updateProjectSchema, etc.
- `pagination.validator.ts` - paginationQuerySchema, sortQuerySchema

### Constants

1. **status-flows.ts** - Document status enums and transitions
2. **approval-levels.ts** - Approval thresholds and levels
3. **document-prefixes.ts** - Auto-numbering prefixes (MRRV, MIRV, etc.)
4. **date-formats.ts** - Standard date/time formats
5. **roles.ts** - System role enums

### Permissions

**File:** `packages/shared/src/permissions.ts`

RBAC permission matrix:

```typescript
export const PERMISSIONS: Record<SystemRole, Permission[]> = {
  admin: ['*'],  // Full access
  manager: ['view:*', 'approve:*', 'reports:*'],
  warehouse_supervisor: ['view:inventory', 'create:mrrv', 'approve:mirv', ...],
  // ... etc
};

export function hasPermission(role: SystemRole, permission: Permission): boolean {
  return PERMISSIONS[role].includes('*') || PERMISSIONS[role].includes(permission);
}
```

### Formatters

**File:** `packages/shared/src/formatters.ts`

```typescript
export function formatDate(date: Date | string): string;
export function formatCurrency(amount: number, currency: string): string;
export function formatDocumentNumber(prefix: string, year: number, number: number): string;
export function parseDocumentNumber(docNumber: string): { prefix, year, number };
```

---

## Authentication Flow

**1. Login:**

```
User submits email + password
   │
   ▼
Frontend: POST /api/auth/login { email, password }
   │
   ▼
Backend: Validate credentials with bcrypt
   │
   ▼
Backend: Generate JWT access token (15m) + refresh token (7d)
   │
   ▼
Backend: Return { accessToken, refreshToken, user }
   │
   ▼
Frontend: Store tokens in localStorage
Frontend: Set Zustand state (token, refreshToken)
Frontend: Connect Socket.IO with token
Frontend: Redirect to role-based dashboard
```

**2. Token Refresh (Automatic):**

```
Frontend makes API call
   │
   ▼
Axios interceptor: Attach Authorization header (Bearer {token})
   │
   ▼
Backend: JWT expired? → Return 401
   │
   ▼
Axios interceptor: Catch 401
   │
   ▼
Axios interceptor: POST /api/auth/refresh { refreshToken }
   │
   ▼
Backend: Validate refresh token, generate new access token
   │
   ▼
Frontend: Store new access token
Frontend: Retry original request with new token
```

**3. Logout:**

```
User clicks Logout
   │
   ▼
Frontend: Disconnect Socket.IO
Frontend: Clear localStorage (tokens)
Frontend: Clear Zustand state
Frontend: Clear React Query cache
Frontend: Redirect to login page
```

**4. Session Restore (on page load):**

```
App loads
   │
   ▼
Frontend: Check localStorage for token
   │
   ▼
Frontend: GET /api/auth/me (with token)
   │
   ▼
Backend: Validate token, return user data
   │
   ▼
Frontend: Set Zustand state (user, role)
Frontend: Connect Socket.IO
Frontend: Redirect to role-based dashboard
   │
   ▼
(If token invalid or missing)
Frontend: Clear tokens, show login page
```

---

## Data Flow

**Typical Create/Update Flow:**

```
User submits form
   │
   ▼
Frontend: React Hook Form validation
   │
   ▼
Frontend: useMutation hook (React Query)
   │
   ▼
Frontend: POST /api/resource (Axios + JWT auth)
   │
   ▼
Backend: authenticate() middleware → verify JWT
   │
   ▼
Backend: requireRole() middleware → check RBAC
   │
   ▼
Backend: validate() middleware → Zod schema validation
   │
   ▼
Backend: Controller logic → Prisma create/update
   │
   ▼
Backend: createAuditLog() → log change
   │
   ▼
Backend: emitToAll(io, 'entity:created', { entity, id }) → Socket.IO
   │
   ▼
Backend: Return JSON response { success, data }
   │
   ▼
Frontend: React Query caches response
Frontend: Show success toast
   │
   ▼
All connected clients: useRealtimeSync hook receives Socket.IO event
All connected clients: queryClient.invalidateQueries({ queryKey: [entity] })
All connected clients: React Query refetches data
All connected clients: UI updates with fresh data
```

**FIFO Inventory Deduction Flow:**

```
User issues MIRV (Material Issue Report Voucher)
   │
   ▼
Frontend: POST /api/mirv { items: [{ itemId, quantity }], ... }
   │
   ▼
Backend: MIRV created with status 'PENDING'
Backend: Socket.IO emits 'entity:created'
   │
   ▼
User or approver approves MIRV (5-level approval workflow)
   │
   ▼
Frontend: POST /api/mirv/:id/approve { level }
   │
   ▼
Backend: Update MIRV status to 'APPROVED'
Backend: Reserve inventory (inventoryService.reserve(itemId, qty))
Backend: Socket.IO emits 'document:status', 'approval:approved'
   │
   ▼
User marks MIRV as 'ISSUED'
   │
   ▼
Frontend: POST /api/mirv/:id/issue
   │
   ▼
Backend: Update MIRV status to 'ISSUED'
Backend: Deduct inventory FIFO (inventoryService.deductFIFO(itemId, qty))
Backend: Create inventory transactions
Backend: Socket.IO emits 'inventory:updated'
   │
   ▼
All clients: Inventory dashboard refetches, shows updated quantities
```

---

## Real-Time Synchronization

**Architecture:**

```
┌─────────────┐          ┌─────────────┐          ┌─────────────┐
│  Client A   │          │   Backend   │          │  Client B   │
│  (Browser)  │          │  Socket.IO  │          │  (Browser)  │
└─────────────┘          └─────────────┘          └─────────────┘
       │                        │                        │
       │  1. Connect (JWT)      │                        │
       ├───────────────────────>│                        │
       │  2. Join rooms         │                        │
       │     (user:A, role:X)   │                        │
       │<───────────────────────┤                        │
       │                        │  1. Connect (JWT)      │
       │                        │<───────────────────────┤
       │                        │  2. Join rooms         │
       │                        │     (user:B, role:Y)   │
       │                        ├───────────────────────>│
       │                        │                        │
       │  3. POST /api/regions  │                        │
       ├───────────────────────>│                        │
       │  4. Prisma create      │                        │
       │  5. emitToAll()        │                        │
       │     'entity:created'   │                        │
       │<───────────────────────┤───────────────────────>│
       │                        │                        │
       │  6. useRealtimeSync    │  6. useRealtimeSync    │
       │     invalidates cache  │     invalidates cache  │
       │  7. React Query        │  7. React Query        │
       │     refetches          │     refetches          │
       │  8. UI updates         │  8. UI updates         │
```

**Room Strategy:**

- `user:{userId}` - Personal notifications
- `role:{systemRole}` - Role-specific broadcasts
- `document:{docType}:{docId}` - Document-specific updates

**Frontend Integration:**

```typescript
// Mount once in Layout component
useRealtimeSync();

// Automatically handles all Socket.IO events:
// - document:status → invalidate documentType + dashboard
// - entity:created/updated/deleted → invalidate entity
// - approval:* → invalidate documentType
// - inventory:updated → invalidate inventory
// - task:* → invalidate tasks
// - notification:new → invalidate notifications
```

**Backend Emission:**

```typescript
// After any CRUD operation
const io = req.app.get('io');
emitToAll(io, 'entity:created', { entity: 'regions', id: newRegion.id });

// After approval
emitToRoom(io, `role:warehouse_supervisor`, 'approval:requested', {
  documentType: 'mirv',
  documentId: mirv.id,
  level: 2,
});
```

---

## Database Schema

**Prisma Schema Stats:**
- **Models:** 55
- **Lines:** 1599
- **Primary Keys:** UUID
- **Relations:** 120+ foreign keys

**Key Design Decisions:**

1. **UUID Primary Keys:** Better for distributed systems, prevents enumeration attacks
2. **Timestamps:** All models have `createdAt`, `updatedAt`
3. **Soft Deletes:** `deletedAt` field for audit trail (not implemented on all models)
4. **Enums:** Status fields use Prisma enums (mapped to PostgreSQL enums)
5. **Cascades:** `onDelete: Cascade` for owned relations, `SetNull` for references
6. **Indexes:** On foreign keys, search fields, status fields
7. **Constraints:** CHECK constraints for quantity >= 0, status transitions

**Example Model:**

```prisma
model MRRV {
  id                String   @id @default(uuid()) @db.Uuid
  mrrvNumber        String   @unique @map("mrrv_number") @db.VarChar(50)
  warehouseId       String   @map("warehouse_id") @db.Uuid
  warehouse         Warehouse @relation(fields: [warehouseId], references: [id])
  receivedDate      DateTime @map("received_date") @db.Date
  status            MRRVStatus @default(PENDING)
  items             MRRVItem[]
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  @@map("mrrv")
}

enum MRRVStatus {
  PENDING
  APPROVED
  RECEIVED
  CANCELLED
}
```

---

## API Design

### RESTful Conventions

- **Resources:** Plural nouns (`/api/regions`, `/api/mrrv`)
- **Methods:** GET (list/get), POST (create), PUT (update), DELETE (delete)
- **Status Codes:**
  - 200 OK (success)
  - 201 Created (resource created)
  - 204 No Content (delete success)
  - 400 Bad Request (validation error)
  - 401 Unauthorized (missing/invalid token)
  - 403 Forbidden (insufficient permissions)
  - 404 Not Found (resource not found)
  - 500 Internal Server Error (server error)

### Response Format

**Success:**

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

**Error:**

```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ]
  }
}
```

### Pagination

All list endpoints support pagination:

```
GET /api/regions?page=1&limit=20&search=riyadh&sortBy=regionName&order=asc
```

**Query Params:**
- `page` (default: 1)
- `limit` (default: 20, max: 100)
- `search` (full-text search across config.searchFields)
- `sortBy` (field name)
- `order` (asc/desc)

### Authentication

All protected endpoints require JWT:

```
Authorization: Bearer <access_token>
```

**Token Refresh:**

```
POST /api/auth/refresh
{ "refreshToken": "..." }

Response:
{ "success": true, "data": { "accessToken": "...", "expiresIn": 900 } }
```

---

## Security

### Authentication & Authorization

- **JWT:** Access tokens expire in 15 minutes, refresh tokens in 7 days
- **Password Hashing:** bcryptjs with 10 salt rounds
- **RBAC:** 8 roles with granular permissions (see `packages/shared/src/permissions.ts`)
- **Middleware Chain:** authenticate() → requireRole() → validate() → controller

### Input Validation

- **Zod:** All request bodies, query params, and route params validated
- **SQL Injection:** Prevented by Prisma ORM (parameterized queries)
- **XSS:** Prevented by React (automatic escaping)

### Security Headers

**Helmet:** Sets secure HTTP headers:
- Content-Security-Policy
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block

### CORS

**Configuration:** `packages/backend/src/config/cors.ts`

```typescript
{
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}
```

### Rate Limiting

**Default:** 200 requests per minute per IP (in-memory)

**Production:** Use Redis-backed rate limiter for multi-instance deployments.

### File Upload

**Multer Configuration:**
- Max file size: 10MB
- Storage: Local disk (`packages/backend/uploads/`)
- File name: UUID + original extension
- Validation: File type whitelist (images, PDFs)

**Production:** Use S3/GCS for file storage.

### Environment Variables

**Never commit `.env` files to version control.**

**Production Secrets:**
- Generate strong JWT secrets (`openssl rand -base64 32`)
- Use managed secrets (Render Secrets, AWS Secrets Manager)
- Rotate secrets regularly

### Audit Logging

All write operations logged to `audit_log` table:

```typescript
createAuditLog({
  tableName: 'regions',
  action: 'CREATE',
  recordId: region.id,
  userId: req.user.id,
  changes: { regionName: 'Riyadh', ... },
  ipAddress: clientIp(req),
});
```

**Retention:** Audit logs retained indefinitely for compliance.

---

## Summary

The NIT Supply Chain System is a modern, secure, and scalable full-stack application built with:

- **Backend:** Express 5, Prisma, PostgreSQL, Socket.IO, JWT
- **Frontend:** React 19, React Query, Zustand, Tailwind, Socket.IO
- **Shared:** TypeScript types, Zod validators, constants, RBAC permissions

**Key Architectural Patterns:**
- Monorepo with shared types
- CRUD factory for rapid master data API development
- Real-time synchronization via Socket.IO + React Query invalidation
- Code-splitting for optimized bundle sizes
- RBAC with granular permissions
- FIFO inventory accounting
- Multi-level approval workflows
- Audit logging for compliance

**Production-Ready Features:**
- JWT authentication with auto-refresh
- Role-based access control
- Rate limiting and security headers
- Zod validation at all layers
- Error handling and logging
- Health checks for monitoring
- Docker support for easy deployment
- Render.com one-click deployment

For deployment instructions, see `docs/DEPLOYMENT.md`.
