# Wave 3: Locking Enforcement, SmartGrid, Sharing, Upload, Customs, Reports — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce optimistic locking (Phase B+C), add SmartGrid virtual scrolling + server pagination, report template sharing, file upload for QCI/DR/Scrap, customs tracking notifications, reorder point UI, and scheduled reports UI.

**Architecture:** 7 independent tasks. All can run in parallel. Depends on Wave 1 Task 2 (optimistic locking Phase A migration).

**Tech Stack:** @tanstack/react-virtual, React Query, Prisma, Express, Socket.IO

---

## Task 1: Optimistic Locking — Phase B+C (Enforcement)

**Depends on:** Wave 1 Task 2 (version columns exist)

**Files:**
- Modify: All ~47 service files that call `safeStatusUpdate()` — thread `version` parameter
- Modify: Frontend form hooks — send `version` on updates

- [ ] **Step 1: Update document-factory to pass version**

In `packages/backend/src/utils/document-factory.ts`, update the PUT handler:
```typescript
// In update route handler
const { version, ...updateData } = req.body;
// Pass version to service update
const result = await config.service.update(req.params.id, updateData, version);
```

- [ ] **Step 2: Update document services to accept version**

For each document service (grn, mi, mrn, qci, dr, mr, wt, jo), update the update/transition methods:
```typescript
// Before
await safeStatusUpdate(prisma.mrrv, id, current.status, { status: newStatus });

// After
await safeStatusUpdate(prisma.mrrv, id, current.status, { status: newStatus }, current.version);
```

Search all files: `grep -rn "safeStatusUpdate" packages/backend/src/domains/ --include="*.ts" -l`

Update each one to pass `current.version` (fetched from the findUnique query that precedes it).

- [ ] **Step 3: Return version in API responses**

In document-factory GET endpoints, ensure `version` field is included in responses (it will be automatically since Prisma returns all fields).

- [ ] **Step 4: Update frontend forms to track version**

In form hooks that submit updates, add `version` to the mutation payload:
```typescript
// In useDocumentForm or similar:
const onSubmit = async (data) => {
  await updateMutation.mutateAsync({
    ...data,
    version: currentDocument.version, // From GET response
  });
};
```

- [ ] **Step 5: Add version conflict handling in frontend**

Create a reusable error handler for 409 responses:
```typescript
onError: (error) => {
  if (error.response?.status === 409) {
    toast.error('This document was modified by another user. Please refresh and try again.');
    queryClient.invalidateQueries({ queryKey: [resourceKey, id] });
  }
}
```

- [ ] **Step 6: Phase C — Make version required in API**

After frontend is updated, change document-factory PUT handler to require `version`:
```typescript
if (version === undefined) {
  return res.status(400).json({ error: 'version field is required for updates' });
}
```

- [ ] **Step 7: Commit**

```bash
git commit -m "feat: enforce optimistic locking with version checks on all document updates"
```

---

## Task 2: SmartGrid Virtual Scrolling + Server-Side Pagination

**Files:**
- Modify: `packages/frontend/src/components/smart-grid/SmartGrid.tsx`
- Modify: `packages/frontend/src/components/smart-grid/Pagination.tsx`
- Modify: `packages/backend/src/middleware/pagination.ts` — add filter support

- [ ] **Step 1: Install @tanstack/react-virtual**

```bash
cd packages/frontend && pnpm add @tanstack/react-virtual
```

- [ ] **Step 2: Add server-side pagination props to SmartGrid**

In SmartGrid.tsx, extend props:
```typescript
export interface SmartGridProps {
  // ... existing props
  serverPagination?: {
    total: number;
    page: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
    onSortChange?: (sortBy: string, sortDir: 'asc' | 'desc') => void;
  };
}
```

When `serverPagination` is provided, use its values instead of client-side pagination.

- [ ] **Step 3: Add virtual scrolling for large datasets**

In SmartGrid.tsx, add virtualizer:
```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

// Inside component:
const parentRef = useRef<HTMLDivElement>(null);
const rows = table.getRowModel().rows;
const useVirtual = rows.length > 500;

const virtualizer = useVirtualizer({
  count: rows.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 42, // row height
  overscan: 10,
  enabled: useVirtual,
});

// In render: wrap table body with virtualizer if enabled
```

