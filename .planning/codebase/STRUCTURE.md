# Codebase Structure

**Analysis Date:** 2026-03-22

## Directory Layout

```
/Users/a.rahman/Projects/V2/
├── .env                              # Environment variables (not in git)
├── .env.example                      # Template for .env
├── CLAUDE.md                         # Project conventions (checked in)
├── DEPLOYMENT_CHECKLIST.md           # Production deployment guide
├── package.json                      # pnpm workspace root
├── packages/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── index.ts              # Express app entry point
│   │   │   ├── domains/              # 19 domain-organized services
│   │   │   ├── middleware/           # Auth, RBAC, error, rate-limit, validation
│   │   │   ├── routes/               # Route aggregation + Swagger setup
│   │   │   ├── config/               # Environment, logger, Sentry, Redis, CORS
│   │   │   ├── infrastructure/       # Prometheus metrics, queue dashboard
│   │   │   ├── events/               # Event bus, rule engine, notifications
│   │   │   ├── socket/               # Socket.IO setup + handlers
│   │   │   ├── schemas/              # Zod validation schemas
│   │   │   ├── types/                # TypeScript type definitions
│   │   │   ├── utils/                # Helpers: document-factory, Prisma, JWT, etc.
│   │   │   └── test-utils/           # Factories, mocks for testing
│   │   ├── prisma/
│   │   │   ├── schema/               # 17 domain-organized .prisma files
│   │   │   ├── migrations/           # Prisma migration history
│   │   │   ├── seed.ts               # Main seed script
│   │   │   ├── seed-demo.ts          # Realistic demo data
│   │   │   └── seed-semantic-layer.ts# Reporting widget templates
│   │   ├── package.json              # Backend dependencies
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── App.tsx               # Root component (BrowserRouter + AuthGuard)
│   │   │   ├── main.tsx              # Vite entry point
│   │   │   ├── domains/              # Domain-organized pages + hooks
│   │   │   │   ├── auth/             # Login, security, permissions hooks
│   │   │   │   ├── master-data/      # Item, supplier, warehouse hooks
│   │   │   │   ├── inbound/          # GRN, QCI, DR hooks
│   │   │   │   ├── outbound/         # MI, MRN, MR hooks
│   │   │   │   ├── inventory/        # Bin cards, cycle counts
│   │   │   │   ├── warehouse-ops/    # Put-away, zones, slotting
│   │   │   │   ├── logistics/        # Shipments, gate passes
│   │   │   │   ├── reporting/        # Dashboards, reports, KPIs
│   │   │   │   ├── system/           # Settings, custom fields, bulk ops
│   │   │   │   └── [other domains]   # compliance, equipment, workflow, etc.
│   │   │   ├── pages/
│   │   │   │   ├── dashboards/       # Role-specific KPI dashboards
│   │   │   │   ├── sections/         # SectionLandingPage-based hub pages
│   │   │   │   ├── forms/            # Document forms (GRN form, MI form, etc.)
│   │   │   │   ├── dynamic/          # Generic list/form pages
│   │   │   │   ├── warehouse/        # Warehouse operations UI
│   │   │   │   ├── logistics/        # Shipping + transport pages
│   │   │   │   ├── quality/          # QCI + inspection pages
│   │   │   │   └── transport/        # Job orders, routes, kanban
│   │   │   ├── components/           # Reusable UI building blocks
│   │   │   │   ├── KpiCard.tsx       # KPI metric card
│   │   │   │   ├── StatusBadge.tsx   # Status indicator
│   │   │   │   ├── SectionLandingPage.tsx # Hub page container
│   │   │   │   ├── DocumentListPanel.tsx  # Table + filters
│   │   │   │   ├── LineItemsTable.tsx     # Line item editor
│   │   │   │   ├── dashboard-builder/     # Drag-drop dashboard designer
│   │   │   │   ├── report-builder/        # Report configuration UI
│   │   │   │   ├── smart-grid/            # Data grid with sorting/filtering
│   │   │   │   ├── workflow-builder/      # Approval workflow designer
│   │   │   │   ├── dynamic-form/          # Generic form renderer
│   │   │   │   ├── ai/                    # AI chat components
│   │   │   │   └── [other comps]
│   │   │   ├── api/
│   │   │   │   ├── client.ts          # Axios instance with JWT + token refresh
│   │   │   │   ├── queryClient.ts     # React Query client config
│   │   │   │   └── hooks/index.ts     # Barrel re-export from domains
│   │   │   ├── config/
│   │   │   │   ├── navigation.ts      # Route definitions by role
│   │   │   │   ├── resourceColumns.tsx # Column definitions for data tables
│   │   │   │   └── sentry.ts          # Error reporting config
│   │   │   ├── contexts/
│   │   │   │   ├── DirectionContext.tsx # RTL support (Arabic)
│   │   │   │   └── AuthContext.tsx     # Auth state (legacy)
│   │   │   ├── layouts/
│   │   │   │   └── MainLayout.tsx     # Sidebar + header + role-based nav
│   │   │   ├── hooks/
│   │   │   │   ├── useAutoSave.ts     # Auto-save form to localStorage
│   │   │   │   └── useOfflineQueue.ts # Queue mutations when offline
│   │   │   ├── lib/
│   │   │   │   ├── api-helpers.ts     # Fetch wrappers
│   │   │   │   └── [other utils]
│   │   │   ├── utils/
│   │   │   │   ├── autoNumber.ts      # Auto-increment document numbers
│   │   │   │   ├── pdfExport.ts       # PDF generation
│   │   │   │   ├── type-helpers.ts    # extractRows, mapStatus, etc.
│   │   │   │   └── [other utils]
│   │   │   ├── styles/
│   │   │   │   └── globals.css        # Tailwind + Nesma theme
│   │   │   ├── socket/
│   │   │   │   └── client.ts          # Socket.IO singleton + listeners
│   │   │   ├── store/
│   │   │   │   └── [Zustand stores]   # Client-side state (non-server)
│   │   │   └── test-utils/            # Test fixtures, mocks
│   │   ├── index.html                 # Vite entry HTML
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── shared/
│       ├── src/
│       │   ├── index.ts               # Barrel export
│       │   ├── types/
│       │   │   ├── index.ts           # Main export
│       │   │   ├── enums.ts           # UserRole, DocumentStatus, etc.
│       │   │   ├── common.ts          # Generic types (ApiResponse, Pagination)
│       │   │   ├── materials.ts       # Item, UOM, category types
│       │   │   ├── system.ts          # User, Permission, CustomField types
│       │   │   └── [other domains]    # inbound, outbound, inventory, etc.
│       │   ├── validators/
│       │   │   └── [Zod schemas]      # Re-exported from backend for client
│       │   ├── permissions.ts         # RBAC matrix: {role, resource, action}
│       │   ├── errors.ts              # AppError, NotFoundError, etc.
│       │   ├── formatters.ts          # Format status, role, timestamps
│       │   ├── constants/
│       │   │   └── [Status, role lists, etc.]
│       │   └── utils/
│       │       └── [Helper functions]
│       ├── package.json
│       └── tsconfig.json
└── .planning/
    └── codebase/                       # GSD analysis documents
        ├── ARCHITECTURE.md             # This file
        ├── STRUCTURE.md                # Directory layout + guidance
        ├── CONVENTIONS.md              # Code style, naming, patterns
        ├── TESTING.md                  # Test structure, examples
        ├── STACK.md                    # Tech versions, dependencies
        ├── INTEGRATIONS.md             # External services
        └── CONCERNS.md                 # Tech debt, bugs, gaps
```

