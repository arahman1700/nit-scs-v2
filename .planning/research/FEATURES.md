# Feature Landscape

**Domain:** Enterprise Supply Chain Management / Warehouse Management System
**Researched:** 2026-03-22
**Overall Confidence:** HIGH

## Context

NIT Supply Chain V2 is an enterprise SCM/WMS system with 19 backend domains, 13 user roles, 100+ API routes, and 60+ frontend pages already built. The system is NOT in greenfield -- it has extensive existing functionality that needs stabilization, bug fixing, and hardening before production launch. This analysis categorizes existing and missing features by production criticality.

The PROJECT.md explicitly states: "Fix-first approach (no new features)" -- the focus is on making what exists work perfectly, not adding capabilities.

---

## Table Stakes

Features users expect. Missing or broken = users lose trust in the entire system. If inventory numbers are wrong even once, operators will keep parallel spreadsheets and the system is dead on arrival.

### Tier 1: Data Integrity Foundation (MUST be bulletproof)

These are not "features" in the traditional sense -- they are the foundation. If any of these fail, nothing else matters.

| Feature | Why Expected | Complexity | Current State | Notes |
|---------|--------------|------------|---------------|-------|
| Transactional stock operations | Partial stock updates = inventory lies | High | BROKEN -- scattered non-transactional operations across GRN, MI, MRN, MR, WT services | Critical concern #1. All stock adds/consumes MUST be atomic. This is the single most important fix before production. |
| Approval state machine integrity | Partial approvals = documents stuck forever | High | BROKEN -- 10+ sequential DB calls without transaction wrapping in approval.service.ts | Critical concern. Approval stuck in partial state if step 5 of 10 fails. |
| Correct document calculations | Wrong totals = finance loses trust instantly | Low | BUG -- GRN totalValue always 0 on creation | Must calculate in-transaction, not async after response. |
| Correct data assignment | Wrong UOM = wrong quantities = inventory chaos | Low | BUG -- ASN assigns itemId as uomId | One-line fix but critical data corruption. |
| Soft delete consistency | Deleted records appearing = data confusion | Medium | FRAGILE -- manual deletedAt filtering, easy to miss | Need centralized Prisma middleware to auto-filter. |
| Float-to-Decimal migration for quantities | 0.01 SAR errors compound over 1000s of transactions | Medium | BUG -- CycleCountLine, StagingAssignment, PackingLine use Float | Financial accuracy requirement for enterprise. |

### Tier 2: Core Document Lifecycle (MUST work end-to-end)

These are the daily-use workflows. If a warehouse operator cannot complete a receiving or issuing flow start-to-finish without errors, the system cannot go live.

