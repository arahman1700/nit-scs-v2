# Coding Conventions

**Analysis Date:** 2026-03-22

## Naming Patterns

**Files:**
- React components: PascalCase (e.g., `KpiCard.tsx`, `ConfirmDialog.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useDashboards.ts`, `useKpis.ts`)
- Utilities/services: camelCase (e.g., `auth.service.ts`, `password.ts`, `response.ts`)
- Test files: Match source with `.test.ts` or `.spec.ts` extension (e.g., `auth.service.test.ts`, `auth.spec.ts`)
- Routes: camelCase with `routes` suffix (e.g., `auth.routes.ts`, `permissions.routes.ts`)
- Directories: kebab-case (e.g., `test-utils/`, `report-builder/`, `smart-grid/`)

**Functions:**
- Async function handlers: descriptive verb phrases (e.g., `login()`, `refreshTokens()`, `sendTemplatedEmail()`)
- React component names: PascalCase exported function (e.g., `export const KpiCard: React.FC<KpiCardProps> = ...`)
- Hook functions: `use` prefix in camelCase (e.g., `useDashboards()`, `useKpisByCategory()`)
- Middleware functions: verb-noun pattern (e.g., `authenticate`, `validateRequest`, `rateLimiter`)

**Variables:**
- Constants in services: SCREAMING_SNAKE_CASE for module-level constants (e.g., `TOKEN_BLACKLIST_PREFIX`, `REFRESH_COOKIE_NAME`)
- Query keys: camelCase arrays (e.g., `['dashboards']`, `['dashboards', id]`)
- Event handler prefixes: `handle` (e.g., `handleClick`, `handleKeyDown`)
- Callback prefixes: `on` (e.g., `onClick`, `onSuccess`, `onChange`)

**Types:**
- Interfaces: PascalCase prefixed with `I` OR use plain PascalCase without prefix (both used, prefer no `I` prefix in codebase)
- Type aliases: PascalCase (e.g., `LoginResult`, `JwtPayload`, `TestTokenPayload`)
- Props interfaces: ComponentNameProps pattern (e.g., `KpiCardProps`)
- Enums: PascalCase singular (used minimally, prefer unions/literals)

## Code Style

**Formatting:**
- Tool: Prettier 3.8.1
- Print width: 120 characters
- Tab width: 2 spaces
- Trailing commas: all (ES5 compatible)
- Single quotes: true
- Semicolons: true
- Arrow parens: avoid (e.g., `x => x * 2` not `(x) => x * 2`)
- End of line: LF

**Linting:**
- Tool: ESLint 10.0 with TypeScript ESLint
- Mode: Flat config (eslint.config.js)
- Base: JS recommended + TypeScript recommended + prettier override

**Key Rules:**
- `@typescript-eslint/no-unused-vars`: Warn, except underscore-prefixed variables ignored (e.g., `_unused`)
- `@typescript-eslint/no-explicit-any`: Warn (strict typing enforced)
- `prefer-const`: Error (const over let when possible)
- `no-var`: Error (use const/let only)
- `no-console`: Warn, but allow `console.warn`, `console.error`, `console.info`
- SQL safety: `$queryRawUnsafe` and `$executeRawUnsafe` forbidden (use tagged template instead)

**Test file rules (relaxed):**
- `@typescript-eslint/no-explicit-any`: Off
- `@typescript-eslint/no-unused-vars`: Off
- `no-console`: Off (for seed/scripts)

## Import Organization

**Order:**
1. React/framework imports (e.g., `import React, { useState } from 'react'`)
2. Third-party packages (e.g., `import { useQuery } from '@tanstack/react-query'`)
3. Shared monorepo types (e.g., `import type { UserRole } from '@nit-scs-v2/shared'`)
4. Internal components/hooks/utils (e.g., `import { KpiCard } from '@/components'`)
5. Icons (always last, e.g., `import { Package, Plus } from 'lucide-react'`)

**Path Aliases:**
- Frontend: `@` → `packages/frontend/src/`
- Backend: None (uses relative imports and Node ES modules)
- Imports use tsconfig paths and Vite resolution

**Named vs Default Exports:**
- Components: Named exports (except lazy-loaded pages use default)
- Hooks: Named exports
- Services: Named exports (for testability)
- Utilities: Named exports

## Error Handling

**Error Class Hierarchy** (in `@nit-scs-v2/shared/errors.ts`):
- Base: `AppError` - extends Error with statusCode, code, isOperational
- Specific: `NotFoundError(404)`, `AuthenticationError(401)`, `AuthorizationError(403)`, `ConflictError(409)`, `BusinessRuleError(422)`, `RateLimitError(429)`, `RequestValidationError(400)`

