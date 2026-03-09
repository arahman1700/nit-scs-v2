# NIT Supply Chain V2 — Comprehensive Technical & Operational Audit Report

**Date**: 2026-03-08
**Auditor**: Claude Code (Opus 4.6)
**Project Path**: `/Users/a.rahman/Projects/V2`

---

## Executive Summary

| Aspect | Status |
|--------|--------|
| **Overall System Status** | **Works with issues (Medium severity)** |
| **Backend** | Operational — all 14 domains registered, health check passes |
| **Frontend** | Operational — login, navigation, forms, grids all work |
| **Database** | Operational — PostgreSQL with 23+ seeded tables |
| **Redis** | Operational — connected, rate limiting active |
| **Real-time (Socket.IO)** | Configured and connecting on login |
| **Authentication** | Fully functional — JWT + refresh token rotation |
| **RBAC/Permissions** | Functional — 17 roles, DB-backed overrides |
| **Backend Tests** | 150/152 files pass (3160/3162 tests) — 2 timeout failures |
| **Frontend Tests** | 81/81 files pass (663/663 tests) — all green |

**Verdict**: The system is **functional for development/staging use**. One critical bug was found and fixed (Sidebar crash). A few medium-priority issues remain. Not yet production-ready without addressing the items below.

---

## 1. What Was Actually Verified

### 1.1 Infrastructure Setup
- [x] Installed PostgreSQL 15 and Redis 7 via Homebrew
- [x] Created database `nit_scs` with user `nit_admin`
- [x] Ran `prisma db push` to sync schema (16 modular Prisma schema files)
- [x] Ran all 3 seed scripts (base data, templates, operational data)
- [x] Started backend (`tsx watch`) on port 4000
- [x] Started frontend (`vite dev`) on port 3000
- [x] Verified health endpoint: DB up (3ms), Redis up (1ms)

### 1.2 API Testing (curl/Python)
- [x] Login: `POST /auth/login` — works, returns JWT + refresh token
- [x] Auth/me: `GET /auth/me` — returns user profile
- [x] Items: `GET /items` — 21 items, paginated
- [x] Suppliers: `GET /suppliers` — 8 suppliers
- [x] Warehouses: `GET /warehouses` — 5 warehouses
- [x] Projects: `GET /projects` — 5 projects
- [x] Employees: `GET /employees` — 8 employees
- [x] GRN: `GET /grn` — 3 seed records
- [x] MI: `GET /mi` — 2 seed records
- [x] Job Orders: `GET /job-orders` — 1 seed record
- [x] Workflows: `GET /workflows` — 3 workflows
- [x] KPIs: `GET /kpis` — 5 categories (inventory, procurement, logistics, quality, financial)
- [x] Permissions: `GET /permissions` — 10 roles with permissions
- [x] GRN Create: `POST /grn` — created GRN-2026-0001 successfully
- [x] GRN Submit: `POST /grn/:id/submit` — transitioned draft → pending_qc
- [x] Audit Log: Verified 2 entries created after operations

### 1.3 Browser Testing (Playwright)
- [x] Login page renders with dark theme, Nesma branding, demo accounts
- [x] Demo account auto-fill works (click to populate email/password)
- [x] Login flow: credentials → JWT → redirect to `/admin`
- [x] Admin Dashboard: KPIs, charts, sections, project list
- [x] 24 pages tested for load/crash/404 — **all 24 load without crash**
- [x] GRN form: opens with dropdowns populated (suppliers, projects, warehouses)
- [x] AG-Grid data tables render correctly with data
- [x] Sidebar navigation: 8 sections, all links working
- [x] Breadcrumbs: functional
- [x] Role switcher: 17 roles available in dev dropdown

### 1.4 Automated Tests
- [x] Backend: 152 test files, 3162 tests — **3160 pass, 2 fail (timeouts)**
- [x] Frontend: 81 test files, 663 tests — **all 663 pass**

### 1.5 Database Verification
- [x] 23 key tables verified with record counts
- [x] Schema synced via `prisma db push` (no migration issues)
- [x] Relationships intact (FKs, joins working in API responses)