| Feature | Why Expected | Complexity | Current State | Notes |
|---------|--------------|------------|---------------|-------|
| GRN (Goods Receiving Note) -- full lifecycle | Core inbound operation. Every item entering warehouse goes through this. | Low (exists) | BUILT -- form config, service, routes, UI all exist. Has totalValue=0 bug. | Fix the bug, verify end-to-end with transactions. |
| MI (Material Issue) -- full lifecycle | Core outbound operation. Every item leaving warehouse goes through this. | Low (exists) | BUILT -- form config, service, routes, UI all exist. Needs transaction safety. | High-value MIs trigger parallel approval -- untested. |
| MRN (Material Return Note) -- full lifecycle | Returns from site to warehouse. Common daily operation. | Low (exists) | BUILT -- form config, service, routes, UI exist. | Verify stock reversal is transactional. |
| MR (Material Request) -- full lifecycle | Site engineers request materials. Entry point for outbound flow. | Low (exists) | BUILT -- form config, service, routes exist. Has N+1 query issue in stock checking. | Fix N+1 with batch stock lookup. |
| WT (Warehouse Transfer) -- full lifecycle | Inter-warehouse stock movement. | Low (exists) | BUILT -- duplicated logic between wt.service.ts and stock-transfer.service.ts. | Unify services (V1 wraps V2). |
| QCI (Quality Control Inspection) | Every received item needs quality check before acceptance. | Low (exists) | BUILT -- form config, service, routes, UI exist. | Verify ties to GRN flow correctly. |
| DR (Discrepancy Report) | Document damaged/short/excess on receiving. Required for supplier accountability. | Low (exists) | BUILT -- form config, service, routes exist. | Standard document flow. |
| Approval workflow (sequential) | All documents above threshold need manager/director approval. Without this, unauthorized spending occurs. | Low (exists) | BUILT -- approval.service.ts has full chain logic. Needs transaction wrapping. | The engine exists and works for happy path. Fragile on failure. |
| Job Orders -- full lifecycle | Equipment/transport/scrap work orders. Core operational document. | Low (exists) | BUILT -- multiple JO types (transport, rental, generator, scrap) with form configs. | Complex multi-type form. Verify all types work. |
| Gate Passes | Nothing enters or leaves the compound without a gate pass. Physical security requirement. | Low (exists) | BUILT -- routes, service, form config exist for gate officer role. | Critical for site security. |
| Document status transitions | Draft -> Submitted -> Approved -> Completed is the standard flow. Users need clear status visibility. | Low (exists) | BUILT -- document-factory handles status transitions with Zod validation. | STATUS_FLOWS defined in formConstants.ts. |
| Auto-numbering for documents | GRN-2026-0001, MI-2026-0002 etc. Users expect sequential, readable document numbers. | Low (exists) | BUILT -- DocumentCounter model + autoNumber.ts utility. | Verify no gaps on failed creates. |

### Tier 3: Inventory Visibility (MUST be accurate and responsive)

| Feature | Why Expected | Complexity | Current State | Notes |
|---------|--------------|------------|---------------|-------|
| Real-time stock levels by item + warehouse | "How much do we have?" is asked 100x/day | Low (exists) | BUILT -- InventoryLevel model, stock overview pages for all roles. | Foundation is solid. Depends on Tier 1 transaction fixes for accuracy. |
| Bin card / stock ledger | Historical record of every movement for an item. Auditors require this. | Medium | BUILT but BROKEN -- bin-cards computed endpoint hangs with no response after 30s. | Needs pagination, query timeout, possibly materialized view. |
| Expiry alerts | Perishable/dated materials must be flagged before expiry. Regulatory requirement in some industries. | Low (exists) | BUILT -- expiry-alert.service.ts with auto-quarantine. ExpiryAlertsPage exists. | Verify scheduler job runs the check. |
| Inventory lot tracking | Track batches, suppliers, expiry per lot. Required for traceability. | Low (exists) | BUILT -- InventoryLot + LotConsumption models. Manual lot selection on MI. | Works but lacks FIFO/FEFO enforcement (see Differentiators). |
| Cycle counting | Physical inventory verification. Enterprise compliance requirement. | Low (exists) | BUILT -- full cycle count lifecycle: create, generate lines, start, record, complete, apply adjustments, auto-schedule. | Comprehensive implementation. CycleCountLine uses Float (fix). |

### Tier 4: Access Control and Security (MUST be correct)

