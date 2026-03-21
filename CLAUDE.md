# NIT Supply Chain V2 — Design System & Project Rules

## Project Overview

Enterprise supply chain management system (monorepo) with dark glassmorphism theme.

- **Monorepo**: pnpm workspace — `packages/frontend`, `packages/backend`, `packages/shared`
- **Stack**: React 19 + Vite 6 + Express 5 + Prisma 6 + TypeScript
- **Styling**: Tailwind CSS 3.4 with custom Nesma dark theme
- **State**: React Query v5 (server), Zustand (client), React Hook Form + Zod (forms)

- **Real-time**: Socket.IO for live updates + React Query cache invalidation

---

## Architecture — Domain-Driven Structure

### 19 Backend Domains

```
packages/backend/src/domains/
├── auth/            # Authentication, permissions, security
├── master-data/     # Items, suppliers, projects, warehouses, UOMs
├── inbound/         # GRN (MRRV), QCI (RFIM), DR (OSD), ASN, inspection
├── outbound/        # MI (MIRV), MRN (MRV), MR (MRF), pick-optimizer, wave
├── inventory/       # Bin cards, cycle counts, surplus, scrap, expiry, ABC
├── warehouse-ops/   # Zones, put-away, slotting, staging, cross-dock, yard
├── transfers/       # WT (stock-transfer), handover, IMSF
├── logistics/       # Shipments, gate passes, transport orders, customs, tariffs
├── job-orders/      # Job orders, labor standards
├── equipment/       # Tools, generators, vehicles, assets, AMC, rentals
├── workflow/        # Approvals, delegation, comments, digital signatures
├── compliance/      # Supplier evaluation, compliance audits, visitors
├── reporting/       # Dashboards, KPIs, reports, analytics, cost allocation
├── notifications/   # Notification routes, push, dispatcher, jobs
├── scheduler/       # Cron scheduler, maintenance & SLA jobs
├── audit/           # Audit log routes and service
├── uploads/         # Attachment and upload routes/services
├── ai-services/     # AI chat, suggestions, schema context
└── system/          # Settings, email, barcode, search, custom fields, bulk ops
```

Each domain has a barrel `index.ts` that exports `registerXxxRoutes(router)`.

### Frontend Domains

```
packages/frontend/src/
├── domains/              # Domain-organized hooks (React Query)
│   ├── auth/hooks/
│   ├── master-data/hooks/
│   ├── inbound/hooks/
│   ├── outbound/hooks/
│   ├── inventory/hooks/
│   ├── warehouse-ops/hooks/
│   ├── transfers/hooks/
│   ├── logistics/hooks/
│   ├── job-orders/hooks/
│   ├── equipment/hooks/
│   ├── workflow/hooks/
│   ├── compliance/hooks/
│   ├── reporting/hooks/
│   └── system/hooks/
├── api/hooks/index.ts    # Re-export barrel (backward compat)
├── components/           # Reusable UI components
│   ├── dashboard-builder/
│   ├── report-builder/
│   ├── smart-grid/
│   └── workflow-builder/
├── pages/
│   ├── dashboards/       # Role-specific dashboards
│   ├── forms/            # Document forms + formConfigs.ts
│   ├── sections/         # SectionLandingPage-based pages
│   ├── warehouse/        # Warehouse feature pages
│   ├── logistics/        # Logistics feature pages
│   ├── quality/          # Quality feature pages
│   └── transport/        # Transport feature pages
├── contexts/             # React contexts (Direction, Auth)
├── hooks/                # Custom hooks (useAutoSave, useOfflineQueue)
├── layouts/              # MainLayout.tsx
├── config/               # navigation.ts, resourceColumns.tsx
├── lib/                  # Utility libraries
├── utils/                # autoNumber.ts, pdfExport.ts
└── styles/               # globals.css
```

### Rules

- IMPORTANT: Place reusable UI components in `src/components/`
- IMPORTANT: Place page components in `src/pages/` organized by feature domain
- Place React Query hooks in `src/domains/{domain}/hooks/` (NOT `src/api/hooks/`)
- Place backend routes and services in `src/domains/{domain}/routes/` and `src/domains/{domain}/services/`
- Place dashboard pages in `src/pages/dashboards/`
- Place section landing pages in `src/pages/sections/`
- Use PascalCase for component files and exports: `KpiCard.tsx`, `StatusBadge.tsx`
- Use descriptive suffixes: `Modal`, `Form`, `Page`, `Layout`, `Builder`, `Provider`
- Export components as named exports, not default (except lazy-loaded pages)

---