**Backend Error Pattern:**
```typescript
// In services: throw custom errors
if (!user) throw new NotFoundError('User', userId);
if (!isAuthorized) throw new AuthorizationError('Cannot delete other user');

// In routes: try/catch, rethrow or sendError
try {
  const result = await authService.login(email, password);
  sendSuccess(res, result);
} catch (err) {
  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.message);
  } else {
    next(err); // global error handler
  }
}
```

**Frontend Error Pattern:**
- React Query handles fetch errors and retries
- Error boundaries catch component errors
- Form validation with Zod schemas (in react-hook-form)
- Toast notifications for user-facing errors

**Logging:**
- Backend: Structured logging with Pino (structured JSON in prod, pretty-printed in dev)
- Log levels: debug, info, warn, error
- Log pattern: `log('info', 'message', data)` or `logger.info({ data }, 'message')`
- Always include context: request IDs, user IDs, resource IDs
- Do NOT log sensitive data (passwords, tokens)

## Comments

**When to Comment:**
- Complex algorithm explanation (not "obvious" code)
- Non-obvious workarounds or hacks (with WHY, not WHAT)
- Business rule explanations
- Security-critical code (e.g., token validation)
- DO NOT comment self-documenting code

**JSDoc/TSDoc:**
- Function signatures: Optional for public APIs, required for complex services
- Type definitions: Optional (types are documentation)
- Parameters: Include if non-obvious or when using overloads
- Returns: Include if non-obvious
- Examples: Include for utilities/hooks with non-standard usage

**Section Headers** (in long files):
```typescript
// ── Token Blacklist ────────────────────────────────────
// ── Types ──────────────────────────────────────────────
// ── Helpers ────────────────────────────────────────────
```

## Function Design

**Size:**
- Services: <100 lines per function (break into helpers)
- Hooks: <80 lines per function
- Components: <200 lines (use composition/subcomponents)

**Parameters:**
- Destructure object parameters when >2 params (e.g., `async ({ email, password }, options?: {})`)
- Use `type X = { ... }` for parameter objects when reused
- Avoid boolean flags for mode changes (use enum/literal union instead)

**Return Values:**
- Use union types for multiple returns: `Promise<User | null>`
- Throw errors for exceptional cases (don't return null for errors)
- Return structured results from mutations: `{ success: true, data: ... }`
- Use `void` only for event handlers

**Arrow Functions:**
- Prefer arrow functions for callbacks: `(item) => item.id === id`
- Use `function` keyword for exported service functions (hoisting, stack traces)

## Module Design

**Exports:**
- Barrel files use `export { ComponentA } from './ComponentA'` pattern (in `/components/index.ts`)
- Services export named functions, not default
- Hooks export named functions

**Barrel Files:**
- Used in: `/src/components/`, `/src/test-utils/`
- Pattern: Re-export public items only
- Frontend: `/api/hooks/index.ts` re-exports from `domains/{domain}/hooks/` (backward compat)

**Service Layer:**
- Location: `src/domains/{domain}/services/`
- Naming: `{entity}.service.ts`
- Export: Named functions, not classes
- Pattern: Pure functions that accept dependencies (testable)

**Route Handlers:**
- Location: `src/domains/{domain}/routes/`
- Pattern: Express Router with middleware + handler
- Register: Via `registerXxxRoutes(router)` barrel export in `index.ts`

## Component Patterns

**React Components:**
- Memoized by default: `export const KpiCard: React.FC<Props> = memo(({ props }) => { ... })`
- Props typing: Always define `interface XyzProps`
- Children typing: Include in props interface
- Event handlers: Wrapped in `useCallback` if passed as props

**Hooks (React Query):**
```typescript
export function useItems() {
  return useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Item[]>>('/items');
      return data;
    },
  });
}

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateItemInput) => {...},
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['items'] });
    },
  });
}
```

**Form Components:**
- Use `react-hook-form` + `Zod` validation
- Validation schemas in `formConfigs.ts` per domain
- Pattern: `const { form, onSubmit, isLoading } = useDocumentForm({ formType: 'grn', documentId: id })`

**State Management:**
- Server state: React Query (queries + mutations)
- UI state: React hooks (useState) or Zustand
- URL state: React Router (useSearchParams)
- Context: Minimal (Direction, Auth)

---

*Convention analysis: 2026-03-22*