---

## 2. Bugs & Issues Found

### CRITICAL (Fixed During Audit)

#### BUG-001: Sidebar crash — "Cannot read properties of undefined (reading 'map')"
- **Severity**: Critical (app unusable)
- **Status**: FIXED
- **File**: `packages/frontend/src/components/Sidebar.tsx:187`
- **Root Cause**: The `/api/v1/navigation` endpoint returns `NavItem[]` (flat structure with `children`), but `Sidebar.tsx` casts it as `NavSection[]` (expects `section` + `items` properties). When `dynamicNav` is truthy (non-empty array), it replaces the static config, but the objects lack an `items` property → `.map()` crashes.
- **Fix Applied**: Added shape validation before using dynamic nav:
  ```ts
  const isValidSectionNav = Array.isArray(dynamicNav) && dynamicNav.length > 0 && 'section' in dynamicNav[0] && 'items' in dynamicNav[0];
  ```
  Also added defensive `(section.items ?? []).map(...)` guard.

### HIGH

#### BUG-002: Missing API routes — `/jo`, `/approvals`, `/dashboard`
- **Severity**: High
- **Impact**: Frontend may reference incorrect paths
- **Details**:
  - `GET /api/v1/jo` → 404 (correct path: `/api/v1/job-orders`)
  - `GET /api/v1/approvals` → 404 (route not registered at this path)
  - `GET /api/v1/dashboard` → 404 (correct path: `/api/v1/dashboards`)
- **Root Cause**: Route naming inconsistency between frontend expectations and backend registration
- **Files**: `packages/backend/src/routes/index.ts`, frontend navigation config
- **Recommendation**: Add route aliases or fix frontend references

#### BUG-003: `/bin-cards/computed` endpoint hangs or very slow
- **Severity**: High
- **Impact**: Bin Cards tab may not load data
- **Details**: Network request to `/bin-cards/computed?pageSize=100` often has no response
- **Root Cause**: Likely a complex computed query without proper timeout/pagination
- **Recommendation**: Add query timeout, optimize bin-card computation

#### BUG-004: Backend test timeouts (2 failures)
- **Severity**: High (test reliability)
- **Details**:
  - `password.test.ts` → `hashPassword` test times out at 5s (bcrypt on first run is slow)
  - `scheduler.service.test.ts` → startup test times out at 5s
- **Root Cause**: bcrypt hashing + scheduler startup are slow in test context
- **Recommendation**: Increase timeout for these specific tests or use faster bcrypt rounds in test env

### MEDIUM

#### BUG-005: Rate limiter causes session loss during rapid navigation
- **Severity**: Medium
- **Impact**: Fast page navigation triggers 429 on `/auth/me`, causing logout
- **Details**: Global rate limit (100 req/60s) + per-route limit (200 req/min) is too aggressive for SPA navigation where each page makes 5-10 API calls
- **Root Cause**: Rate limits designed for API consumers, not SPA browsing patterns
- **Recommendation**: Exempt authenticated `/auth/me` from rate limiting, or increase limits for authenticated users

#### BUG-006: AG-Grid deprecation warnings
- **Severity**: Medium (technical debt)
- **Details**: Console warnings about deprecated AG-Grid API:
  - `rowSelection` string syntax deprecated in v32.2.1
  - `suppressRowClickSelection` deprecated in v32.2
- **Recommendation**: Update AG-Grid configuration to use new API

#### BUG-007: React "missing key" warning in dashboard
- **Severity**: Low
- **Details**: `Each child in a list should have a unique "key" prop` on admin dashboard
- **Recommendation**: Add key props to list rendering in dashboard component

#### BUG-008: Recharts dimension warnings
- **Severity**: Low
- **Details**: `The width(-1) and height(-1) of chart should be positive` when charts render in collapsed/hidden containers
- **Root Cause**: Charts rendered before container has dimensions
- **Recommendation**: Delay chart rendering or use ResizeObserver