| Feature | Why Expected | Complexity | Current State | Notes |
|---------|--------------|------------|---------------|-------|
| Role-based access control (RBAC) | 13 roles (admin, warehouse supervisor, staff, manager, QC, logistics, etc.) must see only their data and actions. | Low (exists) | BUILT -- resource-based permissions matrix in shared/permissions.ts, requirePermission middleware. | Comprehensive role system. Verify all routes are protected. |
| Warehouse/project scoping | Users should only see documents for their assigned warehouse or project. | Low (exists) | BUILT -- scope-filter.ts with buildScopeFilter() on list/get queries. | Row-level security. Verify no query leaks. |
| Authentication with token refresh | Seamless session management. Users should not be randomly logged out. | Medium | BUILT but BUGGY -- rate limiter causes session loss on rapid navigation (429 on /auth/me). | Fix rate limiter: exempt /auth/me or increase limits to 200+ req/60s. |
| Audit trail | Every create, update, delete, status change must be logged with who/when/what. Non-negotiable for enterprise. | Low (exists) | BUILT -- AuditLog model, auditAndEmit() utility in every route handler. | Solid implementation. Check completeness across all routes. |
| Input validation | All user input must be validated server-side. Prevents data corruption and injection. | Medium | PARTIALLY DONE -- Zod schemas exist but lack string length limits (DoS risk). | Add z.string().max(255) to all text schemas, max(500) for descriptions. |
| CORS production configuration | Must restrict origins in production. Currently allows any origin in dev mode. | Low | NOT CONFIGURED for production. | Must be set before go-live. |

### Tier 5: User Experience Essentials (MUST work or users revolt)

| Feature | Why Expected | Complexity | Current State | Notes |
|---------|--------------|------------|---------------|-------|
| Role-based dashboards | Each role sees relevant KPIs and quick actions on login. | Low (exists) | BUILT -- role-specific dashboards for admin, warehouse supervisor, manager, QC, logistics, transport, etc. | 13 role-specific navigation configs. |
| RTL Arabic support | NIT operates in Saudi Arabia. Arabic is primary language for many operators. | Low (exists) | BUILT -- DirectionContext, RTL toggle, recently shipped. | Verify all pages render correctly in RTL. |
| PDF export for documents | Users print GRNs, MIs, gate passes. Paper copies are standard in warehouses. | Low (exists) | BUILT -- pdfExport.ts utility exists. | Verify all document types can export. |
| Search and filtering | Users need to find documents by number, status, date, warehouse. | Low (exists) | BUILT -- DocumentListPanel with sorting/filtering, global search routes. | Standard list/filter on all document types. |
| Notifications | Users must be alerted when documents need their action (approval, inspection, etc.). | Low (exists) | BUILT -- Notification model, push subscriptions, notification.routes.ts, real-time via Socket.IO. | Verify notification delivery for all workflow triggers. |
| File attachments | Documents need supporting files (photos, scanned papers, certificates). | Low (exists) | BUILT -- Attachment model, upload routes, Multer handling. | Untested for large files (>10MB). Add size limits. |

---

## Differentiators

Features that set the product apart from spreadsheets or basic ERP. Not expected for initial launch, but valued. Can have minor issues at go-live.

