# Testing Patterns

**Analysis Date:** 2026-03-22

## Test Framework

**Runner:**
- Vitest 4.0+ (all packages: frontend, backend, shared)
- Config: `vitest.config.ts` per package

**Assertion Library:**
- Vitest built-in (`expect()`)
- Frontend: @testing-library/react for DOM assertions
- Backend: None (plain expect statements)

**Run Commands:**

```bash
# Monorepo level
pnpm test                  # Run all tests across packages
pnpm test --watch         # Watch mode (if needed)

# Package level
pnpm --filter @nit-scs-v2/frontend test
pnpm --filter @nit-scs-v2/backend test
pnpm --filter @nit-scs-v2/shared test

# Individual files
cd packages/frontend && vitest run src/domains/reporting/hooks/useKpis.test.ts
```

## Test File Organization

**Location Pattern:**
- Frontend unit: `src/**/*.test.ts` or `src/**/*.test.tsx` (co-located with source)
- Frontend e2e: `e2e/**/*.spec.ts` (separate directory)
- Backend unit: `src/**/*.test.ts` (co-located with source)
- Shared: `src/**/*.test.ts` (co-located with source)

**Naming:**
- Unit tests: `{source-filename}.test.ts` (e.g., `useKpis.ts` → `useKpis.test.ts`)
- E2E tests: `{feature}.spec.ts` (e.g., `auth.spec.ts`, `forms.spec.ts`)
- No separate `__tests__` directories

**Test Organization (per file):**
```
// Imports
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Setup (mocks, fixtures)
vi.mock('./api');
const mockData = { ... };

// Test suites
describe('ComponentName', () => {
  describe('Feature X', () => {
    it('should do Y', () => { ... });
  });
});
```

## Test Structure

**Suite Organization:**

```typescript
describe('useKpis', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(http.get(`${API}/kpis`, () => ...));
  });

  it('fetches all comprehensive KPIs', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useKpis(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.inventory).toBeDefined();
  });
});
```

**Patterns:**

**Setup/Teardown:**
- `beforeEach()`: Clear mocks, reset server handlers, reset storage
- `afterEach()`: Implicit (MSW server.resetHandlers() called in test-setup.ts)
- `afterAll()`: Not typically needed (frameworks clean up)

**Mock Servers:**
- MSW (Mock Service Worker) for API mocking in frontend
- Location: `src/test-utils/msw-server.ts`
- Setup: In `test-setup.ts` with `beforeAll()`, `afterEach()`, `afterAll()`
- Handler override: `server.use(http.get(...))` in individual tests

**Hoisted Mocks:**
```typescript
// Backend pattern for dependency injection mocking
const { mockVerifyAccessToken, mockIsTokenBlacklisted } = vi.hoisted(() => {
  return {
    mockVerifyAccessToken: vi.fn(),
    mockIsTokenBlacklisted: vi.fn(),
  };
});

vi.mock('../utils/jwt.js', () => ({ verifyAccessToken: mockVerifyAccessToken }));

// After vi.mock calls, imports can reference the mocked version
import { authenticate } from './auth.js';
```

## Mocking

**Framework:**
- Unit mocks: Vitest `vi.mock()`, `vi.fn()`, `vi.mocked()`
- Server mocks: MSW (Mock Service Worker)
- Storage mocks: Manual object wrapper with vi.fn() for localStorage

**Patterns:**

**API Mocking (Frontend):**
```typescript
// In test-utils/msw-server.ts
export const server = setupServer(
  http.get('/api/v1/kpis', () =>
    HttpResponse.json({ success: true, data: { inventory: { ... } } })
  ),
);

// In individual tests
beforeEach(() => {
  server.use(
    http.get('/api/v1/kpis/:category', ({ params }) =>
      HttpResponse.json({ success: true, data: { ... } })
    ),
  );
});
```

**localStorage Mocking:**
```typescript
const storage: Record<string, string> = {};
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: vi.fn((key) => storage[key] ?? null),
    setItem: vi.fn((key, value) => { storage[key] = value; }),
    removeItem: vi.fn((key) => { delete storage[key]; }),
    clear: vi.fn(() => { Object.keys(storage).forEach(k => delete storage[k]); }),
    get length() { return Object.keys(storage).length; },
    key: vi.fn((i) => Object.keys(storage)[i] ?? null),
  },
  writable: true,
});
```

