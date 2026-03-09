# Professional UI Restructure — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the V2 frontend from a functional but flat UI into an enterprise-grade experience — reorganized sidebar, reports hub, multi-step forms, admin settings hub, mobile-optimized layouts, and full PWA install experience.

**Architecture:** Incremental enhancement of existing components. Sidebar gets 2-level collapsible navigation. Reports get a central hub page. Large forms become multi-step wizards. Admin gets a settings hub for all dynamic features. Mobile gets card-based line items. PWA gets iOS splash screens.

**Tech Stack:** React 19, Tailwind CSS 3.4, Lucide React icons, Framer Motion (animations), existing Nesma dark glassmorphism theme.

---

## Phase A: Sidebar Restructure (Collapsible 2-Level Navigation)

### Task A1: Refactor navigation.ts — Add hierarchy metadata
**Files:**
- Modify: `packages/frontend/src/config/navigation.ts`

Convert flat `NavSection` items into collapsible groups with `children` support:
- Each section becomes a collapsible group with icon + label + chevron
- Sub-items are hidden by default, expand on click
- Active section auto-expands
- Persist expanded state in localStorage
- Add `badge` count support per group (e.g., "Pending Approvals (3)")

### Task A2: Rebuild Sidebar component — Collapsible groups
**Files:**
- Modify: `packages/frontend/src/components/Sidebar.tsx`

- Replace flat list with animated collapsible sections (CSS transitions)
- Add chevron rotation on expand/collapse
- Auto-expand section containing active route
- Smooth height animation on expand/collapse
- Add search/filter for sidebar items (existing search bar)
- Pinned favorites section at top (stored in localStorage)

### Task A3: Add sidebar configuration API — Dynamic ordering
**Files:**
- Modify: `packages/frontend/src/components/Sidebar.tsx`
- Use existing backend dynamic navigation support

- Admin can reorder sidebar sections via drag-and-drop in settings
- Changes persist via backend API (already supported)
- Fallback to static config if API unavailable

### Task A4: Mobile bottom tab bar — Smart 5-tab layout
**Files:**
- Modify: `packages/frontend/src/components/MobileTabBar.tsx`

- Redesign to show 5 contextual tabs (Dashboard, Operations, Inventory, Reports, More)
- "More" opens full sidebar as bottom sheet (not overlay)
- Active tab has filled icon + label, inactive has outline icon only
- Haptic-style press animation

---

## Phase B: Reports & Dashboard Hub

### Task B1: Create ReportsHub page — Central reports entry
**Files:**
- Create: `packages/frontend/src/pages/ReportsHubPage.tsx`

- Grid of report category cards (Inventory, Operations, Financial, Logistics, Quality, Equipment)
- Each card shows: icon, title, description, count of available reports
- Quick access: Recent reports, Favorites, Scheduled reports
- Search bar to filter across all reports
- "Create Report" button linking to Report Builder

### Task B2: Create DashboardsHub page — Central dashboards entry
**Files:**
- Create: `packages/frontend/src/pages/DashboardsHubPage.tsx`

- Grid of available dashboards with preview thumbnails
- Categories: Operations, KPIs, Financial, Warehouse, Custom
- "Create Dashboard" button linking to Dashboard Builder
- Pin/favorite dashboards

### Task B3: Improve KpiCard — Drill-down + mini sparkline
**Files:**
- Modify: `packages/frontend/src/components/KpiCard.tsx`

- Add mini sparkline chart (7-day trend) inside card
- Click opens drill-down modal with full chart + data table
- Subtle entrance animation on mount
- Responsive: stack on mobile, side-by-side on desktop

### Task B4: Improve ChartWidget — Better tooltips + interactions
**Files:**
- Modify: `packages/frontend/src/components/dashboard-builder/ChartWidget.tsx`

- Rich tooltips with formatted values + comparison to previous period
- Click-to-zoom on chart segments
- Export chart as PNG button
- Auto-refresh indicator (pulsing dot when data refreshes)

---

## Phase C: Form Wizard System (Multi-Step Forms)

### Task C1: Create FormWizard component — Step-based form container
**Files:**
- Create: `packages/frontend/src/components/forms/FormWizard.tsx`

- Horizontal step indicator (numbered circles connected by lines)
- Current step highlighted in cyan, completed in green with checkmark
- Animated slide transition between steps
- "Previous" / "Next" / "Submit" buttons
- Per-step validation before advancing
- Progress percentage display
- Mobile: vertical step indicator on side

### Task C2: Create FormSection component — Collapsible card sections
**Files:**
- Create: `packages/frontend/src/components/forms/FormSection.tsx`

