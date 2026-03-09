# V2 Mission Progress

## آخر تحديث: 2026-03-09 04:36

---

## RESUME POINT
- المرحلة: Phase 7 — Frontend Cleanup & Accessibility
- آخر ملف: packages/shared/src/constants/index.ts
- الحالة: Phase 6 مكتمل (SOW alignment — approval thresholds aligned with 200K)
- التالي: Phase 7 — 67 old pages cleanup, 348/351 labels without htmlFor
- الاختبارات: 3,993/3,993 passed (0 failures, +1 new boundary test)
- آخر commit: (pending)

---

## Baseline

### Tests
| Package | Files | Tests | Status |
|---------|-------|-------|--------|
| Backend | 147 | 3,015 | ✅ ALL PASSED |
| Frontend | 81 | 663 | ✅ ALL PASSED |
| Shared | 5 | 315 | ✅ ALL PASSED |
| **Total** | **233** | **3,993** | **✅ 0 failures** |

### Build
| Package | Status | Notes |
|---------|--------|-------|
| Shared | ✅ tsc | Clean |
| Backend | ✅ tsc | Clean |
| Frontend | ✅ vite | 7.7s, 191 precache entries |

### SOW Gaps Status (C1-C9)
| # | Description | Status |
|---|-------------|--------|
| C1 | BinLocation model | ✅ DONE |
| C2 | Computed bin cards | ✅ DONE |
| C3 | Auto pick list on MI | ✅ DONE |
| C4 | Inbound gate deliveries | ✅ DONE |
| C5 | Gate-vs-inventory reconciliation | ✅ DONE |
| C6 | Row-owner scope filtering | ✅ DONE |
| C7 | 7 SOW roles | ✅ DONE |
| C8 | 14 notification types | ✅ DONE |
| C9 | Approval thresholds | ✅ ALIGNED (Level 3 max = 200K, WH Supervisor maxLevel = 3) |

### Security Status
| Issue | Status |
|-------|--------|
| SSRF protection | ✅ FIXED |
| $queryRawUnsafe | ✅ FIXED + ESLint ban |
| xlsx vulnerabilities | ✅ FIXED (exceljs) |
| Safe status transitions | ✅ FIXED |
| localStorage tokens | ✅ FIXED (httpOnly cookies) |
| CSRF protection | ❌ NOT FIXED |
| requirePermission gaps | ✅ FIXED (~31 routes secured) |

### Frontend Status
| Item | Status |
|------|--------|
| routes.tsx split | ✅ DONE (30 LOC + 8 domain files) |
| formConfigs.ts split | ✅ DONE (90 LOC + 7 domain configs) |
| Silent catches | ✅ DONE (23 → 0) |
| Hooks migration | ✅ DONE |
| Pages in old `pages/` | ❌ 67 remain |
| `as unknown as` casts | ✅ 15 remaining (was 425, target <20) |
| htmlFor accessibility | ❌ 3/351 labels (0.9%) |

### Known Issues Summary
| Severity | Count | Status |
|----------|-------|--------|
| Critical | 3 | ✅ Done |
| High | 10 | ⚠️ 1 Pending (10) |
| Medium | 5 | ❌ Pending |
| Resolved | 20 | ✅ Done |

### Architecture
- 14 backend domains | 120+ Prisma models | 250+ API endpoints
- 23 frontend domains | 437 source files | 89 components | 67 pages
- 17 roles | 14 notification types | 22 state machine document types

### CLI Tools Available
| Tool | Status | Path |
|------|--------|------|
| claude | ✅ AVAILABLE | ~/.local/bin/claude |
| opencode | ✅ AVAILABLE | ~/.opencode/bin/opencode |
| codex | ✅ AVAILABLE | ~/.npm-global/bin/codex |
| gemini | ✅ AVAILABLE | ~/.npm-global/bin/gemini |
| perplexity | ✅ Desktop App | Perplexity.app |

---

## Execution Phases — All PENDING

### Phase 1: Transaction Safety & Data Integrity — ✅ DONE
#### ما تم
- GRN store(), ST ship/receive(), MRN complete() — status + stock عمليات atomic الآن
- MI/MIRV approve() — reservation + line updates + MI header update atomic
- MI/MIRV issue() — consumeReservationBatch + line costs + status + GatePass atomic
- Cycle count applyAdjustments() — optimistic locking مصلح (updateLevelWithVersion)
- Inventory batch functions تقبل externalTx اختياري للتركيب في transactions أكبر
- 6 test files محدّثة لتتوافق مع الأنماط الجديدة
#### قرارات معمارية
- قرار: Optional externalTx بدل Tx functions منفصلة — backward compatible، أقل تكرار
### Phase 2: Security Hardening — ✅ DONE
#### ما تم
- Frontend migrated from localStorage to httpOnly cookie auth (withCredentials: true)
- ~31 routes secured with requirePermission middleware
- Factory routes got `resource:` field for automatic RBAC
- Custom routes got explicit requirePermission per-endpoint
- Added cycle_count resource to 5 roles in shared/permissions.ts
- 6 test files updated to mock hasPermissionDB
#### قرارات معمارية
- قرار: Two-pronged RBAC — factory routes use `resource:` field, custom routes use explicit middleware
- CSRF deferred to later phase (MEDIUM priority, needs research on SPA best practices)
### Phase 3: V1/V2 Unification — ✅ DONE
#### ما تم
- 6 V1 service files converted to thin re-exports of V2 services (~2,600 LOC → ~60 LOC)
  - mrrv.service.ts → re-exports grn.service.ts
  - mirv.service.ts → re-exports mi.service.ts
  - mrv.service.ts → re-exports mrn.service.ts
  - mrf.service.ts → re-exports mr.service.ts
  - rfim.service.ts → re-exports qci.service.ts
  - osd.service.ts → re-exports dr.service.ts
