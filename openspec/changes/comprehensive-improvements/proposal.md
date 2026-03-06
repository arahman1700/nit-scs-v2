## Why

The NIT Supply Chain V2 system has solid fundamentals but faces three categories of improvement needs: security vulnerabilities (localStorage token exposure, missing CSRF protection), performance bottlenecks (broad React Query invalidations, large unsplit components), and UX gaps (missing inline validation, no skeleton loaders). Addressing these now prevents technical debt accumulation as the system scales.

## What Changes

- **BREAKING**: Move access token from localStorage to httpOnly cookie — all API calls switch from Authorization header to cookie-based auth
- Add CSRF protection using double-submit cookie pattern for state-changing requests
- Add per-user rate limiting on `/auth/refresh` endpoint
- Normalize React Query key builders and implement selective cache invalidation
- Code-split large dashboard/admin components (AdminDashboard 717 lines, AdminResourceList 1080 lines)
- Add field-level inline validation feedback in document forms
- Implement skeleton loaders for data-heavy tables (LineItemsTable, SmartGrid)
- Add optimistic UI updates for mutation operations (approve, delete, submit)

## Capabilities

### New Capabilities
- `secure-token-storage`: Move access token to httpOnly cookie with CSRF double-submit pattern, replacing localStorage-based auth
- `query-optimization`: Normalize queryKey builders, selective invalidation, and request deduplication across React Query hooks
- `inline-form-validation`: Real-time field-level validation feedback in document forms using React Hook Form dirty/touched state
- `skeleton-loading`: Reusable skeleton loader components for tables, cards, and form sections

### Modified Capabilities
<!-- No existing specs to modify -->

## Impact

- **Backend auth middleware**: Token extraction switches from `Authorization` header to cookie parsing; CSRF validation middleware added to all mutating routes
- **Frontend API client**: Axios interceptor changes — remove manual token injection, add `withCredentials: true`, add CSRF token header
- **React Query hooks**: All hook files in `src/api/hooks/` updated for new queryKey patterns and selective invalidation
- **Component bundle**: AdminDashboard, AdminResourceList, InventoryDashboard split into lazy-loaded sub-components
- **Form components**: useDocumentForm hook extended with inline validation; all form pages gain skeleton states
- **Dependencies**: No new dependencies required — uses existing libraries (React Hook Form, React Query, Express middleware)