- [ ] **Step 4: Extend backend pagination middleware with filters**

In `packages/backend/src/middleware/pagination.ts`, add filter parsing:
```typescript
// Add to PaginationQuery interface:
filters?: Record<string, string>;

// In paginate middleware:
const filters: Record<string, string> = {};
for (const [key, value] of Object.entries(req.query)) {
  if (key.startsWith('filter.') && typeof value === 'string') {
    filters[key.replace('filter.', '')] = value;
  }
}
req.pagination!.filters = filters;
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: add SmartGrid virtual scrolling and server-side pagination support"
```

---

## Task 3: Report Template Sharing

**Files:**
- Modify: `packages/backend/prisma/schema/10-email-dashboard.prisma` — add sharing fields to SavedReport
- Create: `packages/frontend/src/components/report-builder/ShareTemplateModal.tsx`
- Modify: `packages/backend/src/domains/reporting/routes/saved-report.routes.ts`
- Modify: `packages/frontend/src/components/report-builder/ReportTemplateGallery.tsx`

- [ ] **Step 1: Add sharing fields to SavedReport model**

In Prisma schema, add to SavedReport:
```prisma
  sharedWithRoles  Json?     @map("shared_with_roles")  // JSON array of role strings
```

- [ ] **Step 2: Generate migration**

```bash
cd packages/backend && npx prisma migrate dev --name add_report_sharing
```

- [ ] **Step 3: Add share/unshare API endpoints**

In `saved-report.routes.ts`, add:
```typescript
// POST /reports/saved/:id/share
router.post('/:id/share', authenticate, async (req, res, next) => {
  const { roles, isPublic } = req.body;
  const report = await prisma.savedReport.update({
    where: { id: req.params.id, ownerId: req.user.id },
    data: { sharedWithRoles: roles, isPublic: isPublic ?? false },
  });
  sendSuccess(res, report);
});

// GET /reports/saved/shared — reports shared with my role
router.get('/shared', authenticate, async (req, res, next) => {
  const reports = await prisma.savedReport.findMany({
    where: {
      OR: [
        { isPublic: true },
        { sharedWithRoles: { array_contains: [req.user.role] } },
      ],
      ownerId: { not: req.user.id },
    },
  });
  sendSuccess(res, reports);
});
```

- [ ] **Step 4: Create ShareTemplateModal component**

Create `packages/frontend/src/components/report-builder/ShareTemplateModal.tsx`:
- Glass-card modal with role selector (checkboxes for all 10 roles)
- Public toggle
- Save button calls share API
- Uses Nesma dark theme styling

- [ ] **Step 5: Add share button to ReportTemplateGallery**

In `ReportTemplateGallery.tsx`, add a Share icon button on each report card owned by the current user.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat: add report template sharing with role-based access"
```

---

## Task 4: File Upload for QCI/DR/Scrap

**Existing infra:** Upload routes at `packages/backend/src/domains/uploads/routes/upload.routes.ts`, attachment service, and FormField file upload UI in `packages/frontend/src/components/forms/FormField.tsx`.

**Files:**
- Create: `packages/frontend/src/components/FileUploadZone.tsx`
- Modify: QCI, DR, Scrap form pages to include upload zone
- Modify: `packages/backend/src/domains/uploads/routes/upload.routes.ts` — entity association

- [ ] **Step 1: Create FileUploadZone component**

Create `packages/frontend/src/components/FileUploadZone.tsx`:
```typescript
import { useState, useCallback } from 'react';
import { Upload, X, FileText, Image, Loader2 } from 'lucide-react';

interface FileUploadZoneProps {
  entityType: string;
  entityId?: string;
  maxFiles?: number;
  acceptedTypes?: string;
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
}

interface UploadedFile {
  id?: string;
  url: string;
  name: string;
  size: number;
  mimeType: string;
}
```

Features:
- Drag & drop zone with glass-card styling
- Multi-file support with file list
- Image preview thumbnails (for jpg/png)
- PDF icon for PDF files
- Remove button per file
- Upload progress indicator
- Calls `POST /api/v1/upload` for each file

- [ ] **Step 2: Wire into QCI (RFIM) form**

In the QCI/RFIM form page, add FileUploadZone after the inspection checklist:
```tsx
<FileUploadZone
  entityType="rfim"
  entityId={documentId}
  maxFiles={10}
  acceptedTypes=".jpg,.jpeg,.png,.pdf"
  files={attachments}
  onFilesChange={setAttachments}