- mi.routes.ts fixed: was importing mirv.service (V1), now imports mi.service (V2)
- bulk.service.ts migrated to V2 imports + V2 docType aliases (grn/mrrv both work)
- 6 V1 test files deleted (redundant with V2 tests)
- 7 V2 test files fixed (imports, assertions, mocks)
- 12 frontend files migrated from V1 hooks to V2 hooks
- useDocumentForm.ts updated to use V2 hooks directly
#### قرارات معمارية
- قرار: Re-export pattern — V1 services become thin re-exports of V2 services
  - السبب: أقل كود، backward compatible، تلقائي لكل المستهلكين
  - البدائل: Import-and-delegate (أكثر boilerplate بلا فائدة)
- V1 route paths preserved as aliases — backward compatibility per MISSION requirements
### Phase 4: N+1 & Performance — ✅ DONE
#### ما تم
- Added `getStockLevelsBatch()` to inventory.service.ts — single query for multiple (itemId, warehouseId) pairs
- Refactored `checkStock()` in mr.service.ts to use batch queries instead of N+1 loops
  - Primary check: N×W individual queries → 1 batch query
  - Cross-project check: N×P×W individual queries → 1 batch query
  - Line updates: N individual writes → 1 atomic $transaction
- Added 4 new tests for getStockLevelsBatch (empty input, multi-pair, missing pairs, deduplication)
- Updated 7 existing checkStock tests to verify batch API
#### قرارات معمارية
- قرار: Batch findMany with OR clause instead of Promise.all of findUnique calls
  - السبب: Single round-trip to DB, uses existing composite unique index, deduplicates pairs automatically
  - البدائل: Promise.all (still N queries in parallel — fewer round-trips but high DB load)
### Phase 5: Type Safety — ✅ DONE
#### ما تم
- Created `packages/frontend/src/utils/type-helpers.ts` — centralized type assertion helpers (toRows, extractRows, toRecord)
- Created `packages/backend/src/utils/prisma-helpers.ts` — type-safe dynamic Prisma delegate accessor (getPrismaDelegate)
- Fixed ~60 frontend files: replaced `as unknown as Record<string, unknown>[]` patterns with helpers
- Fixed ~22 backend files: replaced Prisma dynamic access, JSON field typing, and route handler casts
- Added `parseStatusFlow()` helper in dynamic-document.service.ts for JSON field typing
- Simplified many `as unknown as X` to `as X` where TypeScript allows direct cast
- Production casts reduced: **425 → 15** (96.5% reduction)
#### 15 remaining casts (documented):
- cross-dock.service.ts (5): Prisma include returns branded client type
- custom-data-source.service.ts (2): QueryTemplate → Prisma.InputJsonValue
- transport-order.routes.ts (2): Zod-validated body → DTO structural mismatch
- 5 frontend components (1 each): NavItem→NavSection, Condition→Record, etc.
#### قرارات معمارية
- قرار: Centralized helper functions (toRows, extractRows, toRecord, getPrismaDelegate) instead of fixing each cast individually
  - السبب: Single point of truth for type assertions, easy to audit, all casts in utility files
  - البدائل: Fix each cast individually (more work, harder to maintain), add index signatures to all types (too invasive)
### Phase 6: SOW Alignment — ✅ DONE
#### ما تم
- MI Level 3 maxAmount: 100K → 200K (SOW 200K threshold aligned)
- MI Level 4 minAmount: 100K → 200K (shifted up)
- Levels 1-3 roleName changed to warehouse_supervisor (can approve up to 200K)
- warehouse_supervisor maxApprovalLevel: 1 → 3 (covers up to 200K per SOW)
- Added boundary test for 150K (Level 3 under SOW 200K)
- All C1-C9 SOW gaps now resolved
#### قرارات معمارية
- قرار: Keep 5-tier system (exceeds SOW) but align the 200K boundary
  - السبب: Multi-tier is more granular and configurable than SOW's single threshold
  - البدائل: Simplify to 2-tier (0-200K, 200K+) — loses granularity, hurts audit trail
### Phase 7: Frontend Cleanup & Accessibility — PENDING
### Phase 8: Error Handling & Polish — PENDING
### Phase 9: Deep Inspection & File Cleanup — PENDING
### Phase 10: Test Expansion — PENDING
### Phase 11: Dynamic & Automation Verification — PENDING
### Phase 12: Research & Benchmark — PENDING
### Phase 13: Final Verification — PENDING
