# NIT Logistics Platform — Gap Analysis & Best Practices Report

**Date:** March 4, 2026
**Prepared by:** AI Analysis (Claude)
**Sources:** SOW (Feb 24, 2026), Codebase Audit, Global WMS Research (Gartner 2025 MQ, Manhattan/SAP/Oracle/Blue Yonder feature sets)

---

## Executive Summary

The NIT platform is a **mature, production-capable system** with 86 backend route files, 76 services, 96 frontend pages, and 124 Prisma models. It exceeds the SOW's 42-entity requirement significantly and has built infrastructure well beyond Phase 1 scope.

However, several **SOW acceptance criteria gaps** exist that will block UAT, and certain **global best practice areas** present improvement opportunities for future phases.

This report is divided into three parts:
- **Part A** — SOW Feature-by-Feature Gap Analysis (what's missing for UAT)
- **Part B** — Global Best Practices Comparison (how the system compares to industry leaders)
- **Part C** — Prioritized Improvement Recommendations

---

## PART A: SOW vs Codebase Gap Analysis

### Legend
- ✅ Fully implemented, meets acceptance criteria
- 🟡 Partially implemented, gaps in acceptance criteria
- ❌ Not implemented or missing critical functionality
- ⚠️ Implemented but deviates from SOW specification

---

### MODULE 1 — Warehousing & Inventory Management (14 Features)

#### M1-F01: Material Receiving (MRRV) — Phase 1
**Status: 🟡 Mostly Complete**

| Acceptance Criteria | Status | Notes |
|---|---|---|
| AC-01: Form submits with all required fields | ✅ | GRN form works end-to-end |
| AC-02: Variance calculation (Over/Short/Damaged) | ✅ | OSD auto-generation implemented |
| AC-03: OSD auto-generated on variance | ✅ | DR routes handle this |
| AC-04: QC notification within 5 seconds | 🟡 | Notification service exists, but SLA timer enforcement not verified |
| AC-05: QC result updates MRRV status | ✅ | QCI workflow connected |
| AC-06: Inventory incremented on approval | ✅ | Inventory service handles this |
| AC-07: Bin Card updated | 🟡 | Bin cards exist but are stored records, not computed views as SOW requires |
| AC-08: Row Owner restrictions | 🟡 | RBAC middleware exists, but Row Owner (warehouse-scoped) filtering needs verification |

**Gaps:**
1. **Bin Cards are database records, not computed views** — SOW explicitly defines them as "computed views showing running balance per item per bin location, NOT manually maintained records" (M1-F05). Current implementation uses a `BinCard` Prisma model with `BinCardTransaction` records. This is a fundamental architectural deviation.
2. **Row Owner scoping** — The SOW requires users to see only data for their assigned warehouse(s). RBAC exists but warehouse-scoped row filtering needs end-to-end verification across all list/dashboard queries.
3. **PO reference field** — SOW requires "Purchase Order (PO) reference number, input supplier name, item list, expected quantities, and UOM from PO data." POs are excluded (EX-03) but the reference field should still exist for manual entry.

---

#### M1-F02: Material Issue to Projects (MIRV) — Phase 1
**Status: 🟡 Mostly Complete**

| Acceptance Criteria | Status | Notes |
|---|---|---|
| AC-01: Blocked when qty > available stock | 🟡 | Service logic exists but needs verification of per-item error messages |
| AC-02: Approval routes correctly (2-step ≤200K, 3-step >200K) | ⚠️ | Current approval levels use different thresholds (10K/50K/100K/500K) — SOW specifies SAR 200,000 as the single threshold |
| AC-03: Push notification within 5 seconds | 🟡 | Push notification infrastructure exists, timing SLA not enforced |
| AC-04: Pick list generated on approval | ❌ | No pick list generation feature found |
| AC-05: Gate Pass auto-generated and linked | ❌ | Gate pass exists but auto-linking from MIRV not implemented |
| AC-06: Inventory decremented on delivery | ✅ | MI service handles this |
| AC-07: Cost allocation to project | 🟡 | Cost tracking partial — no explicit project cost allocation report |
| AC-08: Row Owner restrictions | 🟡 | See M1-F01 note |

**Gaps:**
1. **Approval threshold mismatch** — SOW specifies a single SAR 200,000 threshold (WH Manager ≤200K, SC Manager >200K). Codebase has 5 levels with different amounts. This needs alignment.
2. **Pick list generation** — Not implemented. SOW requires "system generates a pick list for the Warehouse Officer" on approval.
3. **Gate Pass auto-linking** — Gate passes can be created manually but are not auto-generated from approved MIRVs.
4. **Delivery confirmation with digital signature** — SOW requires "receiving party (Project Manager) signs receipt digitally." No digital signature capture exists.

---

#### M1-F03: Stock Transfer Between Warehouses (IMSF) — Phase 1
**Status: 🟡 Partially Complete**

**Gaps:**
1. **Dual warehouse manager approval** — SOW requires approval from both source AND destination warehouse managers. Current implementation doesn't enforce this dual-approval pattern.
2. **Packing list generation** — SOW: "System generates packing list from approved IMSF." Not implemented.
3. **Gate Pass auto-linking** — Not auto-generated from approved IMSF.
4. **OSD on receiving mismatch** — Should auto-generate OSD when receiving quantities differ from sending quantities.

---

#### M1-F04: Cycle Count & Physical Inventory — Phase 2
**Status: 🟡 Backend exists, frontend partial**

**Gaps:**
1. **Blind count sheets** — SOW requires system to hide system quantities from counters. Backend model has fields but this blind-counting UX flow needs verification.
2. **NCR auto-generation at 5% variance** — Not connected. SOW: "Variance exceeding 5% triggers a Non-Conformance Report (NCR)."
3. **Stock adjustment approval workflow** — SOW requires WH Manager approval before inventory is adjusted. Need to verify this workflow is wired.
4. **Routes commented out** — Cycle count routes are commented out in `routes/index.ts`.

---

#### M1-F05: Bin Card Management — Phase 1
**Status: ⚠️ Architecture Deviation**

**Critical Issue:** SOW explicitly states bin cards are **computed views**, NOT manually maintained records. Quote: "Bin Cards are computed views, NOT manually maintained records. Running balance = sum of all transactions for that item at that bin location."

Current implementation uses a `BinCard` Prisma model — this is a stored record approach. The SOW approach would be a database view or computed query aggregating MRRV, MIRV, IMSF, MRV, and Stock Adjustment transactions.

**Impact:** This affects AC-01 (auto-update after every transaction) and AC-02 (mathematical correctness). The stored-record approach requires explicit updates after each transaction, which could lead to consistency issues.

---

#### M1-F06: Material Returns from Projects (MRV) — Phase 2
**Status: 🟡 Partially Complete**

**Gaps:**
1. **Link to original MIRV** — SOW requires "MRV form linked to the original MIRV (issue transaction)." Need to verify this reference link exists in the schema and form.
2. **Condition routing** — Good→inventory, Damaged→quarantine, Unusable→scrap. The routing logic for different conditions needs verification.
3. **Photo documentation** — SOW requires "max 5 photos per item, max 5MB each" for Damaged and Unusable items. Attachment system exists but photo-specific limits not enforced.

---

#### M1-F07: Tools Issue & Return — Phase 3
**Status: ✅ Mostly Complete**
Tool issue/return workflow exists with `ToolIssue` model, routes, and frontend form. Overdue alerting via configurable thresholds and condition tracking implemented.

---

#### M1-F08: Scrap & Waste Disposal — Phase 3
**Status: 🟡 Partially Complete**

**Gaps:**
1. **Auto-flagging rules** — SOW: "System auto-flags items based on configurable rules: age in inventory, condition status, movement frequency." Not implemented — scrap items are manually registered.
2. **Quarterly report auto-generation** — Not implemented.
3. **Decision options workflow** — SOW specifies Scrap/Sell/Return to Supplier/Reclassify. SSC bidding exists but full decision workflow is partial.

---

#### M1-F09: Minimum Stock Alerts & Reordering — Phase 2
**Status: 🟡 Schema ready, alerting partial**

**Gaps:**
1. **Daily automated threshold check** — Scheduler service exists but daily stock-level monitoring job not verified as running.
2. **Consumption trend report** — SOW requires "Report showing consumption trend (based on historical MIRV data) and recommended reorder quantity." Reorder prediction service exists but frontend report not visible.

---

#### M1-F10: Warehouse Handover & Shift Management — Phase 3
**Status: ✅ Implemented**
Handover form, routes, service all exist. Auto-population of pending issues and active alerts needs verification.

---

#### M1-F11: Warehouse Compliance & Safety Audits — Phase 3
**Status: 🟡 Partial**
Inspection checklists exist (AQL calculator) but **compliance audit checklists aligned with TUV/SGS/ISO 9001** not specifically implemented. NCR creation and CAP tracking partially exist through the inspection system.

---

#### M1-F12: Annual Maintenance Contracts (AMC) — Phase 3
**Status: ❌ Not explicitly implemented**
Rental contracts exist but AMC (Annual Maintenance Contracts for warehouse infrastructure) is a separate concept. No specific AMC entity, renewal alerting, or maintenance-schedule-to-contract linking found.

---

#### M1-F13: Inventory Dashboard — Phase 1
**Status: ✅ Implemented**
InventoryDashboard exists with KPIs, stock levels, movements, and filtering. Drill-down capability present.

---

#### M1-F14: QC Inspection Workflow — Phase 1
**Status: ✅ Implemented**
QCI routes, services, and frontend exist. Triggered from GRN workflow. Photo attachments supported.

---

### MODULE 2 — Equipment & Transportation Management (8 Features)

#### M2-F01: Equipment Rental Request (Job Order) — Phase 2
**Status: 🟡 Mostly Complete**

**Gaps:**
1. **Rate card auto-pull** — SOW requires "System auto-pulls current rate card for the selected equipment type and supplier." Rate card routes exist but auto-pull integration into JO form needs verification.
2. **Cost calculation formula** — SOW: "rate × duration + transport + operator + fuel + insurance." Current JO may not implement all cost components.
3. **Condition inspection checklist on arrival** — Not specifically implemented as a checklist within the JO workflow.

---

#### M2-F02: Equipment Delivery & Return — Phase 2
**Status: ❌ Missing**
**No dedicated Delivery Note or Return Note entities found.** SOW requires:
- Delivery Note with condition photos, hours/mileage, safety certificates
- PM digital signature triggering rental period start
- Return Note with side-by-side condition comparison
- Damage documentation
- Final cost calculation (actual days + damage + fuel)

The `RentalContract` model exists but the delivery/return tracking workflow is not implemented.

---

#### M2-F03: Transportation of Materials — Phase 2
**Status: 🟡 Partial**
Job orders handle transport but the dedicated **Transport Order** entity (origin, destination, load description, vehicle type, driver assignment, gate pass linking) as described in SOW is not separately implemented. Transport is embedded within the JO system.

---

#### M2-F04: Vehicle Maintenance — Phase 3
**Status: 🟡 Partial**
Generator maintenance routes/services exist but **vehicle fleet maintenance** (usage-based scheduling per vehicle, parts tracking, cost per vehicle) is not the same scope. SOW specifically mentions "maintenance schedule based on usage (hours/mileage), not calendar."

---

#### M2-F05: Supplier Performance Evaluation — Phase 2
**Status: ❌ Not implemented**
No supplier evaluation entity, weighted scoring, or trend tracking found. SOW requires auto-collection of metrics (on-time delivery, quality, pricing compliance, responsiveness, safety record) and weighted scoring configurable by SC Manager.

---

#### M2-F06: Rental Agreements & Rate Cards — Phase 2
**Status: 🟡 Partial**
Rental contracts exist but dedicated **Rate Card** entity (Supplier × Equipment Type × Size/Capacity → Daily/Weekly/Monthly Rate with operator/fuel/insurance flags) not found as a standalone master data entity. SOW requires rate cards to be auto-referenced when creating Job Orders.

---

#### M2-F07: Emergency Equipment Requests — Phase 3
**Status: ❌ Not implemented**
No emergency request fast-track workflow that bypasses WH Manager and routes directly to SC Manager. No premium cost tracking separate from standard costs.

---

#### M2-F08: Equipment Dashboard — Phase 2
**Status: 🟡 Partial**
Equipment section page exists but the specific dashboard with active rentals, cost-to-date, cost by project aggregation, and supplier performance scores needs verification.

---

### MODULE 3 — Shipping & Customs Clearance (7 Features)

#### M3-F01: Shipment Notification & Tracking — Phase 2
**Status: ✅ Mostly Complete**
Shipment routes, services, and frontend exist with multi-stage lifecycle tracking.

#### M3-F02: Customs Documentation — Phase 3
**Status: 🟡 Partial**
CustomsTracking model exists but the document checklist management (Commercial Invoice, Packing List, COO, BOL, Insurance Certificate) with completeness validation is not fully implemented.

#### M3-F03: Import Clearance Process — Phase 3
**Status: 🟡 Partial**
Status tracking exists in shipment lifecycle but dedicated clearance process tracking (customs hold/reject with reason documentation, clarification request notifications) is basic.

#### M3-F04: VAT & Duties Management — Phase 3
**Status: ❌ Not implemented**
No duty calculation from HS codes, VAT auto-calculation at 15%, or payment processing workflow found.

#### M3-F05: Shipment Release Authorization — Phase 3
**Status: ❌ Not implemented**
No prerequisite verification checklist (documents approved, inspection passed, duties paid, VAT paid) or release authorization workflow.

#### M3-F06: Shipment Dashboard — Phase 2
**Status: ✅ Implemented**
Shipping section page with shipment tracking exists.

---

### MODULE 4 — Support & Administration (12 Features)

#### M4-F01: Master Data Management — Phase 1
**Status: ✅ Complete**
Full CRUD for warehouses, items, suppliers, projects with soft-delete.

#### M4-F02: Employee Management — Phase 1
**Status: ✅ Complete**
Employee records with warehouse assignment and role linking.

#### M4-F03: User & Role Management — Phase 1
**Status: ⚠️ Role count mismatch**
SOW requires 14 distinct roles. Codebase has 10 roles in `SYSTEM_ROLES`. SOW note says "Implementation may use role consolidation internally but must deliver equivalent permission granularity." Missing roles:
- Technical Manager (exists as role concept but not in SYSTEM_ROLES)
- Gate Officer (not in SYSTEM_ROLES)
- Inventory Specialist (not in SYSTEM_ROLES)
- Shipping Officer (not in SYSTEM_ROLES)
- Finance User (not in SYSTEM_ROLES)
- Customs Specialist (not in SYSTEM_ROLES)
- Compliance Officer (not in SYSTEM_ROLES)

**Impact:** Permission matrix in Section 13.3 depends on all 14 roles being addressable.

#### M4-F04: Approval Engine — Phase 1
**Status: ✅ Implemented**
Multi-step approval workflows with SLA timers. Parallel approvals also implemented (beyond SOW scope).

#### M4-F05: Notification Engine — Phase 1
**Status: 🟡 Infrastructure exists, catalog incomplete**

SOW defines exactly 15 notification types (N-01 through N-14). Need to verify each is implemented:

| ID | Event | Status |
|---|---|---|
| N-01 | MIRV submitted for approval | 🟡 Needs verification |
| N-02 | Stock below minimum level | 🟡 Scheduler needed |
| N-03 | Equipment return date approaching | 🟡 Needs verification |
| N-04 | Shipment status change | 🟡 Needs verification |
| N-05 | Shipment delayed | 🟡 Needs verification |
| N-06 | QC inspection required | ✅ Likely implemented |
| N-07 | Approval SLA exceeded | 🟡 Needs verification |
| N-08 | Cycle count scheduled | 🟡 Needs verification |
| N-09 | Rate card expiring | ❌ No rate card entity |
| N-10 | Vehicle maintenance due | 🟡 Needs verification |
| N-11 | Unauthorized gate exit attempt | ❌ No gate security system |
| N-12 | NCR deadline approaching | 🟡 Needs verification |
| N-13 | Contract/insurance renewal due | 🟡 Needs verification |
| N-14 | Overdue tool return | 🟡 Needs verification |

#### M4-F06: Reporting & Analytics (Dashboards) — Phase 1
**Status: ✅ Implemented**
Multiple dashboards exist. Dashboard builder for custom dashboards also exists (beyond SOW).

#### M4-F07: Scheduled Reports — Phase 2
**Status: 🟡 Partial**
Report builder and saved reports exist but **scheduled auto-generation** (daily/weekly/monthly/quarterly on a timer) needs verification. SOW requires reports generated automatically at scheduled times.

#### M4-F08: Compliance & Audits — Phase 3
**Status: 🟡 Partial**
Inspection checklists exist but dedicated compliance audit with NCR creation, CAP tracking, and compliance dashboard needs dedicated implementation.

#### M4-F09: Asset Management — Phase 3
**Status: 🟡 Partial**
Depreciation dashboard and entries exist in codebase but the full asset register (ID/tag, category, purchase date, cost, current location, assigned to, insurance expiry, annual physical verification) needs verification.

#### M4-F10: Maintenance Tracking — Phase 3
**Status: 🟡 Partial**
Generator maintenance exists but generic asset/equipment maintenance work orders as described in SOW are different.

#### M4-F11: Full KPI Dashboard — Phase 3
**Status: 🟡 Partial**
Various dashboards exist but the SOW requires a consolidated dashboard tracking **all 15 target KPIs** with current-vs-target comparison and trend display.

#### M4-F12: Administrative Support — Phase 3
**Status: ✅ Mostly Complete**
System settings, audit log viewer, and bulk export exist.

---

### MODULE 5 — Gate Pass & Access Control (5 Features)

#### M5-F01: Outbound Gate Pass — Phase 1
**Status: 🟡 Partial**

**Gaps:**
1. **Source transaction lookup** — SOW requires Gate Officer to look up underlying transaction (MIRV, IMSF, JO) by reference number to verify physical load matches digital authorization. This lookup-and-verify workflow is not implemented.
2. **Verification result** (Passed/Denied/Held) — Not tracked.
3. **Denial logging with WH Manager notification** — Not implemented.

#### M5-F02: Inbound Gate Pass — Phase 1
**Status: 🟡 Partial**
Gate pass creation exists but the inbound-specific flow (check delivery note, verify against expected deliveries/pending MRRVs, link to subsequent MRRV) is not fully implemented.

#### M5-F03: Visitor Management — Phase 2
**Status: ❌ Not implemented**
No visitor registration, host notification, visitor pass issuance, overstay alerts, or visitor history found.

#### M5-F04: Material Movement Tracking & Reconciliation — Phase 1
**Status: ❌ Not implemented**
SOW requires daily auto-reconciliation comparing all gate movements against all inventory transactions, with mismatch flagging and WH Manager notification. This reconciliation engine does not exist.

#### M5-F05: Access Control & Security — Phase 3
**Status: ❌ Not implemented**
No authorized personnel lists, access event logging (entry/exit), security incident reports, or off-hours access flagging.

---

### CROSS-MODULE DATA FLOWS (22 Flows)

| # | Flow | Status |
|---|---|---|
| 1 | MRRV → Bin Cards | 🟡 Updates bin card records (not computed) |
| 2 | MRRV → Inbound Gate | ❌ Not auto-linked |
| 3 | MIRV → Bin Cards | 🟡 Same as above |
| 4 | MIRV → Outbound Gate | ❌ Not auto-linked |
| 5 | MIRV → MRV (returns reference) | 🟡 Needs verification |
| 6 | IMSF → Bin Cards (both WHs) | 🟡 |
| 7 | IMSF → Gates (both exit/entry) | ❌ Not auto-linked |
| 8 | MRV → Bin Cards | 🟡 |
| 9 | MRV → Scrap (unusable items) | ❌ Not auto-routed |
| 10 | Cycle Count → Bin Cards | ❌ Routes commented out |
| 11 | JO → Rate Cards (auto-pull) | ❌ No rate card entity |
| 12 | JO → Outbound Gate | ❌ Not auto-linked |
| 13 | JO → Delivery/Return Notes | ❌ No delivery note entity |
| 14 | Shipment → Customs Docs | 🟡 Partial |
| 15 | Customs Docs → VAT/Duties | ❌ Not implemented |
| 16 | Release Auth → Transport Order | ❌ Not implemented |
| 17 | Shipment delivered → MRRV | ❌ Not auto-linked |
| 18 | All Transactions → Dashboards | ✅ |
| 19 | All Transactions → Audit Trail | ✅ |
| 20 | Employees → Users/Roles | ✅ |
| 21 | Movement Tracking → Bin Cards | ❌ Reconciliation not implemented |
| 22 | Supplier Eval → Supplier record | ❌ Not implemented |

**Result: 3/22 fully working, 7/22 partial, 12/22 not implemented**

---

## PART B: Global Best Practices Comparison

### How the NIT Platform Compares to Industry Leaders

| Best Practice Area | Industry Standard | NIT Status | Rating |
|---|---|---|---|
| **Inventory Accuracy** | 99%+ with continuous cycle counting | Cycle counts exist but routes deferred | 🟡 |
| **ABC Analysis** | ABC-driven count frequency & storage | Service exists, routes deferred | 🟡 |
| **Put-Away Optimization** | System-directed based on velocity/weight | Put-away rules service exists, deferred | 🟡 |
| **Pick Optimization** | Wave/batch/zone picking + shortest path | Pick optimizer service exists, deferred | 🟡 |
| **Slotting** | Dynamic re-slotting based on demand | AI slotting service exists, deferred | 🟡 |
| **Cross-Docking** | Flow-through without storage | Service exists, deferred | 🟡 |
| **Multi-level Approvals** | Configurable with SLA escalation | ✅ Implemented + parallel approvals | ✅ |
| **Audit Trail** | Immutable, timestamped records | ✅ Full audit logging | ✅ |
| **FIFO/FEFO** | System-enforced picking order | ❌ Not implemented | ❌ |
| **Lot/Batch Traceability** | Full chain from receipt to consumption | 🟡 InventoryLot model exists, partial | 🟡 |
| **Barcode/GS1** | GS1-128, QR, DataMatrix | ✅ Full barcode service | ✅ |
| **Role-Based Dashboards** | Per-role views with KPIs | ✅ 7+ role-specific dashboards | ✅ |
| **Workflow Engine** | Visual builder, configurable rules | ✅ Full workflow builder | ✅ |
| **Custom Fields** | Admin-configurable without code | ✅ Custom field definitions | ✅ |
| **Real-Time Updates** | Socket.IO / WebSocket push | ✅ Socket.IO implemented | ✅ |
| **Offline Capability** | PWA with offline queue | ✅ PWA + offline queue | ✅ |
| **Mobile Operations** | Touch-optimized warehouse ops | ✅ Mobile GRN/MI/WT pages | ✅ |
| **Bulk Operations** | Batch processing for documents | ✅ Bulk routes + import | ✅ |
| **PDF/Export** | Document generation + CSV export | 🟡 PDF util exists, CSV export partial | 🟡 |
| **RTL/Arabic Support** | Full RTL layout + Arabic UI | 🟡 Direction context exists, not comprehensive | 🟡 |
| **Hijri Calendar** | Alongside Gregorian dates | ❌ Not implemented | ❌ |

### Areas Where NIT Exceeds Industry Standards

1. **Dashboard Builder** — Custom drag-and-drop dashboard creation is an advanced feature that even SAP EWM and Oracle WMS don't natively offer without add-ons
2. **Workflow Builder** — Visual workflow designer with rule engine rivals Manhattan Active WM's configurability
3. **Report Builder** — Dynamic report generation with saved reports
4. **Email Template System** — Customizable email templates with dynamic variables
5. **Parallel Approvals** — Beyond what the SOW requires, implemented as an advanced capability
6. **Semantic Search** — Global search across all entities
7. **Document Comments** — Threaded discussion on any document

### Critical Gaps vs Best Practices

#### 1. FIFO/FEFO Enforcement
**Industry Standard:** System-enforced FIFO (First-In-First-Out) picking for standard goods, FEFO (First-Expired-First-Out) for date-sensitive items.
**NIT Status:** Not implemented. No lot-based picking order enforcement.
**Impact:** Critical for inventory accuracy and compliance, especially for construction materials with shelf life.

#### 2. Expiry Date Management
**Industry Standard:** Expiry alerts at 30/60/90 days, auto-quarantine of expired stock.
**NIT Status:** Not implemented. InventoryLot model has expiry fields but no alerting or quarantine logic.
**Impact:** Risk of using expired materials (cement, chemicals, safety equipment).

#### 3. Weighbridge Integration
**Industry Standard:** Automated gross/tare/net weight capture at gates, cross-checked against loading documents.
**NIT Status:** Not implemented. SOW excludes hardware integration (EX-05) but weight fields could still be captured manually.
**Recommendation:** Add weight fields to gate pass records for manual entry.

#### 4. ZATCA e-Invoicing Readiness
**Industry Standard:** Mandatory in KSA (Phase 2 ongoing through 2026). Arabic invoices, XML with embedded PDF/A-3, UUID, digital signature, cryptographic stamp.
**NIT Status:** Excluded in SOW (EX-10). However, this is becoming mandatory for all Saudi businesses. Consider as future Change Request.

#### 5. SABER Conformity Certification
**Industry Standard:** Mandatory since Jan 2025 for all imports to KSA. Digital-only conformity certificates.
**NIT Status:** Not implemented. SOW excludes government integration (EX-10).
**Recommendation:** At minimum, add SABER certificate reference fields to shipment/customs records for manual tracking.

#### 6. Hijri Date Support
**Industry Standard:** Mandatory for Saudi government submissions and common in Saudi business operations.
**NIT Status:** Not implemented. RTL direction context exists but no Hijri calendar conversion.
**Recommendation:** Add Hijri date display alongside Gregorian on all date fields. Libraries like `moment-hijri` or `hijri-date` make this straightforward.

---

## PART C: Prioritized Improvement Recommendations

### Priority 1 — CRITICAL (Phase 1 UAT Blockers)

These items will likely **fail acceptance criteria** and must be addressed before Phase 1 UAT:

| # | Item | SOW Reference | Effort |
|---|---|---|---|
| C1 | **Bin Cards as Computed Views** — Refactor from stored records to computed aggregation of MRRV/MIRV/IMSF/MRV transactions | M1-F05, AC-01, AC-02 | High |
| C2 | **Row Owner Filtering** — Verify and enforce warehouse-scoped data visibility on ALL list/dashboard queries | M4-F03, AC-02; applies to all modules | Medium |
| C3 | **Approval Threshold Alignment** — Align approval levels to SAR 200,000 threshold (2-step ≤200K WH Manager, 3-step >200K SC Manager) | M1-F02, AC-02; M2-F01, AC-03 | Low |
| C4 | **Gate Pass Auto-Linking** — Auto-generate/link gate passes from approved MIRV, IMSF, and JO transactions | M1-F02 AC-05, M1-F03 AC-05 | Medium |
| C5 | **Outbound Gate Verification Flow** — Gate Officer looks up source transaction, verifies physical vs digital, records result (Passed/Denied/Held) | M5-F01, AC-01 through AC-04 | Medium |
| C6 | **Inbound Gate Flow** — Check against expected deliveries, link to subsequent MRRV | M5-F02, AC-01 through AC-03 | Medium |
| C7 | **Material Movement Reconciliation** — Daily auto-comparison of gate movements vs inventory transactions with mismatch notification | M5-F04, AC-01 through AC-03 | High |
| C8 | **14 SOW Roles in Permission System** — Add missing roles (Technical Manager, Gate Officer, Inventory Specialist, Shipping Officer, Finance User, Customs Specialist, Compliance Officer) or map them to existing roles with equivalent permissions | M4-F03, AC-01 | Medium |
| C9 | **All 15 Notification Types** — Implement the complete notification catalog (N-01 through N-14) | M4-F05, AC-01 | Medium |

### Priority 2 — HIGH (Phase 2 UAT Blockers)

| # | Item | SOW Reference | Effort |
|---|---|---|---|
| H1 | **Supplier Performance Evaluation** — Auto-collect metrics, weighted scoring, trend tracking | M2-F05 | High |
| H2 | **Rate Cards Entity** — Standalone rate card master data with auto-pull into Job Orders | M2-F06 | Medium |
| H3 | **Equipment Delivery & Return Notes** — Dedicated entities with condition tracking, photos, cost calculation | M2-F02 | High |
| H4 | **Cycle Count Routes Activation** — Uncomment routes in index.ts, verify blind counting and NCR auto-generation at 5% variance | M1-F04 | Medium |
| H5 | **Pick List Generation** — Generate pick lists from approved MIRVs with item/qty/bin location | M1-F02 AC-04 | Medium |
| H6 | **Scheduled Report Generation** — Implement daily/weekly/monthly/quarterly auto-generation timers | M4-F07 | Medium |
| H7 | **Minimum Stock Alerting Job** — Daily threshold check with notification to Inventory Specialist + WH Manager | M1-F09 | Medium |
| H8 | **Visitor Management** — Registration, host notification, pass issuance, overstay alerts | M5-F03 | Medium |
| H9 | **Transport Order Entity** — Separate from JO, with origin/destination/load/vehicle/driver/gate pass linking | M2-F03 | Medium |

### Priority 3 — MEDIUM (Phase 3 + Best Practice Enhancements)

| # | Item | SOW Reference | Effort |
|---|---|---|---|
| M1 | **AMC (Annual Maintenance Contracts)** — Dedicated entity with renewal alerts and maintenance scheduling | M1-F12 | Medium |
| M2 | **Compliance Audit Checklists** — TUV/SGS/ISO 9001 aligned checklists with NCR/CAP workflow | M1-F11 | Medium |
| M3 | **VAT & Duties Calculation** — HS code-based duty calculation, 15% VAT auto-calc, payment workflow | M3-F04 | High |
| M4 | **Shipment Release Authorization** — Prerequisite checklist verification before release | M3-F05 | Medium |
| M5 | **Emergency Equipment Requests** — Fast-track JO bypassing WH Manager with premium cost tracking | M2-F07 | Low |
| M6 | **Access Control & Security** — Personnel lists, access event logging, security incidents | M5-F05 | High |
| M7 | **Full KPI Dashboard** — Consolidated view of all 15 target KPIs with current-vs-target comparison | M4-F11 | Medium |
| M8 | **Vehicle Maintenance** — Usage-based scheduling (hours/mileage), parts tracking, cost per vehicle | M2-F04 | Medium |
| M9 | **Customs Documentation Management** — Document checklist, HS code classification, completeness validation | M3-F02 | Medium |
| M10 | **Asset Register** — Full lifecycle tracking with depreciation, insurance, physical verification | M4-F09 | High |

### Priority 4 — LOW (Best Practice Improvements, Not in SOW)

These are industry best practices that go **beyond the SOW** but would significantly improve the platform:

| # | Item | Industry Standard | Effort |
|---|---|---|---|
| L1 | **FIFO/FEFO Picking Enforcement** | System-enforced picking order based on receipt date or expiry | Medium |
| L2 | **Expiry Date Alerts** | Auto-alerts at 30/60/90 days before expiry, auto-quarantine | Low |
| L3 | **Hijri Calendar Display** | Show Hijri dates alongside Gregorian on all date fields | Low |
| L4 | **SABER Certificate Fields** | Reference fields on shipment/customs records for SABER PCoC/SCoC | Low |
| L5 | **Weight Capture at Gates** | Manual weight entry fields on gate pass for gross/tare/net | Low |
| L6 | **Digital Signatures** | Capture signature for delivery confirmations and approvals | Medium |
| L7 | **Cost Allocation Reports** | Per-project cost breakdown across all material transactions | Medium |
| L8 | **Consumption Trend Analysis** | Historical consumption charts per item for reorder planning | Medium |
| L9 | **Demand Forecasting (rule-based)** | Moving average based reorder suggestions (NOT ML per EX-09) | Medium |
| L10 | **Full Arabic Localization** | All labels, error messages, and reports in Arabic | High |

---

## Summary Scorecard

| Module | Features | ✅ | 🟡 | ❌ | UAT Ready? |
|---|---|---|---|---|---|
| M1: Warehousing (14) | Phase 1: 6 | 2 | 4 | 0 | Needs C1-C4 fixes |
| M2: Equipment (8) | Phase 2: 5 | 0 | 3 | 2 | Needs H1-H3 |
| M3: Shipping (7) | Phase 2: 2 | 1 | 1 | 0 | Mostly ready |
| M4: Admin (12) | Phase 1: 6 | 3 | 2 | 1 | Needs C8, C9 |
| M5: Gate Pass (5) | Phase 1: 4 | 0 | 2 | 2 | Needs C5-C7 |
| **Total** | **45** | **6** | **12** | **5** | — |

**Bottom line:** The platform has strong infrastructure and exceeds SOW in many areas (dashboard builder, workflow engine, parallel approvals, semantic search). However, **9 critical items (C1-C9)** need resolution before Phase 1 UAT can succeed, and **12 cross-module data flows** are not connected. The main gaps are in gate pass verification workflows, bin card architecture, auto-linking between documents, and the complete notification catalog.

---

## Appendix: SOW Exclusions Reminder

The following are **explicitly excluded** from scope. Do NOT implement:

1. Oracle ERP Integration (EX-01)
2. Payroll Processing (EX-02)
3. Procurement/Purchasing (EX-03)
4. GPS/Live Vehicle Tracking (EX-04)
5. Barcode/RFID Hardware Scanning (EX-05)
6. Mobile-Native Application (EX-06)
7. Carrier API Integration (EX-07)
8. Financial Accounting (EX-08)
9. Machine Learning / AI (EX-09)
10. Government System Integration — ZATCA, GOSI, etc. (EX-10)
11. Invoice/Payment Tracking (EX-11)
12. MRF as Separate Form (EX-12) — *Note: MRF is currently implemented in codebase but SOW excludes it*
13. Scrap Committee Bidding (EX-13) — *Note: SSC bidding is currently implemented but SOW excludes formal committee workflow*
14. Performance Guarantees / ROI (EX-14)

**Important:** Items EX-12 (MRF) and EX-13 (SSC Bidding) are implemented in the codebase but explicitly excluded from SOW scope. These are bonus features that won't be tested during UAT, but their existence doesn't violate scope.