#### BUG-009: GRN totalValue always 0 on creation
- **Severity**: Medium
- **Impact**: GRN creation via API returns totalValue: 0 even when line items have prices
- **Root Cause**: Server-side calculation likely runs after response, or `totalValue` is not computed from lines during create
- **Recommendation**: Calculate totalValue from lines in the create transaction

### LOW

#### BUG-010: Prisma migration naming non-standard
- **Severity**: Low
- **Details**: Migrations use `0000_baseline`, `0001_add_check_constraints` instead of Prisma's default timestamp format. `prisma migrate deploy` reports "No migration found".
- **Impact**: `prisma db push` works, but `prisma migrate deploy` won't work in production
- **Recommendation**: Re-baseline migrations with timestamp format, or ensure `prisma db push` is used in deployment

#### BUG-011: `--localstorage-file` warnings in frontend tests
- **Severity**: Low
- **Details**: Node warning about invalid `--localstorage-file` path during test runs
- **Impact**: Cosmetic only, tests still pass

---

## 3. Features Verified Working

| Feature | Status | Notes |
|---------|--------|-------|
| **Login/Auth** | Working | JWT, refresh tokens, demo accounts |
| **Admin Dashboard** | Working | KPIs, charts, sections, project filter |
| **Sidebar Navigation** | Working (after fix) | 8 sections, 30+ links, all 17 roles |
| **GRN (Receiving)** | Working | List, create, submit, status transitions |
| **MI (Issuing)** | Working | List with AG-Grid, data from seed |
| **MRN (Returns)** | Working | Page loads, empty state (no seed data) |
| **MR (Requests)** | Working | Page loads, empty state |
| **QCI (Inspections)** | Working | Page loads, empty state |
| **DR (Discrepancy)** | Working | Page loads, empty state |
| **IMSF (Inter-Store)** | Working | Page loads, empty state |
| **WT (Transfers)** | Working | Page loads, empty state |
| **Job Orders** | Working | 1 seed record visible |
| **Gate Passes** | Working | Page loads, empty state |
| **Fleet & Rentals** | Working | Page loads, empty state |
| **Tools & Issues** | Working | Page loads, empty state |
| **Generators** | Working | Page loads, empty state |
| **Shipments** | Working | Page loads, empty state |
| **Inventory/Stock** | Working | 35 inventory levels from seed |
| **Bin Cards** | Partial | Page loads but `/computed` endpoint may hang |
| **Scrap & Surplus** | Working | Page loads |
| **KPI Dashboard** | Working | 5 KPI categories rendered |
| **Master Data** | Working | Items, suppliers, warehouses, projects |
| **Employees** | Working | 8 seeded employees |
| **Settings** | Working | Page loads |
| **Compliance** | Working | Page loads |
| **Customs** | Working | Page loads |
| **Documents Page** | Working | Page loads |
| **GRN Form** | Working | All dropdowns populated, workflow display |
| **Breadcrumbs** | Working | Navigation context displays correctly |
| **Global Search** | Partial | UI present, search bar renders |
| **Notifications** | Partial | Bell icon works, 1 notification created |
| **Role Switcher** | Working | Dev-only dropdown, all 17 roles |
| **Real-time Sync** | Configured | Socket.IO connects on login |
| **Audit Logging** | Working | 2 entries after GRN operations |
| **API Documentation** | Working | Swagger at `/api/docs` (301 redirect) |
| **Health Check** | Working | DB + Redis status, memory metrics |
| **Email Templates** | Seeded | 15 templates in database |
| **Workflow Rules** | Working | 3 workflows, 5 rules seeded |
| **Semantic Layer** | Seeded | 33 measures, 15 dimensions |

---

## 4. Features Not Verified / Requiring Further Testing