| Feature | Value Proposition | Complexity | Current State | Notes |
|---------|-------------------|------------|---------------|-------|
| FIFO/FEFO lot enforcement | Automatic first-in-first-out or first-expire-first-out selection during MI. Prevents expired goods shipping and ensures accurate COGS. | Medium | MISSING -- identified as feature gap in CONCERNS.md. Manual lot selection exists as workaround. | High value for pharma/food. Not blocking for general construction supply chain. Phase 2 candidate. |
| Drag-drop dashboard builder | Users can create custom KPI dashboards without developer help. Reduces admin burden. | Low (exists) | BUILT -- dashboard-builder component, DashboardWidget model, widget-data.service with 430+ lines of data sources. | Impressive differentiator. Polish, don't rebuild. |
| Report builder | Custom report generation with saved templates. | Low (exists) | BUILT -- report-builder component, SavedReport model, multiple report routes. | Polish for production. |
| Workflow rule engine | Automated actions on events (e.g., auto-notify on threshold breach, auto-escalate overdue approvals). | Low (exists) | BUILT -- WorkflowRule model, rule-engine.ts event listener, chain-notification-handler. FRAGILE -- 60s cache TTL, no invalidation on change. | Add cache invalidation on rule CRUD. |
| Parallel approval workflows | Multiple approvers must sign off on high-value transactions. | Low (exists) | BUILT -- ParallelApprovalGroup/Response models, service, routes. UNTESTED for concurrent scenarios. | Test thoroughly before enabling in production. |
| Barcode scanning integration | Scan-and-go for receiving, picking, issuing. Reduces data entry errors. | Medium | PARTIALLY BUILT -- BarcodeScanner component exists but not integrated into receiving/putaway/picking flows. | Keyboard input works as workaround. Phase 2 for full integration. |
| Warehouse zone management | Organize warehouse into zones, bins, and locations for directed putaway/picking. | Low (exists) | BUILT -- WarehouseZone, BinLocation models, warehouse-zone.routes, putaway-rules. | Advanced WMS feature. Verify zone-based operations work. |
| ABC analysis | Classify inventory by value (A=high, B=medium, C=low) for focused management. | Low (exists) | BUILT -- abc-analysis.service with calculate, apply, get summary functions. AbcAnalysisPage exists. | Nice analytical feature. |
| Demand forecasting | Predict future material needs from historical consumption patterns. | Low (exists) | BUILT -- demand-forecast.service, demand.routes. UNTESTED for accuracy with real data. | Valuable but unreliable without validation. Flag for phase 2 deep testing. |
| Wave picking | Group multiple outbound orders into optimized pick waves. | Low (exists) | BUILT -- WaveHeader/WaveLine models, wave.routes. WavePickingPage exists. | Advanced WMS feature for high-volume operations. |
| Cross-docking | Direct inbound-to-outbound without putaway. | Low (exists) | BUILT -- CrossDock model, cross-dock.routes. | For fast-moving items. Nice to have. |
| Packing stations | Organized packing workflow with session tracking. | Low (exists) | BUILT -- PackingSession/PackingLine models, packing.routes. PackingStationPage exists. | Advanced logistics feature. |
| AI chat assistant | Natural language queries against system data ("show me all overdue GRNs"). | Low (exists) | BUILT -- AiConversation/AiMessage models, ai.routes, ai-suggestions.routes. | Needs SQL injection hardening review before production. |
| Real-time updates via WebSocket | All users see changes instantly without refresh. | Low (exists) | BUILT -- Socket.IO with role-based rooms, React Query cache invalidation. | Already working. Just verify at scale (100+ connections). |
| Digital signatures | Sign-off on documents with electronic signatures for compliance. | Low (exists) | BUILT -- DigitalSignature model, digital-signature.service. | Valuable for regulated environments. |
| Supplier evaluation | Score and rate suppliers based on delivery performance, quality, pricing. | Low (exists) | BUILT -- SupplierEvaluation/SupplierEvaluationMetric models, supplier-evaluation.routes. | Good for procurement optimization. |
| Customs and tariffs | Track customs documents, tariff rates for international shipments. | Low (exists) | BUILT -- CustomsDocument, TariffRate models, customs-document.routes, tariff.routes. | Relevant for NIT's import operations. |
| Dynamic document types | Admin can create custom document types with configurable fields and status flows. | Low (exists) | BUILT -- DynamicDocumentType, DynamicFieldDefinition, DynamicDocument models. FRAGILE -- no schema validation on status flow updates. | Power-user feature. Add Zod validation for safety. |
| Equipment/fleet management | Track vehicles, generators, tools, rental contracts, AMC. | Low (exists) | BUILT -- comprehensive equipment domain with 7 route files, multiple models. | Domain-complete feature set. |
| Cost allocation | Allocate costs across warehouses, projects, cost centers for financial reporting. | Low (exists) | BUILT -- cost-allocation.routes, CostAllocationPage. UNTESTED for multi-warehouse accuracy. | Test thoroughly before relying on financial reports. |
| Offline queue (PWA) | Queue operations when network drops, sync on reconnect. | Medium | PARTIALLY BUILT -- Service worker configured, useOfflineQueue hook exists, but sync incomplete. | Nice for warehouse floor reliability. Phase 2 for full offline mode. |
| Delegation rules | Managers can delegate approval authority during absence. | Low (exists) | BUILT -- DelegationRule model, delegation.service with full CRUD + toggle. DelegationsPage exists. | Important for business continuity. |

