# Codebase Concerns

**Analysis Date:** 2026-03-22

## Tech Debt

**Transaction Safety (Critical):**
- Issue: Stock operations scattered across codebase — some wrapped in transactions, others not
- Files: `packages/backend/src/domains/inbound/services/grn.service.ts:304`, `packages/backend/src/domains/outbound/services/mi.service.ts:175-197`, `packages/backend/src/domains/transfers/services/stock-transfer.service.ts:177,210`, `packages/backend/src/domains/outbound/services/mrn.service.ts:141`, `packages/backend/src/domains/outbound/services/mr.service.ts:186-273`
- Impact: Inventory inconsistency — if a stock operation fails partway through, the document record is already committed
- Fix approach: Audit all stock operations; ensure addStockBatch, consumeReservationBatch, updateLevelWithVersion calls are wrapped in prisma.$transaction or accept externalTx parameter for caller composition

**Code Duplication (High):**
- Issue: Complete duplication of transfer logic between `wt.service.ts` (V1) and `stock-transfer.service.ts` (V2)
- Files: `packages/backend/src/domains/transfers/services/wt.service.ts`, `packages/backend/src/domains/transfers/services/stock-transfer.service.ts`
- Impact: Maintenance burden — bugs fixed in one place don't propagate to the other
- Fix approach: V1 wt.service.ts should be thin re-export wrapper of V2 stock-transfer.service.ts (follow pattern from grn/mrrv unification)

**Duplicate Total Value Calculation:**
- Issue: Multiple services independently implement totalValue = sum(lineItems.qty * lineItems.unitPrice)
- Files: `packages/backend/src/domains/inbound/services/grn.service.ts:81-85`, `packages/backend/src/domains/outbound/services/mr.service.ts:92-98`, `packages/backend/src/domains/outbound/services/mi.service.ts:81-86`
- Impact: Inconsistency risk — if formula changes, must update 3+ places
- Fix approach: Extract `calculateDocumentTotalValue()` utility in shared domain; call from all services

**N+1 Query Issues:**
- Issue: `mr.service.ts:205-265` loops through lines and warehouses without batching stock lookups
- Files: `packages/backend/src/domains/outbound/services/mr.service.ts:205-265`, `packages/backend/src/domains/workflow/services/approval.service.ts:88-91`
- Impact: O(n×m) database queries during MR stock checking instead of O(1)
- Fix approach: Use `inventory.service.ts:getStockLevelsBatch()` for batch queries; already exists but not used everywhere

---

## Known Bugs

**ASN UOM Assignment Bug:**
- Symptoms: Advanced Shipping Notice lines are created with wrong UOM (assigned itemId instead of actual uomId)
- Files: `packages/backend/src/domains/inbound/services/asn.service.ts:254`
- Trigger: Create ASN with line items
- Fix approach: Change `uomId: line.itemId` to `uomId: line.uomId`
- Status: Critical — impacts ASN line item quantity tracking

**GRN totalValue Always 0 on Creation:**
- Symptoms: API returns GRN with totalValue: 0 even when line items have unit prices
- Files: `packages/backend/src/domains/inbound/services/grn.service.ts` (likely calculation runs async after response)
- Trigger: POST /grn with line items containing unitPrice
- Workaround: Re-fetch GRN after creation to get computed totalValue
- Fix approach: Calculate totalValue from lines during create transaction; return in initial response

**Bin Cards Computed Endpoint Hangs:**
- Symptoms: GET /bin-cards/computed?pageSize=100 returns no response after 30s timeout
- Files: `packages/backend/src/domains/inventory/routes/bin-card.routes.ts` (computed aggregation)
- Trigger: Open Inventory > Bin Cards > Computed tab
- Root cause: Complex computed query without pagination or timeout
- Fix approach: Add query timeout (30s) and mandatory pagination; consider materialized view for historical bin card states

**Route Shadowing Issues (23 warnings):**
- Symptoms: Console warnings during server startup about wildcard routes shadowing specific routes
- Files: `packages/backend/src/routes/index.ts` (route mounting order)
- Impact: Cosmetic but signals potential routing conflicts — if request matches multiple patterns, first-mounted route wins
- Example: GET /:typeCode/:id (system) shadows GET /files/:filename (uploads)
- Fix approach: Reorder route registration to mount static routes before dynamic ones; or use explicit route prefixes to prevent shadowing