## Nesma Dark Theme — Design Tokens

### Color Palette (tailwind.config.ts)

| Token                    | Value                      | Usage                        |
|--------------------------|----------------------------|------------------------------|
| `nesma-dark`             | `#0a1628`                  | Primary background           |
| `nesma-primary`          | `#2E3192`                  | Brand blue, primary actions  |
| `nesma-secondary`        | `#80D1E9`                  | Cyan accent, icons, links    |
| `nesma-accent`           | `#34d399`                  | Success/green states         |
| `nesma-gold`             | `#f59e0b`                  | Warning, highlights          |
| `nesma-surface`          | `rgba(255,255,255,0.05)`   | Card/panel backgrounds       |
| `nesma-border`           | `rgba(255,255,255,0.1)`    | Borders, dividers            |

### Extended Status Colors

| Status     | Color Class      | Usage                    |
|------------|------------------|--------------------------|
| Success    | `emerald-500`    | Approved, completed      |
| Warning    | `amber-500`      | Pending, needs attention |
| Danger     | `red-500`        | Rejected, errors         |
| Info       | `blue-500`       | Informational            |
| Purple     | `purple-500`     | Special states           |

### Opacity Scale (heavily used)

- Backgrounds: `bg-white/5`, `bg-white/10`, `bg-black/20`, `bg-black/60`
- Borders: `border-white/10`, `border-white/20`
- Text: `text-white`, `text-gray-300`, `text-gray-400`

### Rules

- IMPORTANT: Never hardcode hex colors — always use Tailwind token classes (`bg-nesma-primary`, `text-nesma-secondary`, etc.)
- IMPORTANT: Never hardcode `rgba()` values — use the opacity scale (`bg-white/5`, `border-white/10`)
- Use `text-white` for primary text, `text-gray-400` for secondary/muted text, `text-gray-300` for labels
- Use `bg-nesma-dark` for page backgrounds
- Shadow convention: `shadow-lg shadow-nesma-primary/20` for primary glow effects

---

## Glass-Card System

The core visual primitive is the glass-card — glassmorphism with backdrop blur:

```
.glass-card   → bg-white/5, backdrop-blur(12px), border-white/10
.glass-panel  → bg-[rgba(5,16,32,0.95)], backdrop-blur(24px)
.glass        → alias for glass-card
```

### Usage Patterns

```tsx
// Standard card
<div className="glass-card rounded-2xl p-6">

// KPI card with hover
<div className="glass-card rounded-2xl p-4 hover:bg-white/10 transition-all duration-300">

// Sidebar/panel
<aside className="glass-panel h-full">

// Form input
<input className="input-field w-full" />  // or: bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white

// Primary button
<button className="btn-primary">          // or: bg-nesma-primary hover:bg-nesma-primary/80 text-white px-6 py-2.5 rounded-lg
```

### Rules

- IMPORTANT: Always use `glass-card rounded-2xl p-6` for content cards
- Use `rounded-2xl` (16px) for cards, `rounded-xl` (12px) for inner elements, `rounded-lg` (8px) for buttons/inputs, `rounded-full` for pills/avatars
- Standard transitions: `transition-all duration-300`
- Hover states: `hover:bg-white/10`, `hover:scale-[1.02]`
- Loading skeletons: `animate-pulse` with `bg-white/10` placeholder blocks

---

## Typography

### Font Stack

```
Inter + system-ui + sans-serif
```

### Scale

| Element         | Classes                                             |
|-----------------|-----------------------------------------------------|
| Page heading    | `text-2xl font-bold text-white`                     |
| Section heading | `text-lg font-semibold text-white`                  |
| Card title      | `text-sm font-medium text-gray-400`                 |
| KPI value       | `text-3xl font-bold text-white`                     |
| Body text       | `text-sm text-gray-300`                             |
| Muted/secondary | `text-sm text-gray-400`                             |
| Tiny label      | `text-[10px] font-bold text-gray-500 uppercase tracking-widest` |

---

## Spacing & Layout

### Grid Patterns

```tsx
// KPI row (4 columns on desktop)
<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">

// Responsive flex header
<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">

// Content sections
<div className="space-y-6">
```

### Common Spacing

- Card padding: `p-4` (compact) or `p-6` (standard)
- Responsive padding: `p-4 md:p-6`
- Section gaps: `gap-4`, `gap-6`
- Inline spacing: `gap-2`, `gap-3`

---

## Icons

### Library: Lucide React

```tsx
import { Package, ArrowDownCircle, ClipboardCheck, AlertTriangle, Plus, Trash2, Search, Eye } from 'lucide-react';

// Standard usage
<Package size={24} className="text-nesma-secondary" />
<AlertTriangle size={16} className="text-amber-400" />
```