---

## Anti-Features

Features to explicitly NOT build for v1. Adding these now would delay launch, increase complexity, and provide minimal value relative to effort.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Mobile native app (iOS/Android) | Massive development effort, PWA covers 90% of mobile use cases. The system already has responsive design + mobile dashboard routes. | Keep PWA. Optimize mobile web experience for warehouse staff. |
| Full ERP integration (SAP, Oracle real-time sync) | Oracle PO sync module exists but is unwired. Real-time bidirectional sync is a 6-month project in itself. | Keep oracle-po-sync.service.ts dormant. If needed, implement as batch import/export CSV. Remove the module if not in SOW. |
| Sustainability/carbon tracking | Industry trend but not a user request. Adds complexity to every transaction without clear ROI for NIT. | Defer entirely. Not in scope. |
| Multi-company/multi-tenant SaaS | The system is for NIT. Multi-tenancy adds auth complexity, data isolation challenges, and migration risk. | Keep single-tenant. Warehouse/project scoping is sufficient. |
| Advanced analytics / ML predictions | Demand forecasting exists at basic level. Building sophisticated ML models requires data scientist involvement and training data. | Keep existing basic forecasting. Do not invest in ML accuracy for v1. |
| Blockchain-based traceability | Industry buzzword. Adds zero practical value for construction supply chain at NIT's scale. | Standard audit trail (already built) is sufficient. |
| Supplier portal (external user access) | Requires separate auth system, public-facing security hardening, and ongoing support for external users. | Suppliers submit POs via email/phone. Internal staff creates ASNs. |
| Automated replenishment rules | No automated reserve-to-pick zone replenishment. Requires deep warehouse layout integration and edge case handling. | Manual replenishment via WT. Add to Phase 2 roadmap after warehouse zone feature is battle-tested. |
| Full EDI integration | EDI 850/856/810 standards require protocol-specific handling per trading partner. | CSV import/export covers immediate needs. EDI is a post-launch enhancement if partners require it. |
| IoT sensor automation | Sensor models exist (SensorReading) but automated warehouse actions based on sensor data (temperature alerts, etc.) are complex. | Keep sensor data as monitoring-only. Manual response to alerts. |

---

## Feature Dependencies

```
                        ┌─────────────────────────────┐
                        │  Transaction Safety (Tier 1) │
                        └─────────────┬───────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                  │
              ┌─────▼─────┐   ┌──────▼──────┐   ┌──────▼──────┐
              │ GRN Flow  │   │  MI Flow    │   │  WT Flow    │
              └─────┬─────┘   └──────┬──────┘   └──────┬──────┘
                    │                │                  │
              ┌─────▼─────┐   ┌──────▼──────┐         │
              │ QCI/DR    │   │  MR → MI    │         │
              └───────────┘   └──────┬──────┘         │
                                     │                 │
                    ┌────────────────┼─────────────────┘
                    │                │
              ┌─────▼─────┐   ┌──────▼──────┐
              │ Inventory  │   │ Bin Cards   │
              │ Accuracy   │   │ (fix hang)  │
              └─────┬─────┘   └─────────────┘
                    │
           ┌────────┼────────┐
           │        │        │
     ┌─────▼──┐ ┌──▼───┐ ┌──▼──────┐
     │ Cycle  │ │Expiry│ │ ABC     │
     │ Count  │ │Alerts│ │Analysis │
     └────────┘ └──────┘ └─────────┘

Approval Workflow (independent but critical):
  Transaction Safety → Approval State Machine → Document Transitions

Security Chain:
  Auth (rate limiter fix) → RBAC → Scope Filter → CORS → Input Validation

Reporting Chain (depends on accurate data):
  Inventory Accuracy → KPI Dashboards → Cost Allocation → Reports
```