/>
```

- [ ] **Step 3: Wire into DR (OSD) form**

Same pattern in the DR form — evidence photos for discrepancy reports.

- [ ] **Step 4: Wire into Scrap form**

Same pattern in the Scrap form — condition photos.

- [ ] **Step 5: Add entity association in upload service**

In `packages/backend/src/domains/uploads/`, ensure the attachment service can link files to an entity:
```typescript
// After upload, create attachment record
await attachmentService.create({
  entityType: req.body.entityType,
  recordId: req.body.entityId,
  fileName: req.file.filename,
  originalName: req.file.originalname,
  fileSize: req.file.size,
  mimeType: req.file.mimetype,
  storagePath: req.file.path,
  uploadedById: req.user.id,
});
```

- [ ] **Step 6: Commit**

```bash
git commit -m "feat: add file upload for QCI inspection photos, DR evidence, and Scrap condition"
```

---

## Task 5: Customs Tracking Notifications

**Existing:** Customs document routes at `packages/backend/src/domains/logistics/routes/customs-document.routes.ts` with verify/reject endpoints.

**Files:**
- Modify: `packages/backend/src/domains/logistics/services/customs-document.service.ts` — add EventBus publishing
- Create: `packages/backend/src/domains/scheduler/jobs/customs-jobs.ts` — expiry check job
- Modify: `packages/backend/src/events/chain-notification-handler.ts` — add customs rules
- Create: `packages/frontend/src/components/CustomsTimeline.tsx`

- [ ] **Step 1: Add EventBus publishing to customs service**

In customs-document.service.ts, publish events on status changes:
```typescript
import { eventBus } from '../../../events/event-bus.js';

// After verify:
eventBus.publish({
  type: 'customs:clearance_received',
  entityType: 'customs_document',
  entityId: doc.id,
  action: 'verify',
  payload: { shipmentId: doc.shipmentId, documentType: doc.documentType },
  timestamp: new Date().toISOString(),
});

// After reject:
eventBus.publish({
  type: 'customs:hold_placed',
  // ...
});
```

- [ ] **Step 2: Create customs expiry check job**

Create `packages/backend/src/domains/scheduler/jobs/customs-jobs.ts`:
```typescript
export async function checkCustomsExpiry(ctx: JobContext): Promise<void> {
  const now = new Date();
  const warningDays = [7, 3, 1];

  for (const days of warningDays) {
    const threshold = new Date(now);
    threshold.setDate(threshold.getDate() + days);

    const expiring = await ctx.prisma.customsDocument.findMany({
      where: {
        expiryDate: { lte: threshold, gte: now },
        status: { not: 'expired' },
      },
      include: { shipment: true },
    });

    for (const doc of expiring) {
      eventBus.publish({
        type: 'customs:document_expiring',
        entityType: 'customs_document',
        entityId: doc.id,
        action: 'expiry_warning',
        payload: { daysUntilExpiry: days, documentType: doc.documentType, shipmentId: doc.shipmentId },
        timestamp: now.toISOString(),
      });
    }
  }
}
```

Register in maintenance-jobs.ts with 24h interval.

- [ ] **Step 3: Add customs rules to chain-notification-handler**

Add rules for customs events:
```typescript
{
  entityTypes: ['customs_document'],
  targetStatus: 'verified',
  recipientRoles: ['logistics_coordinator', 'manager'],
  titleTemplate: 'Customs Document Verified: {{documentType}}',
  notificationType: 'customs_update',
},
```

- [ ] **Step 4: Create CustomsTimeline component**

Create `packages/frontend/src/components/CustomsTimeline.tsx`:
- Vertical timeline showing customs milestones
- Icons: CheckCircle (verified), AlertTriangle (hold), Clock (pending), XCircle (rejected)
- Glass-card styling with nesma-secondary accent

- [ ] **Step 5: Wire into customs detail page**

Add CustomsTimeline to the customs detail page in `packages/frontend/src/pages/logistics/`.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat: add customs tracking notifications with expiry warnings and timeline UI"
```