## Directory Purposes

**packages/backend/src/domains/{domain}:**
- Purpose: Self-contained domain with routes, services, types specific to one business area
- Contains: `index.ts` (barrel), `routes/` (HTTP endpoints), `services/` (business logic), `types/`, `hooks/`
- Key files:
  - `index.ts`: Exports `register{Domain}Routes(router)` function
  - `routes/*.routes.ts`: Individual route files created with `createDocumentRouter()`
  - `services/*.service.ts`: CRUD + domain-specific logic
  - `types/dto.ts`: Request/response shapes

**packages/backend/src/middleware:**
- Purpose: Cross-cutting request/response handlers
- Key files:
  - `auth.ts`: JWT validation, token blacklist check, attaches `req.user`
  - `rbac.ts`: Role-based and permission-based access control
  - `pagination.ts`: Parse skip/pageSize, attach to `req.query`
  - `validate.ts`: Zod schema validation middleware
  - `rate-limiter.ts`: Redis-backed request rate limiting
  - `error-handler.ts`: Global error catcher, formats JSON responses
  - `request-logger.ts`: Structured JSON logging
  - `sanitize.ts`: XSS/injection protection

**packages/backend/src/utils:**
- Purpose: Reusable functions shared across routes/services
- Key files:
  - `document-factory.ts`: Factory that generates CRUD routers from config
  - `route-registry.ts`: Smart route mounting to prevent Express shadowing conflicts
  - `scope-filter.ts`: Build WHERE clauses for warehouse/project multi-tenancy
  - `crud-factory.ts`: Legacy CRUD helper (deprecated in favor of document-factory)
  - `jwt.ts`: Sign/verify access tokens, refresh tokens
  - `prisma.ts`: Prisma client singleton
  - `prisma-helpers.ts`: Helper queries (findScoped, getRelated, etc.)
  - `response.ts`: Standardized success/error JSON helpers