### Rules

- IMPORTANT: Always use `lucide-react` for icons — DO NOT install other icon libraries
- Standard icon sizes: `16` (inline), `20` (buttons), `24` (cards/headers), `32`+ (empty states)
- Icon colors follow the token system: `text-nesma-secondary`, `text-gray-400`, `text-white`

---

## Import Conventions

### Path Alias

```typescript
'@' → packages/frontend/src/
```

### Import Order

```typescript
// 1. React
import React, { useState, useEffect } from 'react';

// 2. Third-party
import { useForm } from 'react-hook-form';

// 3. Shared monorepo types
import type { UserRole, DocumentStatus } from '@nit-scs-v2/shared/types';

// 4. Internal components, hooks, utils
import { KpiCard } from '@/components/KpiCard';
import { useGrn } from '@/domains/inbound/hooks/useGrn';

// 5. Icons (always last)
import { Package, Plus, Search } from 'lucide-react';
```

### Lazy Loading

```typescript
const BarcodeScanner = React.lazy(() => import('@/components/BarcodeScanner'));
// For named exports:
const MaterialSection = React.lazy(() =>
  import('@/pages/sections/MaterialSectionPage').then(m => ({ default: m.MaterialSectionPage }))
);
```

---

## Key Component Patterns

### SectionLandingPage

Reusable section container with KPIs, tabs, and quick actions:

```tsx
<SectionLandingPage
  title="Material Management"
  icon={Package}
  kpis={kpiData}
  tabs={tabDefs}
  quickActions={actions}
>
  {(activeTab) => tabContentMap[activeTab]}
</SectionLandingPage>
```

### React Query Hooks (Factory Pattern)

```typescript
// createResourceHooks generates useList, useOne, useCreate, useUpdate, useRemove
export const { useList: useItems, useCreate: useCreateItem, ... } =
  createResourceHooks<Item>('/master-data/items', 'items');
```

### Form Pattern

```tsx
// useDocumentForm hook + formConfigs.ts
const { form, onSubmit, isLoading } = useDocumentForm({
  formType: 'grn',
  documentId: id,
});
```

### LineItemsTable

```tsx
<LineItemsTable
  items={lineItems}
  onItemsChange={setLineItems}
/>
```

---

## V1 → V2 Naming Map

| V1 Internal  | V2 Display Name | Validator       |
|--------------|-----------------|-----------------|
| MRRV         | GRN             | `validateGRN`   |
| MIRV         | MI              | `validateMI`    |
| MRV          | MRN             | `validateMRN`   |
| RFIM         | QCI             | `validateQCI`   |
| OSD          | DR              | `validateDR`    |
| MRF          | MR              | `validateMR`    |
| StockTransfer| WT              | —               |

V1 Prisma model names are kept internally; V2 names are used at the API boundary and UI.

---

## Accessibility

- Use semantic HTML: `<main>`, `<nav>`, `<section>`, `<header>`
- Add `aria-label` to all icon-only buttons
- Skip navigation link is in MainLayout
- Support keyboard navigation for all interactive elements
- Maintain WCAG AA color contrast (dark theme tokens are pre-validated)

---

## Figma MCP Integration Rules

These rules define how to translate Figma inputs into code for this project.

### Required Flow (do not skip)

1. Run `get_design_context` first to fetch the structured representation for the exact node(s)
2. If the response is too large or truncated, run `get_metadata` to get the high-level node map, then re-fetch only the required node(s) with `get_design_context`
3. Run `get_screenshot` for a visual reference of the node variant being implemented
4. Only after you have both `get_design_context` and `get_screenshot`, download any assets needed and start implementation
5. Translate the output (usually React + Tailwind) into this project's conventions, styles, and framework
6. Validate against Figma for 1:1 look and behavior before marking complete

### Implementation Rules

- Treat Figma MCP output as a representation of design intent, not final code
- Replace generic Tailwind classes with Nesma design tokens (`bg-nesma-primary`, `glass-card`, etc.)
- Reuse existing components from `src/components/` instead of duplicating
- Use the project's color system, typography scale, and spacing tokens consistently
- Respect existing routing, state management, and data-fetch patterns
- Strive for 1:1 visual parity with the Figma design
- Validate the final UI against the Figma screenshot for both look and behavior

### Asset Handling