**Rate Limiter Causes Session Loss (Medium):**
- Symptoms: Rapid page navigation (5-10 simultaneous API calls) triggers 429 Too Many Requests on /auth/me, causing logout
- Files: `packages/backend/src/middleware/rate-limiter.ts:78-100` (global limit: 100 req/60s too aggressive for SPA)
- Impact: UX regression — users navigating quickly get logged out
- Workaround: Wait 1-2 seconds between page transitions
- Fix approach: Exempt /auth/me from rate limiting OR increase authenticated user limits to 200+ req/60s

**Test Failures (2 socket hangs):**
- Symptoms: cycle-count.routes.test.ts and dashboard-builder.routes.test.ts fail with "socket hang up" ECONNRESET
- Files: `packages/backend/src/domains/inventory/routes/cycle-count.routes.test.ts`, `packages/backend/src/domains/reporting/routes/dashboard-builder.routes.test.ts`
- Impact: Test reliability — intermittent failures on CI
- Root cause: Test server not properly cleaning up connections or timeout too short for slow operations
- Fix approach: Increase test timeout to 10s, ensure afterEach cleanup calls server.close()

---

## Security Considerations

**AI Module SQL Injection Risk (Hardened but Requires Review):**
- Risk: `ai-chat.service.ts:163` uses $queryRaw with user-generated column names in AI queries
- Files: `packages/backend/src/domains/ai-services/services/ai-chat.service.ts`
- Current mitigation: Sensitive columns (password_hash, tokens, secrets) blocklisted; queries run in read-only transaction; table allowlist restricts queryable tables
- Recommendations: Add ESLint rule banning $queryRawUnsafe; log all AI queries to audit table; consider parameterized query builder (e.g., knex.js) instead of raw SQL

**Auth Middleware Async Race Condition:**
- Risk: `middleware/auth.ts` may call `next()` twice in error path
- Files: `packages/backend/src/middleware/auth.ts:32-51`
- Current mitigation: Error path calls sendError then returns (prevents double-call)
- Recommendations: Add explicit return after sendError; add test case for malformed JWT

**localStorage Tokens (XSS Risk):**
- Risk: Access tokens stored in localStorage are vulnerable to XSS
- Current mitigation: Frontend now uses httpOnly cookies for refresh tokens; access token remains in localStorage for service worker access
- Recommendations: Evaluate moving to httpOnly cookie + SameSite=Strict; ensure CORS allowlist is configured per environment

**CORS Not Validated for Production:**
- Risk: Backend allows any origin in dev mode
- Files: `packages/backend/src/config/cors.ts` (likely hardcoded to "*" or env-based)
- Recommendations: Document required CORS origin per environment; add production CORS validation step to deployment checklist

**Zod Schema String Length Limits:**
- Risk: Form input fields lack maxLength validation — could allow DoS via large payloads
- Files: All Zod schemas in `packages/shared/src/validators/validators.ts`
- Example: Item name, supplier address fields accept unlimited strings
- Fix approach: Add z.string().max(255) to all text input schemas; max(500) for descriptions/notes

---

## Performance Bottlenecks

**Large Frontend Components:**
- Problem: Four form pages are 800+ LOC each with inline state management
- Files: `packages/frontend/src/pages/warehouse/YardDashboard.tsx:1081`, `packages/frontend/src/pages/admin/NotificationRulesPage.tsx:1074`, `packages/frontend/src/pages/admin/DynamicTypeBuilderPage.tsx:1044`, `packages/frontend/src/domains/inbound/services/inventory.service.ts:1007`
- Impact: Slow IDE parsing, hard to test, refactoring risk
- Improvement path: Extract sub-components (KPI cards, modal dialogs, table sections) into separate files; use composition over monolithic components

**Missing Database Indexes:**
- Problem: Frequently-filtered/joined columns lack indexes
- Files: `packages/backend/prisma/schema/` (multiple files)
- Missing indexes on: InventoryLevel(itemId, lastMovementDate), InventoryLot(supplierId, expiryDate), Shipment(freightForwarderId, destinationWarehouseId), JobOrder(entityId)
- Impact: O(n) full table scans on high-volume tables (inventory, shipments)
- Improvement path: Run EXPLAIN ANALYZE on common queries; add composite indexes for WHERE + JOIN patterns

**Float Instead of Decimal for Quantities:**
- Problem: All quantity fields use Float which loses precision in accounting
- Files: `packages/backend/prisma/schema/` (CycleCountLine, StagingAssignment, PackingLine models)
- Impact: 0.01 SAR errors accumulate over 1000s of transactions
- Improvement path: Migrate CycleCountLine, StagingAssignment, PackingLine quantity fields from Float to Decimal(12,3)