**packages/backend/src/events:**
- Purpose: System event bus + listeners for async workflows
- Key files:
  - `event-bus.ts`: In-memory EventEmitter, publish/subscribe, Zod validation
  - `rule-engine.ts`: Listens to events → executes workflow automation rules
  - `chain-notification-handler.ts`: Listens to events → creates notifications
  - `action-handlers.ts`: Domain-specific event handlers (approval, escalation, etc.)

**packages/backend/src/socket:**
- Purpose: Real-time WebSocket communication
- Key files:
  - `setup.ts`: Socket.IO middleware, connection handlers, room management
  - Authentication via JWT
  - Rate limiting per-socket
  - Permission checks before emitting sensitive events

**packages/backend/prisma/schema:**
- Purpose: Database schema split into logical domain files
- Pattern: `NN-{domain}.prisma` (numbers ensure load order)
- Key files:
  - `00-generators.prisma`: ID generation helper
  - `01-reference.prisma`: Enums, user roles
  - `02-master-data.prisma`: Items, suppliers, warehouses, UOMs
  - `03-inbound.prisma`: GRN (mrrv), QCI (rfim), DR (osd), ASN, PO
  - `04-outbound.prisma`: MI (mirv), MRN (mrv), MR (mrf)
  - `05-job-orders.prisma`: JobOrder, labor standards
  - `06-inventory.prisma`: BinCard, cycle counts, expiry
  - `07-logistics.prisma`: Shipment, gate pass, transport order
  - `08-system.prisma`: User, permission, audit log, notification
  - `09-workflow.prisma`: ApprovalRequest, delegation, comments
  - `10-email-dashboard.prisma`: Email templates, dashboards
  - `11-v2-modules.prisma`: Advanced purchasing, supplier eval
  - `12-advanced-ops.prisma`: Customs, tariffs, SLA
  - `13-warehouse-ops.prisma`: Zone, put-away, slotting
  - `14-equipment-compliance.prisma`: Equipment, AMC, rentals
  - `15-sow-modules.prisma`: Service order workflows
  - `16-logistics-enhancement.prisma`: Enhanced shipment tracking

**packages/frontend/src/domains/{domain}/pages:**
- Purpose: Page components for domain-specific workflows
- Example: `inbound/pages/GrnFormPage.tsx`, `inventory/pages/BinCardDashboard.tsx`
- Lazy-loaded and error-wrapped

**packages/frontend/src/domains/{domain}/hooks:**
- Purpose: React Query hooks encapsulating all API calls for a domain
- Pattern: Factory-generated from `createResourceHooks<Type>(path, key)`
- Exported: `useXxxList`, `useXxx` (get), `useCreateXxx`, `useUpdateXxx`, `useDeleteXxx`, action hooks like `useSubmitXxx`
- Example: `packages/frontend/src/domains/inbound/hooks/useGrn.ts`

**packages/frontend/src/components:**
- Purpose: Reusable UI building blocks used across pages
- Key components:
  - `AuthGuard.tsx`: Auth state + routing gate
  - `MainLayout.tsx`: Sidebar + header + role-based nav
  - `SectionLandingPage.tsx`: Hub page container with KPIs, tabs, quick actions
  - `DocumentListPanel.tsx`: Table with sorting, filtering, inline edit
  - `KpiCard.tsx`: Metric display card
  - `StatusBadge.tsx`: Color-coded status indicator
  - `LineItemsTable.tsx`: Editor for document line items
  - Component naming: PascalCase with descriptive suffix (`Modal`, `Form`, `Page`, `Builder`)

**packages/frontend/src/pages:**
- Purpose: Full-page components routed by React Router
- Organization:
  - `sections/`: Hub pages (MaterialSectionPage, InventorySectionPage)
  - `dashboards/`: KPI dashboards (AdminDashboard, ManagerDashboard)
  - `forms/`: Document form pages
  - `dynamic/`: Generic list/form pages (fallback for undefined routes)
  - `warehouse/`, `logistics/`, `quality/`, `transport/`: Feature-specific pages