**Prisma Mocking (Backend):**
```typescript
// In test-utils/prisma-mock.ts
export interface PrismaMock {
  user: { findUnique: ReturnType<typeof vi.fn>; ... };
  // All model methods are mocked
}

export function createPrismaMock(): PrismaMock {
  return {
    user: { findUnique: vi.fn(), create: vi.fn(), ... },
    // ...
  };
}

// In tests
beforeEach(() => {
  Object.assign(mockPrisma, createPrismaMock());
});
```

**Express App Testing (Backend):**
```typescript
import { createTestApp, signTestToken } from '../test-utils/test-app.js';
import supertest from 'supertest';

const app = createTestApp();
const request = supertest(app);
const token = signTestToken({ systemRole: 'admin' });

const res = await request
  .get('/api/v1/delegations')
  .set('Authorization', `Bearer ${token}`);
```

**What to Mock:**
- External APIs (always use MSW or vi.mock)
- Database queries (Prisma mocked in backend tests)
- Redis calls (vi.mock returns null or mock object)
- JWT operations (vi.mock returns mocked payloads)
- Email sending (vi.mock to avoid side effects)

**What NOT to Mock:**
- Utility functions (use real implementations)
- Error classes (use real error types for instanceof checks)
- Zod validation (use real schemas)
- React Query QueryClient (use real with test config)
- Route registrations (test full router)

## Fixtures and Factories

**Test Data:**
```typescript
// Inline mock objects
const mockKpiResult = { value: 95, trend: 2.5, label: 'Test KPI', unit: '%' };

const mockStats = {
  pendingRequests: 5,
  activeJobs: 3,
  incomingShipments: 2,
  lowStockItems: 1,
};

// Factory functions for reusable data
const mockEmployee = {
  id: 'emp-001',
  email: 'john@example.com',
  fullName: 'John Doe',
  role: 'PROJECT_MANAGER',
  systemRole: 'ADMIN',
  isActive: true,
};
```

**Location:**
- Inline in test files (small, specific mocks)
- Separate `fixtures.ts` or `mock-data.ts` if reused across multiple test files
- Factory functions (`createMockUser()`) for data with variations

**Test Wrapper Pattern (Frontend):**
```typescript
function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

// Usage
const { result } = renderHook(() => useKpis(), { wrapper: createWrapper() });
```

## Coverage

**Requirements:**
- Lines: 60% (enforced)
- Functions: 55% (enforced)
- Branches: 50% (enforced)
- Statements: 60% (enforced)

**Configuration** (vitest.config.ts):
```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'lcov'],
  exclude: [
    'node_modules/',
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/test-setup.*',
    '**/test-app.*',
    '**/msw-*',
  ],
  thresholds: {
    lines: 60,
    functions: 55,
    branches: 50,
    statements: 60,
  },
}
```

**View Coverage:**
```bash
# Generate coverage report
cd packages/frontend && vitest run --coverage

# Open HTML report
open coverage/index.html
```

## Test Types

**Unit Tests (Frontend):**
- Location: `src/**/*.test.ts` or `src/**/*.test.tsx`
- Scope: Individual hooks, utilities, components in isolation
- Mocking: Full mock of API, localStorage, external dependencies
- Pattern: `renderHook()` for hooks, `render()` for components
- Example: `useKpis.test.ts` - tests hook behavior with mocked API responses

**Unit Tests (Backend):**
- Location: `src/**/*.test.ts`
- Scope: Services, middleware, utilities
- Mocking: Prisma, Redis, JWT, email (all dependencies)
- Pattern: Call function directly with mocked dependencies
- Example: `auth.service.test.ts` - tests service logic without database

**Integration Tests (Backend):**
- Framework: Supertest + Express test app
- Location: `src/domains/{domain}/routes/*.routes.test.ts`
- Scope: Full route handler + middleware + service chain
- Mocking: Prisma still mocked (no real database)
- Pattern: `supertest(createTestApp()).get('/api/v1/path').set('Authorization', token)`
- Example: `auth.routes.test.ts` - tests login endpoint with auth middleware