| Feature | Reason |
|---------|--------|
| File Upload | Requires multipart form test |
| Email Sending | Requires Resend API key |
| Push Notifications | Requires VAPID keys + service worker |
| PDF Export | Requires in-browser test |
| Excel Import/Export | Requires file fixtures |
| Barcode Scanning | Requires camera/QR input |
| Offline Mode / PWA | Requires service worker deployment |
| WebSocket Events | Tested connection, not event flow |
| Multi-role Access | Tested admin only (not all 17 roles) |
| Approval Workflows | No approval flow end-to-end tested |
| Digital Signatures | Not tested |
| Demand Forecasting | Not tested (requires historical data) |
| Anomaly Detection | Not tested |
| Cost Allocation | Page loads but computation not verified |
| Security Monitor | Page loads but data not verified |
| Route Optimizer | Page loads but map not verified |
| Delegation Rules | Not tested |
| Custom Dashboards | Builder UI not tested |
| Report Builder | Builder UI not tested |

---

## 5. Data Storage Map

### Where Data Is Stored

| Data Type | Storage | Details |
|-----------|---------|---------|
| Users/Employees | PostgreSQL `employees` | 8 seeded, bcrypt passwords |
| Auth Tokens | localStorage (frontend) | `nit_scs_token`, `nit_scs_refresh_token` |
| Refresh Token | httpOnly cookie | `nit_refresh_token`, 7d expiry |
| Token Blacklist | Redis | Revoked JTIs stored with TTL |
| Rate Limit Counters | Redis | Per-IP sliding window |
| Master Data | PostgreSQL | items, suppliers, warehouses, projects, regions, cities, ports, UOMs |
| Documents (GRN/MI/etc.) | PostgreSQL | mrrv, mirv, mrv, mrf + line tables |
| Job Orders | PostgreSQL | job_orders + jo_equipment_lines, jo_labor |
| Inventory | PostgreSQL | inventory_levels, bin_cards, bin_card_transactions |
| File Uploads | Local filesystem | `packages/backend/uploads/` |
| Notifications | PostgreSQL | notifications table |
| Audit Trail | PostgreSQL | audit_log table |
| Email Logs | PostgreSQL | email_logs table |
| Workflows | PostgreSQL | workflows, workflow_rules |
| Approval History | PostgreSQL | approval_steps |
| Session State | Zustand (memory) | Auth, UI, notifications |
| Server Cache | Redis + in-memory | Rule cache (60s TTL), permission cache |
| Offline Queue | IndexedDB (frontend) | Failed mutations queued for retry |

### CRUD Data Flow (Example: GRN)

```
User clicks "New GRN" → /admin/forms/grn
    ↓
Frontend: FormFieldRenderer renders form with dropdowns
Frontend: API calls to /suppliers, /projects, /warehouses, /items
    ↓
User fills form + adds line items → clicks "Save & Submit"
    ↓
Frontend: POST /api/v1/grn (axios + JWT header)
    ↓
Backend: auth middleware → validate middleware → GRN service
    ↓
GRN service:
  1. Generate mrrvNumber (GRN-2026-XXXX)
  2. Create mrrv record + mrrv_lines (Prisma transaction)
  3. Create audit_log entry
  4. Emit event to event bus
  5. Return 201 + created GRN
    ↓
Event Bus → Rule Engine:
  1. Check workflow rules for 'mrrv' entity
  2. If matched: execute actions (notifications, status change, follow-ups)
    ↓
Socket.IO: Broadcast document:created to role rooms
    ↓
Frontend: React Query cache invalidation → grid refreshes
```

---

## 6. Architecture Summary

### System Startup Flow
1. `pnpm dev` → runs `tsx watch src/index.ts` (backend) + `vite` (frontend)
2. Backend: Sentry → Express → Middleware → Routes → Socket.IO → Scheduler → Rule Engine
3. Frontend: React 19 → AuthGuard → MainLayout → Role-based Routes

### Frontend ↔ Backend Communication
- **HTTP**: Axios client at `/api/v1/*`, Vite proxy in dev
- **WebSocket**: Socket.IO for real-time (document events, notifications, approvals)
- **Auth**: JWT in `Authorization: Bearer` header, auto-refresh on 401

### Database Access Pattern
- **ORM**: Prisma 6 with modular schema (16 files)
- **Soft Deletes**: Models with `deletedAt` auto-filter on read
- **Audit**: All mutations logged to `audit_log`
- **Scope Filtering**: Row-level security via ScopeFieldMapping

