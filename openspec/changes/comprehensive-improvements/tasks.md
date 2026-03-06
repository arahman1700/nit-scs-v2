## 1. Secure Token Storage — Backend

- [ ] 1.1 Add cookie-setting logic to login endpoint (httpOnly, Secure, SameSite=Strict)
- [ ] 1.2 Add cookie-setting logic to refresh endpoint
- [ ] 1.3 Add cookie-clearing logic to logout endpoint
- [ ] 1.4 Update auth middleware to read token from cookie (with Authorization header fallback)
- [ ] 1.5 Generate and set CSRF token cookie (non-httpOnly) on login
- [ ] 1.6 Add CSRF validation middleware for POST/PUT/PATCH/DELETE routes
- [ ] 1.7 Add per-user rate limiting on /auth/refresh endpoint
- [ ] 1.8 Write backend auth tests for cookie + CSRF flow

## 2. Secure Token Storage — Frontend

- [ ] 2.1 Update Axios client to use `withCredentials: true`
- [ ] 2.2 Add Axios request interceptor to read csrf_token cookie and set X-CSRF-Token header
- [ ] 2.3 Remove localStorage token storage from auth context/hooks
- [ ] 2.4 Update login/logout handlers to work with cookie-based auth
- [ ] 2.5 Verify auth flow works end-to-end (login → API calls → refresh → logout)

## 3. React Query Optimization

- [ ] 3.1 Create queryKeyFactory utility function in src/api/hooks/
- [ ] 3.2 Refactor createResourceHooks to use queryKeyFactory
- [ ] 3.3 Update mutation onSuccess callbacks to use selective invalidation
- [ ] 3.4 Add optimistic update for delete operations in createResourceHooks
- [ ] 3.5 Add optimistic update for status-change operations (approve, submit)
- [ ] 3.6 Verify cache behavior with React Query DevTools

## 4. Inline Form Validation

- [ ] 4.1 Extend useDocumentForm hook with field-level touched/dirty tracking
- [ ] 4.2 Add debounced validation trigger (500ms) for pattern-constrained fields
- [ ] 4.3 Create InlineFieldError component (red for blocking, amber for warnings)
- [ ] 4.4 Create ValidationSummary component with scroll-to-field links
- [ ] 4.5 Integrate inline validation into existing document form pages
- [ ] 4.6 Add confirmation dialog for submit-with-warnings flow

## 5. Skeleton Loading Components

- [ ] 5.1 Create SkeletonCard component matching KPI card layout
- [ ] 5.2 Create SkeletonTable component with configurable rows/columns
- [ ] 5.3 Create SkeletonForm component matching document form layout
- [ ] 5.4 Add subtle top-bar progress indicator for background refetches

## 6. Code Splitting Large Components

- [ ] 6.1 Split AdminDashboard into lazy-loaded tab sub-components
- [ ] 6.2 Split AdminResourceList into lazy-loaded sections
- [ ] 6.3 Split InventoryDashboard into lazy-loaded tab sub-components
- [ ] 6.4 Add Suspense boundaries with skeleton fallbacks to each split point
- [ ] 6.5 Verify no layout shift occurs when lazy content loads

## 7. Integration Testing & Cleanup

- [ ] 7.1 Run full e2e test suite to verify no regressions
- [ ] 7.2 Remove Authorization header fallback from backend (Phase 3 cleanup)
- [ ] 7.3 Remove any remaining localStorage token references
- [ ] 7.4 Update API documentation for cookie-based auth
