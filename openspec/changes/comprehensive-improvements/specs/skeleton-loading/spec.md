## ADDED Requirements

### Requirement: Reusable skeleton components
The system SHALL provide a set of skeleton loading components: `SkeletonCard`, `SkeletonTable`, and `SkeletonForm`. These components MUST match the Nesma dark theme (bg-white/10, animate-pulse).

#### Scenario: SkeletonCard renders placeholder
- **WHEN** a dashboard KPI card is loading
- **THEN** SkeletonCard renders a glass-card container with pulsing placeholder blocks matching the KPI card layout

#### Scenario: SkeletonTable renders row placeholders
- **WHEN** a data table is loading
- **THEN** SkeletonTable renders a configurable number of placeholder rows with column-width blocks

#### Scenario: SkeletonForm renders field placeholders
- **WHEN** a document form is loading initial data
- **THEN** SkeletonForm renders placeholder blocks for labels, inputs, and action buttons matching the form layout

### Requirement: Automatic skeleton display during data fetch
React Query-powered components SHALL display skeleton loaders during initial data fetches (`isLoading` state). Subsequent refetches SHALL show a subtle loading indicator without replacing content.

#### Scenario: First load shows skeleton
- **WHEN** a page loads and queries have no cached data
- **THEN** skeleton components are displayed until data arrives

#### Scenario: Refetch shows subtle indicator
- **WHEN** a page refetches data (background revalidation)
- **THEN** existing content remains visible with a subtle top-bar progress indicator

### Requirement: Code-split large page components
AdminDashboard, AdminResourceList, and InventoryDashboard SHALL be split into lazy-loaded sub-components using React.lazy() with Suspense fallbacks showing appropriate skeleton loaders.

#### Scenario: AdminDashboard lazy loads tab content
- **WHEN** user navigates to admin dashboard
- **THEN** the page shell renders immediately and tab content loads lazily with skeleton fallback

#### Scenario: Slow network shows skeleton gracefully
- **WHEN** network is slow (>1s) loading a lazy component
- **THEN** skeleton is displayed without layout shift when content arrives
