# Phase 3: Security Hardening - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase hardens authentication, input validation, and attack surface to production-safe levels. Covers: rate limiter fix (SECR-01), Zod string length limits (SECR-02), AI SQL injection hardening (SECR-03), CORS production config (SECR-04), auth middleware race condition (SECR-05), error handler production mode (SECR-06), and Pino PII redaction (SECR-07).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation choices are at Claude's discretion — pure infrastructure phase:
- Rate limiter: exempt /auth/me OR switch to per-user rate limiting for authenticated routes (SECR-01)
- Zod: add z.string().max(255) to all text fields, max(500) for descriptions/notes across shared validators (SECR-02)
- AI module: add audit logging, restrict to read-only DB connection, add SQL validation (SECR-03)
- CORS: configure per-environment origin allowlist (SECR-04)
- Auth middleware: add explicit return after sendError to prevent double next() calls (SECR-05)
- Error handler: hide stack traces and internal details in production mode (SECR-06)
- Pino: configure redact option for passwords, tokens, emails (SECR-07)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/backend/src/middleware/rate-limiter.ts` — current rate limiter implementation
- `packages/shared/src/validators/validators.ts` — all Zod schemas
- `packages/backend/src/domains/ai-services/services/ai-chat.service.ts` — AI SQL query execution
- `packages/backend/src/config/cors.ts` — CORS configuration
- `packages/backend/src/middleware/auth.ts` — authentication middleware
- `packages/backend/src/middleware/error-handler.ts` — error handling (already has P2034 support from Phase 1)
- `packages/backend/src/config/logger.ts` — Pino logger configuration

### Established Patterns
- Middleware follows Express 5 async pattern
- Zod validators are in shared package, imported by both frontend and backend
- Environment-specific config uses `env.ts` with Zod validation

### Integration Points
- Rate limiter middleware applied in `packages/backend/src/index.ts`
- CORS configured in Express setup
- Logger used across entire backend via `import { logger } from '@/config/logger'`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase.

</specifics>

<deferred>
## Deferred Ideas

- httpOnly cookie migration for JWT tokens (complex, touches auth + frontend + service worker — defer to later if needed)

</deferred>