- IMPORTANT: If the Figma MCP server returns a localhost source for an image or SVG, use that source directly
- IMPORTANT: DO NOT import/add new icon packages — all icons come from `lucide-react`
- IMPORTANT: DO NOT use or create placeholders if a localhost source is provided
- Store downloaded assets in `public/` directory
- Custom SVG logos (NesmaLogo, IdaratechLogo) are in `src/components/`

---

## Common Pitfalls

- Always add new `UserRole` values to `MainLayout.tsx` → `roleBasePaths`
- `Item` type has `name` not `nameEn` — check actual type from `createResourceHooks`
- Mutation `onSuccess` callbacks: let TS infer the param type (don't annotate)
- `getRequiredApprovalLevel()` accepts `'mi' | 'jo' | 'mr'` (NOT `'mirv'`)
- `LineItemsTable` props: `items` + `onItemsChange` (NOT `onChange`)

<!-- GSD:project-start source:PROJECT.md -->
## Project

**NIT Supply Chain V2 — Production Readiness**

Enterprise supply chain management system for NIT (Nesma Information Technology) — a full-stack monorepo handling inbound/outbound logistics, inventory management, warehouse operations, equipment tracking, compliance, and reporting. Currently in development with core functionality working but requiring comprehensive review, bug fixes, performance optimization, and feature completion before production launch.

**Core Value:** The system must reliably track every material movement (in, out, transfer) with accurate inventory levels, proper approvals, and complete audit trails — if inventory data is wrong, nothing else matters.

### Constraints

- **Tech Stack**: Must keep current stack (React 19, Vite 6, Express 5, Prisma 6) — all are modern and appropriate
- **Data Integrity**: All stock operations must be transactional — partial commits are unacceptable
- **Backward Compatibility**: V1 Prisma model names (MRRV, MIRV, etc.) are kept internally; V2 names at API/UI boundary
- **Arabic Support**: RTL layout must work correctly across all pages
- **Security**: Must pass basic security review before production (CORS, rate limiting, input validation)
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript ~5.8.2 - Strict mode enabled; used across all packages (frontend, backend, shared)
- JavaScript (ES2022) - Runtime target for all compiled code
- HTML5 - Frontend markup (Vite-served)
- CSS 3.4 - Tailwind CSS framework with custom theme extensions
- SQL - PostgreSQL queries via Prisma ORM (no raw SQL except through Prisma.sql tagged templates)
## Runtime
- Node.js >=20.0.0 (Alpine 20 in Docker)
- Browser: Modern ES2022 support required
- pnpm >=9.0.0
- Lockfile: `pnpm-lock.yaml` (present, frozen lockfile enforced in CI)
## Frameworks
- Express 5.1.0 - HTTP server, routing, middleware
- Prisma 6.5.0 - ORM with database schema management (PostgreSQL)
- React 19.2.4 - UI framework
- Vite 6.2.0 - Build tool and dev server
- React Router DOM 7.13.0 - Client-side routing
- Zustand 5.0.11 - Client state (frontend)
- React Query (TanStack) 5.65.0 - Server state and async data fetching (frontend)
- React Hook Form 7.71.1 - Form state and validation
- Socket.IO 4.8.0 (server and client) - WebSocket-based live updates and notifications
- Vitest 4.0.18 - Unit/integration tests (backend and frontend)
- Playwright 1.52.0 - E2E testing (frontend only)
- MSW (Mock Service Worker) 2.12.9 - API mocking for tests
- Testing Library (@testing-library/react) 16.3.2 - React component testing
- TypeScript Compiler 5.8.2 - Type checking and compilation
- Tailwind CSS 3.4.17 - Utility-first CSS framework with RTL support
- Autoprefixer 10.4.20 - CSS vendor prefix generation
- PostCSS 8.5.0 - CSS transformation pipeline
- Vite PWA Plugin 1.2.0 - Progressive Web App support with Workbox
## Key Dependencies
- `@prisma/client` 6.5.0 - Database abstraction and query builder
- `bcryptjs` 3.0.2 - Password hashing and verification
- `jsonwebtoken` 9.0.2 - JWT token generation/verification (15m access, 7d refresh)
- `ioredis` 5.9.2 - Redis client for caching, rate limiting, token blacklisting
- `express` 5.1.0 - HTTP server framework
- `zod` 3.24.0 - Schema validation for environment variables and request/response payloads
- `@tanstack/react-query` 5.65.0 - Server state management and automatic cache invalidation
- `react-hook-form` 7.71.1 - Efficient form handling with Zod validation
- `zustand` 5.0.11 - Lightweight client state (direction, auth context)
- `axios` 1.13.5 - HTTP client for API requests
- `socket.io-client` 4.8.0 - Real-time data sync and push notifications
- `react-router-dom` 7.13.0 - Client-side routing
- `bullmq` 5.71.0 - Job queue system (scheduled tasks, SLA checks, notifications)
- `@bull-board/api` and `@bull-board/express` 6.20.5 - Job queue dashboard UI
- `helmet` 8.1.0 - HTTP security headers
- `cors` 2.8.5 - Cross-Origin Resource Sharing (CORS_ORIGIN from env)
- `compression` 1.8.0 - Gzip compression middleware
- `morgan` 1.10.0 - HTTP request logging
- `cookie-parser` 1.4.7 - Cookie parsing and handling
- `dotenv` 16.5.0 - Environment variable loading
- `@sentry/node` 10.38.0 (optional) - Error tracking and APM; requires SENTRY_DSN env var
- `pino` 10.3.0 - Structured JSON logging
- `pino-pretty` 13.1.3 - Dev-friendly log formatter
- `prom-client` 15.1.3 - Prometheus metrics client
- `resend` 6.9.1 - Email delivery API (optional; requires RESEND_API_KEY)
- `svix` 1.84.1 - Email webhook handling (signature verification via RESEND_WEBHOOK_SECRET)
- `web-push` 3.6.7 - Web Push Notifications API (VAPID keys optional)
- `exceljs` 4.4.0 - Excel file generation and parsing (reports, exports)
- `jspdf` 4.2.0 and `jspdf-autotable` 5.0.7 (frontend) - PDF generation
- `bwip-js` 4.8.0 - Barcode generation (Code128, QR)
- `sanitize-html` 2.14.0 - HTML sanitization to prevent XSS
- `handlebars` 4.7.8 - Email template rendering
- `recharts` 3.7.0 - Chart library for dashboards and reporting
- `lucide-react` 0.563.0 - Icon library (24+ SVG icons)
- `html5-qrcode` 2.3.8 - QR code scanner
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` 6.x - Drag-and-drop system
- `@tanstack/react-table` 8.21.3 - Headless table component
- `@tanstack/react-virtual` 3.13.22 - Virtualization for large lists
- `uuid` 11.1.0 - Unique ID generation
- `multer` 2.1.1 - File upload handling (multipart/form-data)
- `workbox-window` 7.4.0 - Service worker integration
## Configuration
- `.env.example` template provided; actual secrets in `.env` (never committed)
- Environment variables validated with Zod schema in `src/config/env.ts`
- Required vars: DATABASE_URL, JWT_SECRET (32+ chars), JWT_REFRESH_SECRET (32+ chars)
- Optional vars: REDIS_URL, SENTRY_DSN, RESEND_API_KEY, VAPID keys, WEB_PUSH config
- CORS_ORIGIN defaults to `http://localhost:3000` (production needs override)
- TypeScript config: `tsconfig.base.json` + package-specific overrides
- ESLint: `eslint.config.js` (flat config format, v10+)
- Prettier: `.prettierrc` (120 char width, 2-space tabs, trailing commas, single quotes, arrow parens avoided)
- Prisma schema split across 17 files in `packages/backend/prisma/schema/` (0-16 prefixed for load order)
- Database: PostgreSQL 15+ (required; Xano Saudi region in production)
- Connection pooling: Production should append `?connection_limit=20&pool_timeout=10` to DATABASE_URL
- Read-only replica support via optional DATABASE_READ_URL env var
- pnpm workspaces (`pnpm-workspace.yaml`) with 3 packages:
- Shared package has multiple exports for tree-shaking: types, validators, constants, formatters, errors, utils
## Platform Requirements
- Node.js >=20.0.0
- pnpm >=9.0.0
- PostgreSQL 15+ (Docker recommended via docker-compose.yml)
- Redis 7+ (Docker recommended via docker-compose.yml)
- Vite dev server on port 3000
- Express server on port 4000
- Port forwarding for Vite proxy to handle `/api/v1` and `/socket.io` requests
- Deployment target: Render.com (free tier with PostgreSQL database)
- Docker image built from multi-stage Dockerfile (`packages/backend/Dockerfile`)
- Runs as non-root user (nodejs:1001)
- Health check endpoint: `GET /api/health`
- Requires: DATABASE_URL (connection pooling), JWT secrets, REDIS_URL (Upstash for free tier)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- React components: PascalCase (e.g., `KpiCard.tsx`, `ConfirmDialog.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useDashboards.ts`, `useKpis.ts`)
- Utilities/services: camelCase (e.g., `auth.service.ts`, `password.ts`, `response.ts`)
- Test files: Match source with `.test.ts` or `.spec.ts` extension (e.g., `auth.service.test.ts`, `auth.spec.ts`)
- Routes: camelCase with `routes` suffix (e.g., `auth.routes.ts`, `permissions.routes.ts`)
- Directories: kebab-case (e.g., `test-utils/`, `report-builder/`, `smart-grid/`)
- Async function handlers: descriptive verb phrases (e.g., `login()`, `refreshTokens()`, `sendTemplatedEmail()`)
- React component names: PascalCase exported function (e.g., `export const KpiCard: React.FC<KpiCardProps> = ...`)
- Hook functions: `use` prefix in camelCase (e.g., `useDashboards()`, `useKpisByCategory()`)
- Middleware functions: verb-noun pattern (e.g., `authenticate`, `validateRequest`, `rateLimiter`)
- Constants in services: SCREAMING_SNAKE_CASE for module-level constants (e.g., `TOKEN_BLACKLIST_PREFIX`, `REFRESH_COOKIE_NAME`)
- Query keys: camelCase arrays (e.g., `['dashboards']`, `['dashboards', id]`)
- Event handler prefixes: `handle` (e.g., `handleClick`, `handleKeyDown`)
- Callback prefixes: `on` (e.g., `onClick`, `onSuccess`, `onChange`)
- Interfaces: PascalCase prefixed with `I` OR use plain PascalCase without prefix (both used, prefer no `I` prefix in codebase)
- Type aliases: PascalCase (e.g., `LoginResult`, `JwtPayload`, `TestTokenPayload`)
- Props interfaces: ComponentNameProps pattern (e.g., `KpiCardProps`)
- Enums: PascalCase singular (used minimally, prefer unions/literals)
## Code Style
- Tool: Prettier 3.8.1
- Print width: 120 characters
- Tab width: 2 spaces
- Trailing commas: all (ES5 compatible)
- Single quotes: true
- Semicolons: true
- Arrow parens: avoid (e.g., `x => x * 2` not `(x) => x * 2`)
- End of line: LF
- Tool: ESLint 10.0 with TypeScript ESLint
- Mode: Flat config (eslint.config.js)
- Base: JS recommended + TypeScript recommended + prettier override
- `@typescript-eslint/no-unused-vars`: Warn, except underscore-prefixed variables ignored (e.g., `_unused`)
- `@typescript-eslint/no-explicit-any`: Warn (strict typing enforced)
- `prefer-const`: Error (const over let when possible)
- `no-var`: Error (use const/let only)
- `no-console`: Warn, but allow `console.warn`, `console.error`, `console.info`
- SQL safety: `$queryRawUnsafe` and `$executeRawUnsafe` forbidden (use tagged template instead)
- `@typescript-eslint/no-explicit-any`: Off
- `@typescript-eslint/no-unused-vars`: Off
- `no-console`: Off (for seed/scripts)
## Import Organization
- Frontend: `@` → `packages/frontend/src/`
- Backend: None (uses relative imports and Node ES modules)
- Imports use tsconfig paths and Vite resolution
- Components: Named exports (except lazy-loaded pages use default)
- Hooks: Named exports
- Services: Named exports (for testability)
- Utilities: Named exports
## Error Handling
- Base: `AppError` - extends Error with statusCode, code, isOperational
- Specific: `NotFoundError(404)`, `AuthenticationError(401)`, `AuthorizationError(403)`, `ConflictError(409)`, `BusinessRuleError(422)`, `RateLimitError(429)`, `RequestValidationError(400)`
- React Query handles fetch errors and retries
- Error boundaries catch component errors
- Form validation with Zod schemas (in react-hook-form)
- Toast notifications for user-facing errors
- Backend: Structured logging with Pino (structured JSON in prod, pretty-printed in dev)
- Log levels: debug, info, warn, error
- Log pattern: `log('info', 'message', data)` or `logger.info({ data }, 'message')`
- Always include context: request IDs, user IDs, resource IDs
- Do NOT log sensitive data (passwords, tokens)
## Comments
- Complex algorithm explanation (not "obvious" code)
- Non-obvious workarounds or hacks (with WHY, not WHAT)
- Business rule explanations
- Security-critical code (e.g., token validation)
- DO NOT comment self-documenting code
- Function signatures: Optional for public APIs, required for complex services
- Type definitions: Optional (types are documentation)
- Parameters: Include if non-obvious or when using overloads
- Returns: Include if non-obvious
- Examples: Include for utilities/hooks with non-standard usage
## Function Design
- Services: <100 lines per function (break into helpers)
- Hooks: <80 lines per function
- Components: <200 lines (use composition/subcomponents)
- Destructure object parameters when >2 params (e.g., `async ({ email, password }, options?: {})`)
- Use `type X = { ... }` for parameter objects when reused
- Avoid boolean flags for mode changes (use enum/literal union instead)
- Use union types for multiple returns: `Promise<User | null>`
- Throw errors for exceptional cases (don't return null for errors)
- Return structured results from mutations: `{ success: true, data: ... }`
- Use `void` only for event handlers
- Prefer arrow functions for callbacks: `(item) => item.id === id`
- Use `function` keyword for exported service functions (hoisting, stack traces)
## Module Design
- Barrel files use `export { ComponentA } from './ComponentA'` pattern (in `/components/index.ts`)
- Services export named functions, not default
- Hooks export named functions
- Used in: `/src/components/`, `/src/test-utils/`
- Pattern: Re-export public items only
- Frontend: `/api/hooks/index.ts` re-exports from `domains/{domain}/hooks/` (backward compat)
- Location: `src/domains/{domain}/services/`
- Naming: `{entity}.service.ts`
- Export: Named functions, not classes
- Pattern: Pure functions that accept dependencies (testable)
- Location: `src/domains/{domain}/routes/`
- Pattern: Express Router with middleware + handler
- Register: Via `registerXxxRoutes(router)` barrel export in `index.ts`
## Component Patterns
- Memoized by default: `export const KpiCard: React.FC<Props> = memo(({ props }) => { ... })`
- Props typing: Always define `interface XyzProps`
- Children typing: Include in props interface
- Event handlers: Wrapped in `useCallback` if passed as props
- Use `react-hook-form` + `Zod` validation
- Validation schemas in `formConfigs.ts` per domain
- Pattern: `const { form, onSubmit, isLoading } = useDocumentForm({ formType: 'grn', documentId: id })`
- Server state: React Query (queries + mutations)
- UI state: React hooks (useState) or Zustand
- URL state: React Router (useSearchParams)
- Context: Minimal (Direction, Auth)
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- 19 domain-organized backend services (auth, master-data, inbound, outbound, inventory, etc.)
- React 19 + Vite frontend with domain-organized hooks and pages
- Shared TypeScript types and validators across packages
- Document-centric patterns with status transitions and audit trails
- Real-time updates via Socket.IO + React Query cache invalidation
- RBAC with resource-based permissions stored in database
- Row-level scoping (warehouse/project) for multi-tenant operations
## Layers
- Purpose: REST API + WebSocket server serving React frontend
- Location: `/Users/a.rahman/Projects/V2/packages/backend/src`
- Contains: 19 domains with routes/services, middleware, utilities, events, Socket.IO setup
- Depends on: Prisma (database), Redis (caching/tokens), Express, Socket.IO
- Used by: Frontend application
- Purpose: React 19 SPA with real-time domain-organized UI
- Location: `/Users/a.rahman/Projects/V2/packages/frontend/src`
- Contains: Pages, components, domain hooks (React Query), contexts, utilities
- Depends on: React Query v5, Zustand, React Hook Form, Zod, Axios, Socket.IO client
- Used by: End users via browser
- Purpose: Type definitions, validators, permissions matrix
- Location: `/Users/a.rahman/Projects/V2/packages/shared/src`
- Contains: TypeScript types, Zod validators, permissions, error classes, constants
- Depends on: Zod, TypeScript
- Used by: Both backend and frontend
## Data Flow
## Key Abstractions
- Purpose: Eliminate CRUD route boilerplate across 19 domains
- Examples: `packages/backend/src/utils/document-factory.ts`
- Pattern: Takes config (service functions, schemas, RBAC roles, action definitions) → returns Express Router with list/get/create/update + status-transition actions
- Handles: Validation, RBAC, pagination, optimistic locking, audit logging, socket emission
- Purpose: Domain events for workflow, rules, notifications
- Examples: `packages/backend/src/events/event-bus.ts`, `rule-engine.ts`
- Pattern: Service emits `SystemEvent` → EventBus publishes to in-memory EventEmitter → listeners (rule engine, notifications) react asynchronously
- Events: `'document:status_changed'`, `'document:created'`, `'approval:requested'`, etc.
- Purpose: Encapsulate API calls + caching per domain
- Examples: `packages/frontend/src/domains/inbound/hooks/useGrn.ts`
- Pattern: Factory pattern using `createResourceHooks<GRN>('/grn', 'grn')` → exports `useGrnList`, `useGrn`, `useCreateGrn`, `useUpdateGrn`, action hooks
- Cache invalidation: Routes invalidate `['grn']` query → all `useGrnList()` instances refetch
- Purpose: Role-based + resource-based access control
- Examples: `packages/backend/src/middleware/rbac.ts`, `packages/shared/src/permissions.ts`
- Pattern: Database permissions table stores {role, resource, action} → middleware checks before route handler runs
- Fallback: Document factory accepts `createRoles: ['admin', 'manager']` for legacy backward-compat
- Purpose: Ensure users only see documents in their warehouse/project
- Examples: `packages/backend/src/utils/scope-filter.ts`
- Pattern: Service layer wraps Prisma queries with `buildScopeFilter()` → adds WHERE clauses filtering by warehouseId/projectId
- Used: In list queries, get-by-ID, updates to prevent unauthorized access
- Purpose: Prevent Express static route shadowing by parameterized routes
- Examples: `packages/backend/src/utils/route-registry.ts`
- Pattern: Lazy domain registration → dry-run each domain on temp router → analyze for conflicts → mount in safe order (static before params)
## Entry Points
- Location: `packages/backend/src/index.ts`
- Triggers: `npm run dev:backend` starts Express server on port 4000
- Responsibilities:
- Location: `packages/frontend/src/App.tsx`
- Triggers: Vite dev server on port 5173 or built SPA at root
- Responsibilities:
- Location: `packages/frontend/src/components/AuthGuard.tsx`
- Triggers: App component render
- Responsibilities:
- Location: `packages/backend/src/domains/{domain}/index.ts`
- Triggers: RouteRegistry in `packages/backend/src/routes/index.ts` calls `register{Domain}Routes(router)`
- Responsibilities: Barrel export that mounts all routes for a domain (e.g., `registerInboundRoutes` mounts `/grn`, `/qci`, `/dr`, `/asn` sub-routers)
## Error Handling
```typescript
```
- Location: `packages/backend/src/middleware/error-handler.ts`
- Catches all errors from route handlers
- For `AppError`: returns `{ success: false, message, code, errors? }`
- For Prisma.PrismaClientKnownRequestError: maps P2002 (duplicate) → 409, P2025 (not found) → 404
- For unknown errors: returns 500 with generic message in production, full error in dev
- Sends to Sentry if statusCode >= 500
- Axios response interceptor catches 401 (expired token) → queues refresh, retries
- Axios response interceptor catches 409 (optimistic locking version conflict) → shows toast, invalidates all queries
- Error boundary component wraps route pages → shows fallback UI on render error
- useMutation `onError` callbacks toast user-friendly messages
## Cross-Cutting Concerns
- Backend: Pino logger in `packages/backend/src/config/logger.ts`
- Structured JSON logs with levels: debug, info, warn, error
- RequestLogger middleware captures method, path, status, duration
- Sensitive headers stripped
- Backend: Zod schemas in `packages/backend/src/schemas/document.schema.ts`
- Document factory validates all requests against schema
- Dynamic validation for custom fields returns 422 with field errors
- Frontend: React Hook Form + Zod for client-side validation
- JWT access tokens (short-lived, in localStorage)
- Refresh tokens (httpOnly cookies, long-lived)
- `authenticate` middleware verifies Bearer token signature
- Redis blacklist checks for token revocation
- Socket.IO middleware validates JWT on connection + re-validates every 5 minutes
- Resource-based RBAC: `requirePermission('resource', 'action')` middleware
- Fallback to role lists for backward-compat: `requireRole(['admin', 'manager'])`
- Socket.IO: document type → resource mapping (e.g., `mrrv` → `grn`) for permission checks
- Scope filtering: row-level access by warehouseId/projectId
- Redis: Token blacklist, rate-limit counters, session data
- React Query: Automatic query caching with stale-time = 0 (always refetch on mount, cache for immediate re-renders)
- HTTP cache headers: `/assets/*` → 1 year immutable, other static → no-cache
- Backend HTTP: 500 requests/minute per client IP (middleware)
- Socket.IO: 30 events/10 seconds per socket
- Shared Redis store for distributed rate-limit counters
- Prometheus metrics: `packages/backend/src/infrastructure/metrics/prometheus.ts`
- Tracks requests by method/path/status, event bus publishes, errors
- `/api/v1/metrics` endpoint (public, no auth)
- Sentry integration: captures exceptions >= 500, sets user context on auth
- Prisma AuditLog model records {resource, resourceId, action, userId, timestamp, changes}
- `auditAndEmit()` utility in every route handler → persists audit log before sending response
- `/audit/logs` endpoint for querying history
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