- Lazy-loaded for code-splitting

**packages/shared/src/types:**
- Purpose: Shared TypeScript types imported by both backend + frontend
- Key files:
  - `enums.ts`: UserRole, DocumentStatus, ApprovalLevel enums (align with Prisma enums)
  - `common.ts`: ApiResponse, Pagination, ErrorResponse structures
  - `system.ts`: User, Permission, CustomField types
  - Domain types: materials, inbound, outbound, inventory, logistics, etc.

**packages/shared/src/permissions.ts:**
- Purpose: RBAC permission matrix
- Structure: `permissions[role][resource] = {create, read, update, delete, approve}`
- Used by: Backend middleware `requirePermission()`, frontend for UI visibility

## Key File Locations

**Entry Points:**
- `packages/backend/src/index.ts`: Express app startup
- `packages/frontend/src/main.tsx`: Vite entry point (renders App.tsx)
- `packages/frontend/src/App.tsx`: Root component (BrowserRouter + AuthGuard)

**Configuration:**
- `packages/backend/src/config/env.ts`: Environment variable validation
- `packages/backend/src/config/logger.ts`: Pino logger setup
- `packages/backend/src/config/sentry.ts`: Error reporting
- `packages/backend/src/config/redis.ts`: Redis connection
- `packages/frontend/src/api/client.ts`: Axios instance + interceptors
- `packages/frontend/src/config/navigation.ts`: Route definitions by role
- `packages/frontend/src/config/sentry.ts`: Sentry client setup

**Core Logic:**
- `packages/backend/src/utils/document-factory.ts`: CRUD route generator
- `packages/backend/src/utils/route-registry.ts`: Smart route mounting
- `packages/backend/src/events/event-bus.ts`: System event bus
- `packages/frontend/src/api/queryClient.ts`: React Query configuration
- `packages/frontend/src/socket/client.ts`: Socket.IO singleton

**Testing:**
- `packages/backend/src/test-utils/`: Factories, mocks, helpers
- `packages/frontend/src/test-utils/`: Fixtures, test utilities
- `packages/backend/vitest.config.ts`: Test runner configuration
- `packages/frontend/vitest.config.ts`: Test runner configuration

## Naming Conventions

**Files:**
- Components: PascalCase (KpiCard.tsx, StatusBadge.tsx)
- Pages: PascalCase with Page suffix (MaterialSectionPage.tsx, GrnFormPage.tsx)
- Utilities: camelCase (autoNumber.ts, pdfExport.ts)
- Hooks: camelCase with use prefix (useGrn.ts, useAutoSave.ts)
- Services: camelCase with .service.ts suffix (grn.service.ts, inventory.service.ts)
- Routes: camelCase with .routes.ts suffix (grn.routes.ts, inventory.routes.ts)
- Tests: Same as source file + .test.ts or .spec.ts suffix (grn.routes.test.ts)

**Directories:**
- Domains: kebab-case (master-data, warehouse-ops, job-orders)
- Feature groups: camelCase or kebab-case (pages/sections, pages/dashboards)
- Source subdirs: lowercase (middleware, routes, services, utils, hooks, pages, components)

**TypeScript:**
- Types: PascalCase (User, GrnCreateDto, ApiResponse)
- Enums: PascalCase (UserRole, DocumentStatus)
- Interfaces: PascalCase with optional I prefix (User or IUser)
- Variables: camelCase (userId, grn, isLoading)
- Constants: UPPER_SNAKE_CASE (MAX_ITEMS, API_URL)
- Functions: camelCase (formatStatus, createDocument)

**React/JSX:**
- Component names: PascalCase (KpiCard, SectionLandingPage)
- Component files: PascalCase (KpiCard.tsx, SectionLandingPage.tsx)
- Props interfaces: ComponentNameProps (KpiCardProps)
- Event handlers: camelCase starting with `on` (onClick, onChange)
- Hooks: camelCase starting with `use` (useGrn, useAutoSave)

**API/Routes:**
- REST paths: kebab-case (/api/v1/grn, /api/v1/purchase-orders, /api/v1/bin-cards)
- Query params: camelCase (?pageSize=50, ?sortBy=createdAt)
- Request body keys: camelCase ({lineItems, warehouseId})
- Response keys: camelCase ({success, data, message})

**Database:**
- Tables: camelCase (user, mrrv, mirv, customField)
- Columns: camelCase (userId, createdAt, isActive)
- Enums: UPPER_SNAKE_CASE (DRAFT, PENDING_APPROVAL, APPROVED)