**Chart Rendering in Hidden Containers:**
- Problem: Recharts warns "width(-1) and height(-1)" when charts are in collapsed/hidden containers
- Files: `packages/frontend/src/pages/warehouse/YardDashboard.tsx`, admin dashboards
- Impact: React errors in console; charts may not render when container expands
- Improvement path: Use ResizeObserver to delay chart rendering until container has dimensions

---

## Fragile Areas

**Approval State Machine:**
- Files: `packages/backend/src/domains/workflow/services/approval.service.ts:290-418`
- Why fragile: 10+ sequential DB calls without transaction wrapping approval state changes — if step 5 fails, approval is in partial state
- Safe modification: Wrap all approval transitions in prisma.$transaction; add compensating action logic for partial rollback
- Test coverage: Gaps in failure scenarios (e.g., what happens if Redis is down during approval notification emit?)

**Workflow Rule Engine:**
- Files: `packages/backend/src/domains/workflow/services/workflow-rule.service.ts`
- Why fragile: Rules cached in-memory with 60s TTL — during cache miss, old rules may execute; rules can reference deleted entities
- Safe modification: Add event listener to invalidate cache on rule CREATE/UPDATE/DELETE; validate entity references exist before rule execution
- Test coverage: No tests for race conditions between rule change and concurrent rule execution

**Dynamic Document Type System:**
- Files: `packages/backend/src/domains/system/services/dynamic-document-type.service.ts`
- Why fragile: Custom status flows stored as JSON, no schema validation on update — invalid transitions could be persisted
- Safe modification: Use Zod to validate status flow structure (nodes, edges, transitions) before saving; add migration for legacy invalid records
- Test coverage: Happy path tested, but edge cases like cycles in status flow graph not tested

**Soft Delete Filtering:**
- Files: Multiple files use `.where({ deletedAt: null })`
- Why fragile: Manual deletedAt checking easy to forget — if one query forgets the filter, deleted records appear
- Safe modification: Use Prisma middleware to auto-filter deletedAt at query time; implement as centralized prisma extension
- Test coverage: No explicit test for soft delete leaks in list queries

---

## Scaling Limits

**Sensor Reading Table Growth:**
- Current capacity: ~10M rows for 100 sensors over 6 months (IoT logging rate)
- Limit: Query performance degrades at 50M+ rows; table size > 5GB
- Scaling path: Implement table partitioning by (sensorId, date); archive old readings to cold storage; add materialized view for time-series aggregates

**Audit Log Table:**
- Current capacity: ~1M rows per year for 50 concurrent users
- Limit: Index lookups slow at 10M+ rows; audit report generation times out
- Scaling path: Same as sensor readings — partition by date; consider event streaming (Kafka) for real-time audit rather than DB writes

**In-Memory Rate Limiting:**
- Current capacity: ~1000 unique IPs per 60s window
- Limit: Map grows unbounded if IPs not cleaned up; memory leak in production
- Scaling path: Add cleanup job to prune entries older than windowMs; enforce Redis as required (in-memory fallback only for dev)

**WebSocket Connections (Socket.IO):**
- Current capacity: ~100 concurrent connections per process
- Limit: Memory > 500MB per 1000 connections; CPU spike on broadcast events
- Scaling path: Use Socket.IO Redis adapter for multi-process scaling; compress messages; add connection pooling/load balancing

---

## Dependencies at Risk

**AG-Grid Deprecations:**
- Risk: rowSelection string syntax and suppressRowClickSelection deprecated in v32.2+
- Files: `packages/frontend/src/components/` (Smart-Grid, LineItemsTable, etc.)
- Impact: Warnings in console; breaking change in v33+
- Migration plan: Update AG-Grid config to use new API (rowSelection as object, use new deprecated-replacement props)

**Prisma Schema Naming (Non-Standard Format):**
- Risk: Migrations use `0000_baseline`, `0001_add_constraints` instead of timestamp format
- Files: `packages/backend/prisma/migrations/`
- Impact: `prisma migrate deploy` won't work in production (reports "No migration found")
- Migration plan: Either re-baseline with timestamp format OR enforce `prisma db push` in deployment (documented but not enforced)

