# Wave 1: Security, Locking, Shortcuts, CDN — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Wave 1 — wire remaining permission checks, add optimistic locking to document tables, build keyboard shortcuts system, configure CDN support.

**Architecture:** Backend-first changes (permissions + DB migration), then frontend (shortcuts + CDN config). All 4 tasks are independent and can run in parallel.

**Tech Stack:** Express middleware, Prisma migrations, React hooks, Vite config

---

## Task 1: Wire `requirePermission` to Non-Factory Routes

**Context:** All `createDocumentRouter` routes already have `resource` configured. The gap is in custom (non-factory) route files that use `requireRole` directly.

**Files:**
- Audit: `packages/backend/src/domains/*/routes/*.ts` — find all `requireRole` usages and replace with `requirePermission`
- Reference: `packages/shared/src/permissions.ts` — 43 resource names

- [ ] **Step 1: Audit all requireRole usages**

Run: `grep -rn "requireRole" packages/backend/src/domains/ --include="*.ts" -l`

Identify every route file using `requireRole` instead of `requirePermission`. For each file, determine the appropriate resource from `shared/permissions.ts`.

- [ ] **Step 2: Replace requireRole with requirePermission in each file**

For each file found, replace:
```typescript
// Before
router.get('/', authenticate, requireRole('admin', 'manager'), handler);

// After
router.get('/', authenticate, requirePermission('resource_name', 'read'), handler);
```

Map actions: GET → 'read', POST → 'create', PUT/PATCH → 'update', DELETE → 'delete', approve/reject → 'approve'

- [ ] **Step 3: Update document-factory fallback to fail-closed**

In `packages/backend/src/utils/document-factory.ts`, change the rbac fallback (line ~116):
```typescript
// Before
return (_req: Request, _res: Response, next: NextFunction) => next(); // no restriction

// After
return (_req: Request, res: Response) => {
  res.status(403).json({ error: 'No permission resource configured for this route' });
};
```

- [ ] **Step 4: Run existing tests to verify no regressions**

Run: `cd packages/backend && npx vitest run --reporter=verbose 2>&1 | tail -20`

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/domains/ packages/backend/src/utils/document-factory.ts
git commit -m "security: wire requirePermission to all non-factory routes (fail-closed)"
```

---

## Task 2: Optimistic Locking — Phase A (Add Version Columns)

**Files:**
- Modify: `packages/backend/prisma/schema/03-inbound.prisma` — MRRV (line ~5), RFIM (line ~91), OSD (line ~127)
- Modify: `packages/backend/prisma/schema/04-outbound.prisma` — MIRV (line ~2), MRV (line ~89), MaterialRequisition (line ~242), StockTransfer (line ~321)
- Modify: `packages/backend/prisma/schema/05-job-orders.prisma` — JobOrder (line ~5)
- Modify: `packages/backend/src/utils/safe-status-transition.ts`
- Create: new migration

- [ ] **Step 1: Add version field to all 8 Prisma models**

In each model, add before the `createdAt` field:
```prisma
  version   Int      @default(0)