## Where to Add New Code

**New Domain (e.g., "Transport Management"):**

1. Backend domain directory: `packages/backend/src/domains/transport/`
2. Create subdirectories:
   - `routes/`: One .routes.ts file per resource (transport-order.routes.ts)
   - `services/`: One .service.ts file per resource (transport-order.service.ts)
   - `types/`: dto.ts with request/response types
   - `index.ts`: Export `registerTransportRoutes(router)`
3. Create Prisma schema: `packages/backend/prisma/schema/XX-transport.prisma`
4. Create frontend domain: `packages/frontend/src/domains/transport/`
5. Create hooks: `packages/frontend/src/domains/transport/hooks/useTransportOrder.ts`
6. Create pages: `packages/frontend/src/pages/transport/TransportOrderPage.tsx`
7. Register in route aggregator: `packages/backend/src/routes/index.ts` add `registry.register('transport', registerTransportRoutes)`

**New Feature Component:**

1. If reusable across multiple pages → `packages/frontend/src/components/`
2. If page-specific → place in `packages/frontend/src/pages/{domain}/` as `{Feature}Component.tsx`
3. Name with descriptive suffix: `KpiCard.tsx`, `FormBuilder.tsx`, `DataTable.tsx`
4. Export as named export (NOT default)
5. If needed by multiple domains, move to `components/`

**New React Query Hook:**

1. Location: `packages/frontend/src/domains/{domain}/hooks/use{Resource}.ts`
2. Pattern: Use `createResourceHooks<Type>(path, key)` factory
3. Exports: `useXxxList`, `useXxx`, `useCreateXxx`, `useUpdateXxx`, plus any action hooks
4. Re-export from: `packages/frontend/src/api/hooks/index.ts` for backward compat

**New API Endpoint:**

1. Use `createDocumentRouter()` factory if CRUD-like (list, get, create, update, delete, actions)
2. Config file: Define in route file with service functions + Zod schemas
3. Service layer: `packages/backend/src/domains/{domain}/services/{resource}.service.ts`
4. Validation: Zod schema in `packages/backend/src/schemas/document.schema.ts`
5. RBAC: Add permission to `packages/shared/src/permissions.ts`
6. Audit: Automatic via `auditAndEmit()` in document-factory
7. Socket events: Define in ActionConfig → automatic emission

**New Shared Type:**

1. Location: `packages/shared/src/types/{domain}.ts`
2. Export from: `packages/shared/src/types/index.ts`
3. Use: Import in both backend (Prisma schema check) and frontend (TypeScript)
4. Enums: Go in `packages/shared/src/types/enums.ts` if > 1 domain uses them
5. Validators: Backend Zod schemas, shared via Prisma model + TypeScript types

**New Utility Function:**

- Backend: `packages/backend/src/utils/{function-name}.ts`
- Frontend: `packages/frontend/src/utils/{function-name}.ts`
- Shared: `packages/shared/src/utils/{function-name}.ts` if used in both
- Name: camelCase with descriptive purpose (formatStatus.ts, extractRows.ts)

## Special Directories

**packages/backend/prisma/migrations:**
- Purpose: Prisma migration history (auto-generated)
- Generated: `pnpm db:migrate` creates new migrations
- Committed: Yes (version control for schema evolution)
- Manual: Do NOT edit migration files; create new ones with `pnpm prisma migrate dev`

**packages/backend/uploads:**
- Purpose: Local file storage for attachments
- Generated: At runtime when files are uploaded
- Committed: No (in .gitignore)
- Usage: `POST /uploads` endpoint in `domains/uploads/routes/`

**packages/backend/dist:**
- Purpose: Compiled TypeScript output
- Generated: `pnpm build` compiles src/ → dist/
- Committed: No (generated, in .gitignore)
- Production: dist/ files are deployed, not src/

**packages/frontend/dist:**
- Purpose: Built SPA (HTML, JS, CSS bundles)
- Generated: `pnpm build` runs Vite build
- Committed: No (in .gitignore)
- Production: Backend serves static files from here

**packages/frontend/node_modules/.vite:**
- Purpose: Vite dependency pre-bundling cache
- Generated: Auto on first `pnpm dev`
- Committed: No (in .gitignore)

**.planning/codebase:**
- Purpose: GSD codebase analysis documents
- Generated: By orchestrator tool
- Committed: Yes (reference for future work)
- Files: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, STACK.md, INTEGRATIONS.md, CONCERNS.md

---

*Structure analysis: 2026-03-22*