**Oracle PO Sync Module (Unintegrated):**
- Risk: `oracle-po-sync.service.ts` exists but not wired to any route or scheduler job
- Files: `packages/backend/src/domains/inbound/services/oracle-po-sync.service.ts:125-136` (has console.error logs, not structured logger)
- Impact: If enabled, errors won't be properly logged to audit trail; no way to trigger sync from UI
- Migration plan: Wire to scheduler job OR remove if not needed for current SOW

---

## Test Coverage Gaps

**Untested Area: Parallel Approval Workflows:**
- What's not tested: ParallelApprovalResponse routes and complex multi-approver scenarios
- Files: `packages/backend/src/domains/workflow/routes/parallel-approval.routes.ts`, `packages/backend/src/domains/workflow/services/parallel-approval.service.ts`
- Risk: Concurrent approvals may execute out-of-order; no test ensures all approvers must respond before document transitions
- Priority: High — used for high-value MIs (> 500K threshold)

**Untested Area: Cost Allocation Calculations:**
- What's not tested: Real cost allocation flows across warehouses, projects, cost centers
- Files: `packages/backend/src/domains/reporting/services/cost-allocation.service.ts`, routes
- Risk: Cost reports may double-count or miss allocations in multi-warehouse scenarios
- Priority: High — impacts financial reporting accuracy

**Untested Area: Demand Forecasting with Historical Data:**
- What's not tested: Forecast accuracy with real consumption patterns; time-series interpolation edge cases
- Files: `packages/backend/src/domains/reporting/services/demand-forecast.service.ts`
- Risk: Forecasts unreliable if historical data has gaps or anomalies
- Priority: Medium — forecast accuracy degrades silently

**Untested Area: File Upload Multipart Handling:**
- What's not tested: Large file uploads (> 10MB), concurrent uploads, malformed multipart boundaries
- Files: `packages/backend/src/domains/uploads/routes/attachment.routes.ts`
- Risk: Server may hang or crash on large/malformed uploads; no size limit enforcement in production
- Priority: Medium — affects document management features

**Untested Area: Email Template Rendering with Special Characters:**
- What's not tested: Arabic characters, special symbols in template variables; HTML injection in user-supplied values
- Files: `packages/backend/src/domains/notifications/services/email.service.ts`
- Risk: Email rendering corruption or injection vulnerabilities
- Priority: Medium — impacts notification delivery quality

---

## Missing Critical Features

**Feature Gap: FIFO/FEFO Enforcement:**
- Problem: Inventory issue (MI) does not enforce FIFO (First-In-First-Out) or FEFO (First-Expire-First-Out) lot selection
- Blocks: Accurate cost-of-goods accounting, compliance with batch expiry regulations
- Impact: Inventory costs may be incorrect; expired goods could be shipped if not manually checked
- Workaround: Manual lot selection during MI creation
- Priority: High for pharmaceutical/food industries

**Feature Gap: Barcode Scanning Integration:**
- Problem: BarcodeScanner component exists but not integrated with receiving/put-away/picking flows
- Blocks: Mobile/warehouse operator workflows; real-time location tracking
- Impact: Operators still manually type item codes; no scan-and-go workflows
- Workaround: Keyboard input simulating barcode scanner
- Priority: Medium for full WMS functionality

**Feature Gap: Offline Mode / PWA:**
- Problem: Service worker configured but offline queue not fully functional; sync on reconnect incomplete
- Blocks: Warehouse operations during network outages
- Impact: Operators cannot enter data offline; manual re-entry on reconnect
- Workaround: None — network required
- Priority: Medium for warehouse floor reliability

**Feature Gap: Inventory Replenishment Rules:**
- Problem: No automated replenishment from reserve to pick zones
- Blocks: Pick-face optimization; reduced manual pick travel time
- Impact: Pickers must search across all bins; slower picking
- Workaround: Manual replenishment orders
- Priority: Medium for logistics efficiency

---

## Summary of Issue Density

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 3 | Active (ASN UOM bug, transaction safety, auth race) |
| High | 12 | Active (bin-cards hang, test failures, rate limiter, duplication, N+1 queries, CORS, AI SQL injection) |
| Medium | 8 | Active (GRN totalValue, route shadowing, soft deletes, cost allocation tests, FIFO enforcement, email rendering) |
| Low | 7 | Active (chart sizing, deprecations, Oracle sync, string length limits, barcode integration, offline mode, replenishment) |
| **Total** | **30** | - |

---

*Concerns audit: 2026-03-22*