```

Models to update:
- `Mrrv` in `03-inbound.prisma`
- `Rfim` in `03-inbound.prisma`
- `OsdReport` in `03-inbound.prisma`
- `Mirv` in `04-outbound.prisma`
- `Mrv` in `04-outbound.prisma`
- `MaterialRequisition` in `04-outbound.prisma`
- `StockTransfer` in `04-outbound.prisma`
- `JobOrder` in `05-job-orders.prisma`

- [ ] **Step 2: Generate and apply migration**

```bash
cd packages/backend
npx prisma migrate dev --name add_version_to_document_tables
```

- [ ] **Step 3: Create data migration for existing rows**

Add to the generated migration SQL (before the end):
```sql
UPDATE "RCV_RECEIPT_HEADERS" SET version = 0 WHERE version IS NULL;
UPDATE "RCV_INSPECTION_HEADERS" SET version = 0 WHERE version IS NULL;
UPDATE "RCV_DISCREPANCY_HEADERS" SET version = 0 WHERE version IS NULL;
UPDATE "ONT_ISSUE_HEADERS" SET version = 0 WHERE version IS NULL;
UPDATE "ONT_RETURN_HEADERS" SET version = 0 WHERE version IS NULL;
UPDATE "ONT_REQUISITION_HEADERS" SET version = 0 WHERE version IS NULL;
UPDATE "MTL_TRANSFER_HEADERS" SET version = 0 WHERE version IS NULL;
UPDATE "WMS_JOB_ORDERS" SET version = 0 WHERE version IS NULL;
```

- [ ] **Step 4: Update safeStatusUpdate to support version (backward compatible)**

In `packages/backend/src/utils/safe-status-transition.ts`, modify:
```typescript
export async function safeStatusUpdate(
  delegate: PrismaDelegate,
  id: string,
  expectedStatus: string,
  data: Record<string, unknown>,
  expectedVersion?: number,  // Optional for backward compat
): Promise<{ count: number; newVersion?: number }> {
  const where: Record<string, unknown> = { id, status: expectedStatus };
  if (expectedVersion !== undefined) {
    where.version = expectedVersion;
    data.version = expectedVersion + 1;
  }

  const result = await delegate.updateMany({ where, data });

  if (result.count === 0) {
    throw new ConflictError(
      expectedVersion !== undefined
        ? 'Document was modified by another user. Please refresh and try again.'
        : `Status has already been changed from "${expectedStatus}"`
    );
  }

  return { count: result.count, newVersion: expectedVersion !== undefined ? expectedVersion + 1 : undefined };
}
```

Apply same change to `safeStatusUpdateTx`.

- [ ] **Step 5: Run tests**

```bash
cd packages/backend && npx vitest run --reporter=verbose 2>&1 | tail -20
```

- [ ] **Step 6: Commit**

```bash
git add packages/backend/prisma/ packages/backend/src/utils/safe-status-transition.ts
git commit -m "feat: add optimistic locking version columns to 8 document tables (Phase A)"
```

---

## Task 3: Keyboard Shortcuts System

**Files:**
- Create: `packages/frontend/src/hooks/useKeyboardShortcuts.ts`
- Create: `packages/frontend/src/components/KeyboardShortcutOverlay.tsx`
- Modify: `packages/frontend/src/layouts/MainLayout.tsx`

- [ ] **Step 1: Create useKeyboardShortcuts hook**

Create `packages/frontend/src/hooks/useKeyboardShortcuts.ts`:
```typescript
import { useEffect, useCallback, useRef } from 'react';

export interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  label: string;
  category: string;
  handler: () => void;
}

const globalShortcuts = new Map<string, Shortcut>();

function getShortcutKey(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');
  parts.push(e.key.toLowerCase());
  return parts.join('+');
}

export function useKeyboardShortcuts(shortcuts: Shortcut[], enabled = true) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!enabled) return;

    const ids: string[] = [];
    for (const s of shortcutsRef.current) {
      const parts: string[] = [];
      if (s.ctrl) parts.push('ctrl');
      if (s.shift) parts.push('shift');
      if (s.alt) parts.push('alt');
      parts.push(s.key.toLowerCase());
      const id = parts.join('+');
      globalShortcuts.set(id, s);
      ids.push(id);
    }

    return () => {
      for (const id of ids) globalShortcuts.delete(id);
    };
  }, [enabled, shortcuts]);
}

export function useGlobalShortcutListener() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) {
        if (e.key === 'Escape') {
          // Allow Escape in inputs
        } else {
          return;
        }
      }

      const key = getShortcutKey(e);
      const shortcut = globalShortcuts.get(key);
      if (shortcut) {
        e.preventDefault();
        shortcut.handler();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);
}