Key dependency rules:
- Transaction safety MUST be fixed before any document flow can be trusted
- Approval state machine wrapping MUST happen before document transitions are reliable
- Inventory accuracy depends on transactional GRN/MI/WT -- cannot test reporting until these are solid
- Bin cards fix is independent but blocks inventory visibility
- Rate limiter fix is independent and quick -- do it early to unblock QA testing
- CORS + input validation must be done before any external access

---

## MVP Recommendation

### Must Ship (Production Blockers)

Prioritize in this exact order:

1. **Transaction safety for all stock operations** -- Without this, inventory data cannot be trusted. Every other feature is built on sand.
2. **Approval state machine transaction wrapping** -- Documents getting stuck kills user workflows.
3. **ASN UOM bug fix** -- One-line fix, critical data corruption.
4. **GRN totalValue calculation fix** -- Finance team sees $0 on every receipt.
5. **Rate limiter fix** -- Users getting randomly logged out during testing will file bugs against everything.
6. **Bin cards computed endpoint** -- Add pagination and timeout. Cannot hang indefinitely.
7. **Route shadowing cleanup** -- Potential for wrong route being hit in production.
8. **Zod string length limits** -- DoS protection.
9. **CORS production configuration** -- Security requirement.
10. **Auth race condition fix** -- Potential double next() call.
11. **Soft delete middleware** -- Prevent deleted record leaks.
12. **Missing database indexes** -- InventoryLevel, InventoryLot, Shipment, JobOrder.
13. **Float-to-Decimal migration** -- Financial accuracy.
14. **End-to-end verification of all 7 document types** (GRN, MI, MRN, MR, WT, QCI, DR) -- create, submit, approve, complete, with stock effects.
15. **WT/stock-transfer service unification** -- Eliminate dual maintenance risk.

### Defer to Phase 2

- FIFO/FEFO enforcement (manual lot selection works)
- Barcode scanning integration into flows (keyboard input works)
- Full offline mode / PWA sync
- Automated replenishment rules
- Demand forecasting accuracy validation
- Oracle PO sync integration
- Parallel approval load testing
- Cost allocation accuracy verification
- AI module SQL injection hardening (restrict to read-only role in DB)

### Defer Indefinitely

- Mobile native app
- Supplier portal
- EDI integration
- Blockchain
- Sustainability tracking
- Multi-tenant SaaS
- ML-based predictions

---

## Sources

- [Enterprise Supply Chain Management Software in 2026](https://erpsoftwareblog.com/2025/12/top-11-enterprise-supply-chain-management-software/)
- [The Top 11 WMS Features - SelectHub](https://www.selecthub.com/warehouse-management/warehouse-management-software-features-requirements/)
- [Key Features in Warehouse Management System - Addverb](https://addverb.com/blog/key-features-to-look-for-in-warehouse-management-system/)
- [WMS Functional Requirements - HQ Software](https://hqsoftwareblog.com/blog/warehouse-management-system-functional-requirements/)
- [ERP Go-Live Checklist - CAI Software](https://caisoft.com/resources/erp-go-live-checklist/)
- [ERP Go-Live Readiness Checklist - Nestell Associates](https://nestellassociates.com/erp-go-live-readiness-checklist/)
- [Data Integrity in Warehousing - SC Junction](https://www.scjunction.com/blog/the-importance-of-data-integrity-in-warehousing)
- [Inventory Accuracy - NetSuite](https://www.netsuite.com/portal/resource/articles/inventory-management/inventory-accuracy.shtml)
- [Audit Trails in Supply Chain - Cflow](https://www.cflowapps.com/audit-trails/)
- [Compliance and Audit in Logistics Workflows - Splice-IT](https://www.splice-it.com/post/compliance-and-audit-in-logistics-workflows)
- Internal: `.planning/PROJECT.md`, `.planning/codebase/CONCERNS.md`, `.planning/codebase/ARCHITECTURE.md`

---

*Feature landscape analysis: 2026-03-22*
