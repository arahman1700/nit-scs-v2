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