export function getRegisteredShortcuts(): Shortcut[] {
  return Array.from(globalShortcuts.values());
}
```

- [ ] **Step 2: Create KeyboardShortcutOverlay component**

Create `packages/frontend/src/components/KeyboardShortcutOverlay.tsx`:
```typescript
import { useState, useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';
import { getRegisteredShortcuts } from '@/hooks/useKeyboardShortcuts';
import type { Shortcut } from '@/hooks/useKeyboardShortcuts';

interface KeyboardShortcutOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutOverlay({ isOpen, onClose }: KeyboardShortcutOverlayProps) {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);

  useEffect(() => {
    if (isOpen) setShortcuts(getRegisteredShortcuts());
  }, [isOpen]);

  if (!isOpen) return null;

  const grouped = shortcuts.reduce<Record<string, Shortcut[]>>((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-card rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Keyboard size={24} className="text-nesma-secondary" />
            <h2 className="text-lg font-semibold text-white">Keyboard Shortcuts</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-all duration-300" aria-label="Close">
            <X size={20} className="text-gray-400" />
          </button>
        </div>
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category} className="mb-4">
            <h3 className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">{category}</h3>
            <div className="space-y-1">
              {items.map(s => (
                <div key={s.label} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5">
                  <span className="text-sm text-gray-300">{s.label}</span>
                  <ShortcutBadge shortcut={s} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShortcutBadge({ shortcut }: { shortcut: Shortcut }) {
  const keys: string[] = [];
  if (shortcut.ctrl) keys.push('Ctrl');
  if (shortcut.shift) keys.push('Shift');
  if (shortcut.alt) keys.push('Alt');
  keys.push(shortcut.key === ' ' ? 'Space' : shortcut.key.toUpperCase());

  return (
    <div className="flex items-center gap-1">
      {keys.map(k => (
        <kbd key={k} className="px-2 py-0.5 text-xs font-mono bg-white/10 border border-white/20 rounded text-gray-300">
          {k}
        </kbd>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Integrate into MainLayout**

In `packages/frontend/src/layouts/MainLayout.tsx`, add:
```typescript
import { useGlobalShortcutListener, useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { KeyboardShortcutOverlay } from '@/components/KeyboardShortcutOverlay';

// Inside MainLayout component:
const [showShortcuts, setShowShortcuts] = useState(false);

useGlobalShortcutListener();
useKeyboardShortcuts([
  { key: '?', label: 'Show keyboard shortcuts', category: 'General', handler: () => setShowShortcuts(true) },
  { key: '/', label: 'Focus search', category: 'Navigation', handler: () => document.querySelector<HTMLInputElement>('[data-search-input]')?.focus() },
], true);

// In JSX, after </main> closing tag:
<KeyboardShortcutOverlay isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
```

- [ ] **Step 4: Run frontend build to verify**

```bash
cd packages/frontend && npx tsc --noEmit 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/hooks/useKeyboardShortcuts.ts packages/frontend/src/components/KeyboardShortcutOverlay.tsx packages/frontend/src/layouts/MainLayout.tsx
git commit -m "feat: add keyboard shortcuts system with overlay (? to show)"
```

---

## Task 4: CDN Configuration

**Files:**
- Modify: `packages/frontend/vite.config.ts`
- Modify: `packages/backend/src/` — static file serving (find the Express static middleware)

- [ ] **Step 1: Add CDN base URL to Vite config**

In `packages/frontend/vite.config.ts`, update:
```typescript
export default defineConfig({
  base: process.env.VITE_CDN_URL || '/',
  // ... rest of config
```

- [ ] **Step 2: Add cache headers for static assets in backend**

Find where Express serves static files and add cache headers. If serving from Express:
```typescript
// For hashed assets (immutable)
app.use('/assets', express.static('dist/assets', {
  maxAge: '1y',
  immutable: true,
}));

// For index.html (no cache)
app.use(express.static('dist', {
  maxAge: 0,
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  },
}));
```

- [ ] **Step 3: Add CDN-friendly headers to export endpoints**

In upload/export routes, add:
```typescript
res.setHeader('Cache-Control', 'private, max-age=3600');
res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
```

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/vite.config.ts packages/backend/src/
git commit -m "perf: add CDN support with cache headers for static assets"
```