---

## Task 6: Reorder Point UI

**Existing:** `reorder_update` job runs every 7 days. Inventory service has reorder calculations.

**Files:**
- Modify: `packages/backend/src/domains/inventory/routes/` — add reorder suggestion endpoints
- Create: `packages/frontend/src/components/ReorderSuggestionsWidget.tsx`

- [ ] **Step 1: Add reorder suggestion API endpoints**

```typescript
// GET /api/v1/inventory/reorder-suggestions
router.get('/reorder-suggestions', authenticate, requirePermission('inventory', 'read'), async (req, res, next) => {
  const items = await prisma.inventoryLevel.findMany({
    where: {
      currentQuantity: { lte: prisma.inventoryLevel.fields.reorderPoint },
      reorderPoint: { gt: 0 },
    },
    include: { item: true, warehouse: true },
    orderBy: { currentQuantity: 'asc' },
  });
  sendSuccess(res, items);
});

// POST /api/v1/inventory/reorder-suggestions/:itemId/apply
router.post('/reorder-suggestions/:itemId/apply', authenticate, requirePermission('inventory', 'update'), async (req, res, next) => {
  const { reorderPoint, reorderQuantity, safetyStock } = req.body;
  const updated = await prisma.inventoryLevel.update({
    where: { id: req.params.itemId },
    data: { reorderPoint, reorderQuantity, safetyStock },
  });
  sendSuccess(res, updated);
});
```

- [ ] **Step 2: Create frontend widget**

Create reorder suggestions dashboard widget showing items below reorder point with action buttons to apply suggestions.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add reorder point suggestions API and dashboard widget"
```

---

## Task 7: Scheduled Reports UI

**Existing:** SavedReport model already has `scheduleFrequency`, `nextRunAt`, `lastRunAt`, `scheduleRecipients`. The `runScheduledReports` job processes them.

**Files:**
- Modify: `packages/backend/src/domains/reporting/routes/saved-report.routes.ts` — add schedule endpoints
- Modify: `packages/frontend/src/domains/reporting/hooks/useSavedReports.ts` — add schedule fields to type
- Create: `packages/frontend/src/components/report-builder/ReportScheduleModal.tsx`

- [ ] **Step 1: Add schedule endpoint to saved-report routes**

In `saved-report.routes.ts`:
```typescript
// PATCH /reports/saved/:id/schedule
router.patch('/:id/schedule', authenticate, async (req, res, next) => {
  const { scheduleFrequency, scheduleRecipients } = req.body;

  let nextRunAt: Date | null = null;
  if (scheduleFrequency) {
    nextRunAt = new Date();
    switch (scheduleFrequency) {
      case 'daily': nextRunAt.setDate(nextRunAt.getDate() + 1); break;
      case 'weekly': nextRunAt.setDate(nextRunAt.getDate() + 7); break;
      case 'monthly': nextRunAt.setMonth(nextRunAt.getMonth() + 1); break;
    }
  }

  const report = await prisma.savedReport.update({
    where: { id: req.params.id, ownerId: req.user.id },
    data: { scheduleFrequency, scheduleRecipients, nextRunAt },
  });
  sendSuccess(res, report);
});
```

- [ ] **Step 2: Update frontend SavedReport type**

In `useSavedReports.ts`, add to SavedReport interface:
```typescript
scheduleFrequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | null;
scheduleRecipients?: string[];
nextRunAt?: string;
lastRunAt?: string;
```

Add `useScheduleReport` mutation hook.

- [ ] **Step 3: Create ReportScheduleModal**

Create `packages/frontend/src/components/report-builder/ReportScheduleModal.tsx`:
- Frequency selector (daily/weekly/monthly/quarterly/none)
- Recipient email list (add/remove)
- Next run preview
- Glass-card modal styling

- [ ] **Step 4: Add schedule button to report builder UI**

In the report detail view or ReportTemplateGallery, add a Calendar icon button that opens ReportScheduleModal.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: add scheduled reports UI with frequency picker and recipient management"
```