- Glass card with title bar + collapse/expand toggle
- Optional icon + description
- Validation status indicator (green check / red warning)
- Smooth height animation on toggle

### Task C3: Migrate GRN form to wizard — 3 steps
**Files:**
- Modify: `packages/frontend/src/pages/forms/configs/inbound.ts`

Step 1: Header Info (supplier, PO, dates, warehouse)
Step 2: Line Items (table with add/scan/import)
Step 3: Review & Submit (read-only summary + approval info)

### Task C4: Migrate MI form to wizard — 3 steps
**Files:**
- Modify: `packages/frontend/src/pages/forms/configs/outbound.ts`

Step 1: Request Info (project, warehouse, requester, priority)
Step 2: Materials (line items with stock availability)
Step 3: Review & Submit (total value, approval level, summary)

### Task C5: Migrate JO form to wizard — 4 steps
**Files:**
- Modify: `packages/frontend/src/pages/forms/configs/job-orders.ts`

Step 1: JO Type Selection (visual card selector)
Step 2: Type-Specific Details (dynamic fields based on type)
Step 3: Budget & Materials (cost breakdown + line items)
Step 4: Review & Submit (full summary + approval chain preview)

### Task C6: Mobile line items — Card layout instead of table
**Files:**
- Modify: `packages/frontend/src/components/LineItemsTable.tsx`

- Detect mobile viewport (< 768px)
- Render each line item as a card instead of table row
- Card shows: item name, qty input, unit price, total
- Swipe left to delete
- "Add Item" as full-width button at bottom
- Barcode scanner button prominent at top

---

## Phase D: Admin Settings Hub

### Task D1: Create AdminSettingsHub page — Central admin config
**Files:**
- Create: `packages/frontend/src/pages/admin/AdminSettingsHub.tsx`

- Grid of settings categories:
  - Navigation & Layout (sidebar ordering, menu visibility)
  - Custom Fields (manage field definitions per entity)
  - Dynamic Document Types (create/edit custom document types)
  - Workflow & Approvals (workflow builder, approval chains)
  - Notifications (configure N-01 to N-14 rules)
  - System (email, branding, SLA thresholds)
- Each card links to dedicated settings page
- Search across all settings

### Task D2: Navigation Settings page — Sidebar customization
**Files:**
- Create: `packages/frontend/src/pages/admin/NavigationSettingsPage.tsx`

- Drag-and-drop reorder of sidebar sections
- Toggle visibility of sections per role
- Add/remove individual menu items
- Preview sidebar layout before saving
- Reset to defaults button

### Task D3: Custom Fields management page — Field CRUD
**Files:**
- Verify/enhance: `packages/frontend/src/pages/admin/CustomFieldsPage.tsx`

- List all custom field definitions grouped by entity type
- Create new field: type selector, validation rules, options
- Edit existing fields
- Delete with confirmation
- Preview field rendering

### Task D4: Dynamic Document Types management — Type CRUD
**Files:**
- Verify/enhance: `packages/frontend/src/pages/admin/DynamicTypeBuilderPage.tsx`

- List all dynamic document types
- Create new type: name, code, status flow editor, field definitions
- Visual status flow editor (nodes + arrows)
- Permission configuration per role
- Preview document form

---

## Phase E: PWA & Mobile Polish

### Task E1: iOS splash screens — All device sizes
**Files:**
- Modify: `packages/frontend/index.html`
- Create: splash screen images in `packages/frontend/public/splash/`

- Generate splash screens for all iOS devices (use pwa-asset-generator or manual)
- Add apple-touch-startup-image link tags
- Add media queries for each device size

### Task E2: Improved install prompt — Contextual timing
**Files:**
- Modify: `packages/frontend/src/components/PwaInstallPrompt.tsx`

- Show after 3rd visit (not immediately)
- Different messaging for iOS vs Android
- Full-screen onboarding on first install
- App icon preview in prompt

### Task E3: Mobile-optimized dashboard cards
**Files:**
- Modify dashboard pages for mobile-first responsive design

- KPI cards: 1 column on mobile, swipeable horizontal scroll option
- Charts: full-width on mobile with pinch-to-zoom
- Tables: horizontal scroll with frozen first column

---

## Phase F: Cleanup & Verification

### Task F1: Remove unused old components
- Scan for components no longer imported after restructure
- Remove dead CSS classes
- Clean up unused route definitions

### Task F2: Full test suite verification
- Run all 5,212 tests
- Fix any broken tests from component changes
- Add tests for new components (FormWizard, ReportsHub, etc.)

### Task F3: Build verification + commit
- pnpm build all 3 packages
- Commit each phase separately with clear messages