**E2E Tests (Frontend):**
- Framework: Playwright 1.52+ with Test API
- Location: `e2e/**/*.spec.ts`
- Scope: Full user workflows across pages
- Mocking: None (runs against real dev server at http://localhost:3000)
- Pattern: Page object navigation, accessibility selectors, user-like interactions
- Config: `playwright.config.ts` with project-based test ordering (auth tests depend on admin tests)
- Example: `auth.spec.ts` - tests login flow, demo buttons, password toggle, forgot password modal

## Common Patterns

**Async Testing (Frontend - React Query Hooks):**
```typescript
it('fetches data', async () => {
  const { result } = renderHook(() => useKpis(), { wrapper: createWrapper() });

  // Initially loading
  expect(result.current.isLoading).toBe(true);

  // Wait for success
  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  // Assert data
  expect(result.current.data!.data.inventory).toBeDefined();
});
```

**Async Testing (Backend - Service):**
```typescript
it('should login user successfully', async () => {
  vi.mocked(comparePassword).mockResolvedValue(true);
  vi.mocked(signAccessToken).mockReturnValue('token');

  const result = await login('test@example.com', 'password');

  expect(result.user.email).toBe('test@example.com');
  expect(result.accessToken).toBe('token');
});
```

**Async Testing (Backend - Route Integration):**
```typescript
it('should return 401 for invalid credentials', async () => {
  const res = await request
    .post('/api/v1/auth/login')
    .send({ email: 'test@example.com', password: 'wrong' });

  expect(res.status).toBe(401);
  expect(res.body.success).toBe(false);
});
```

**Error Testing:**
```typescript
// Frontend
it('handles API errors gracefully', async () => {
  server.use(
    http.get('/api/v1/kpis', () =>
      HttpResponse.error() // or HttpResponse.json({...}, { status: 500 })
    ),
  );
  const { result } = renderHook(() => useKpis(), { wrapper: createWrapper() });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.error).toBeDefined();
});

// Backend
it('throws NotFoundError when user not found', async () => {
  Object.assign(mockPrisma, createPrismaMock());
  vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(null);

  await expect(login('missing@example.com', 'password')).rejects.toThrow(NotFoundError);
});
```

**Component Testing (with user events):**
```typescript
it('submits form with valid data', async () => {
  const { getByRole, getByPlaceholderText } = render(<LoginForm />);

  const emailInput = getByPlaceholderText('email');
  await userEvent.type(emailInput, 'test@example.com');

  const submitBtn = getByRole('button', { name: /sign in/i });
  await userEvent.click(submitBtn);

  await waitFor(() => {
    expect(mockApi.login).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: '',
    });
  });
});
```

**E2E Navigation (Playwright):**
```typescript
test('admin login and navigate to dashboard', async ({ page }) => {
  await page.goto('/');
  await page.getByText('admin@nit.sa').click(); // Fill credentials
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('**/admin**', { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Executive Dashboard' })).toBeVisible();
});
```

## Resource Limits & Concurrency

**Frontend vitest.config.ts:**
```typescript
pool: 'forks',
poolOptions: {
  forks: {
    maxForks: Math.max(2, Math.floor(os.cpus().length / 2)),
  },
},
```
- Reason: jsdom environment isolation, prevent cross-test pollution

**Backend vitest.config.ts:**
```typescript
pool: 'forks',
poolOptions: {
  forks: {
    // Cap to 50% of CPU cores to prevent "socket hang up" errors
    // when multiple Express test servers start simultaneously
    maxForks: Math.max(2, Math.floor(os.cpus().length / 2)),
  },
},
```
- Reason: Each test fork creates an Express app + supertest server; too many concurrent servers fail

**Playwright playwright.config.ts:**
```typescript
fullyParallel: false,
workers: 1,
retries: 1,
timeout: 60_000,
```
- Reason: Auth tests depend on admin tests; single worker maintains ordering
- Retries: Flaky auth tests get 1 retry on failure

## Setup and Initialization

**Frontend test-setup.ts:**
```typescript
import '@testing-library/jest-dom';
import { server } from './test-utils/msw-server';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

**MSW Server (msw-server.ts):**
```typescript
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const server = setupServer(
  // Default handlers (can be overridden in tests)
  http.get('/api/v1/health', () => HttpResponse.json({ ok: true })),
);
```

**Backend test utilities (test-app.ts):**
```typescript
export function createTestApp() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(requestId);
  app.use('/api/v1', createApiRouter());
  app.use(errorHandler);
  return app;
}

export function signTestToken(overrides: TestTokenPayload = {}): string {
  return jwt.sign({ userId, email, role, systemRole, ... }, DEV_JWT_SECRET, {
    issuer: 'nit-scs',
    audience: 'nit-scs-api',
    expiresIn: '1h',
  });
}
```

---

*Testing analysis: 2026-03-22*