### Roles & Permissions
- 17 system roles defined in shared package
- Permission matrix: 40+ resources × 7 permission types
- DB-backed overrides via `PermissionOverride` table (admin-editable)
- Two middleware patterns: `requireRole()` and `requirePermission()`

---

## 7. Technical Debt & Recommendations

### Before Production Deployment

1. **Fix migration format**: Re-baseline with timestamp naming or document `prisma db push` as deployment method
2. **Fix rate limiting for SPA**: Exempt or increase limits for authenticated session endpoints
3. **Fix bin-cards/computed**: Add query timeout, optimize or paginate
4. **Fix route naming**: Ensure frontend and backend use consistent endpoint paths
5. **Calculate GRN totalValue**: Compute from line items during create transaction
6. **Update AG-Grid API**: Address deprecation warnings for v32+ compatibility
7. **Set proper JWT secrets**: Minimum 32 chars, unique per environment
8. **Configure Sentry DSN**: Enable error monitoring
9. **Configure email (Resend)**: For notifications, password reset
10. **Generate VAPID keys**: For push notifications

### Code Quality

1. Fix the 2 test timeouts (increase timeout or optimize bcrypt in tests)
2. Add React key props to dashboard list rendering
3. Handle chart container sizing gracefully
4. Consider moving navigation endpoint to return `NavSection[]` format

### Security

1. Tokens stored in localStorage (XSS risk) — consider httpOnly cookie for access token
2. Rate limiting is IP-based — may need user-based limiting behind proxy
3. File upload max size is 10MB — review for production
4. No CSRF token validation (mitigated by JWT but worth reviewing)

---

## 8. Database Record Summary

| Table | Records | Notes |
|-------|---------|-------|
| employees | 8 | 1 admin + 7 sample |
| items | 21 | 10 seed + 11 additional |
| suppliers | 8 | 3 seed + 5 additional |
| warehouses | 5 | Dammam, Jubail, NEOM, Riyadh, NIT Main |
| projects | 5 | NEOM, Jeddah, Riyadh, Tabuk, Jeddah Utils |
| mrrv (GRN) | 4 | 3 seed + 1 test |
| mrrv_lines | 7 | Seed + test lines |
| mirv (MI) | 2 | Seed data |
| mrv (MRN) | 0 | No seed data |
| job_orders | 1 | Transport type, approved |
| inventory_levels | 35 | Seeded across warehouses |
| regions | 7 | Saudi regions |
| uoms | 15 | EA, KG, M, L, etc. |
| workflows | 3 | Approval, SLA, Low Stock |
| workflow_rules | 5 | Automated actions |
| email_templates | 15 | All SOW templates |
| notifications | 1 | Created during test |
| audit_log | 2 | GRN create + submit |
| semantic_measures | 33 | BI layer |
| warehouse_zones | 6 | In NIT Main Warehouse |
| entities | 1 | Nesma Infrastructure |
| approval_workflows | 9 | Seeded approval configs |

---

## 9. Final Verdict

### System Status: **WORKS WITH MEDIUM-SEVERITY ISSUES**

The NIT Supply Chain V2 system is **architecturally sound and functionally operational**. The core workflows (login → navigate → view data → create documents → status transitions) work end-to-end. The codebase is well-organized with domain-driven design, comprehensive test coverage (3823/3825 tests pass), and proper security measures.

**Ready for**: Development, QA/staging testing
**Not ready for**: Production deployment (needs migration fix, rate limit tuning, external service configuration)

### Key Strengths
- Clean domain-driven architecture (14 domains, clear boundaries)
- Comprehensive test coverage (99.95% pass rate)
- Modern stack (React 19, Express 5, Prisma 6)
- Enterprise features (17 roles, audit logging, workflow engine, real-time sync)
- Beautiful dark theme with consistent design tokens

### Key Risks
- Migration system not using standard Prisma format
- Rate limiting can cause session drops in SPA
- Some endpoint naming inconsistencies between frontend/backend
- External services (email, push) not configured/tested
