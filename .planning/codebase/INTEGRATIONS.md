# External Integrations

**Analysis Date:** 2026-03-22

## APIs & External Services

**Email Service:**
- Resend (email delivery provider)
  - SDK: `resend` 6.9.1
  - Location: `packages/backend/src/domains/system/services/email.service.ts`
  - Auth: `RESEND_API_KEY` env var
  - Webhook support: `RESEND_WEBHOOK_SECRET` for signature verification via Svix
  - Features: Template rendering with Handlebars, unsubscribe tokens (JWT-signed), batch sending
  - Fallback: In development, email sending is optional (no logs without API key)

**Webhook Provider:**
- Svix (webhook delivery and event handling)
  - SDK: `svix` 1.84.1
  - Location: `packages/backend/src/domains/system/routes/email-webhook.routes.ts`
  - Auth: `RESEND_WEBHOOK_SECRET` env var (required in production)
  - Purpose: Validates and processes email delivery events from Resend

**Error Tracking:**
- Sentry (error monitoring and APM)
  - SDK: `@sentry/node` 10.38.0 (backend), `@sentry/react` 10.38.0 (frontend)
  - Config: `packages/backend/src/config/sentry.ts`
  - Auth: `SENTRY_DSN` env var (optional; errors sent only if set)
  - Setup: Initialized before all other imports to instrument modules
  - Features: 30% trace sampling in production, full sampling in dev; PII redaction for auth headers
  - Release tag: Auto-derived from git commit (RENDER_GIT_COMMIT or COMMIT_SHA)

**Metrics & Observability:**
- Prometheus (metrics collection)
  - SDK: `prom-client` 15.1.3
  - Location: Integration points throughout backend services
  - Purpose: Exposes metrics for monitoring dashboards (Grafana compatible)

## Data Storage

**Databases:**
- PostgreSQL 15+ (primary)
  - Provider: Self-managed (development) or Render.com (production)
  - Connection: `DATABASE_URL` env var (required)
  - Client: Prisma ORM
  - Features: Connection pooling (append `?connection_limit=20&pool_timeout=10` for production)
  - Read-only replica: Optional via `DATABASE_READ_URL` env var (falls back to primary if unset)
  - Migrations: Managed via Prisma (`pnpm db:migrate`, `pnpm db:push`)

**Redis Cache:**
- Redis 7+ (in-memory data store)
  - Managed provider options: Upstash (recommended for Render free tier, 10k commands/day)
  - Connection: `REDIS_URL` env var (optional in dev, recommended in prod)
  - Client: ioredis 5.9.2
  - Features: Exponential backoff reconnection, health monitoring, memory tracking
  - Uses:
    - BullMQ job queue (scheduled tasks, SLA monitoring, notifications)
    - Rate limiting (per-endpoint or per-user)
    - Token blacklisting (revoked JWTs)
    - Caching layer (transient data, session storage)
  - Fallback: Non-fatal in development (graceful degradation)

**File Storage:**
- Local filesystem only
  - Directory: `packages/backend/uploads/` (created at Docker runtime)
  - Permissions: Owned by nodejs:1001 (non-root user in production)
  - Use cases: Temporary attachment storage, upload handling via Multer
  - Note: Not suitable for horizontal scaling; multi-instance deployments need S3/object storage migration

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based implementation (no external provider)
  - Location: `packages/backend/src/domains/auth/`
  - Token type: Bearer JWT (signed with RS256 or HS256)
  - Access token: 15 minutes (configurable via JWT_EXPIRES_IN)
  - Refresh token: 7 days (configurable via JWT_REFRESH_EXPIRES_IN)
  - Secrets: JWT_SECRET and JWT_REFRESH_SECRET (32+ chars required; env vars)
  - Token storage (frontend): HttpOnly cookies (secure, SameSite=Strict) or localStorage
  - Token revocation: Supported via Redis blacklist
  - Features: Role-based access control (RBAC) via Prisma User.role field

**Password Management:**
- bcryptjs 3.0.2 (password hashing)
  - Location: Auth service and user creation flows
  - Rounds: Default 10 (industry standard)
  - Validation: No OAuth integration; uses email + password only

## Monitoring & Observability

**Error Tracking:**
- Sentry (described above under APIs)

**Logs:**
- Pino (structured JSON logging)
  - Config: `packages/backend/src/config/logger.ts`
  - Output: Console in development (pretty-printed with pino-pretty), JSON in production
  - Request logging: Morgan middleware logs HTTP method, status, response time
  - Custom fields: Request ID (unique per request via middleware)

**Health Check:**
- Custom endpoint: `GET /api/health`
  - Location: `packages/backend/src/domains/system/routes/health.routes.ts`
  - Used by: Docker healthcheck, load balancers
  - Response: JSON with uptime, database connectivity, Redis status

## CI/CD & Deployment

**Hosting:**
- Render.com (primary deployment target)
  - Config: `render.yaml` (declarative infra-as-code)
  - Web service plan: Free tier
  - Database: PostgreSQL 15 on Render (auto-provisioned via render.yaml)
  - Docker build: Multi-stage (`packages/backend/Dockerfile`) for optimized image size

**Docker:**
- Base image: node:20-alpine
- Stages: deps (dependency install) → build (compile all packages) → runtime (production)
- Build args: RENDER_GIT_COMMIT (for release versioning)
- Non-root user: nodejs:1001 (security hardening)
- Exposed port: 4000 (backend), frontend served as static files from `packages/frontend/dist`

**CI Pipeline:**
- None detected (no GitHub Actions, GitLab CI, or Jenkins config)
- Manual deployment via Render git push or CLI
- Pre-commit hooks: husky + lint-staged (ESLint + Prettier on staged files)

**Monitoring:**
- Render health checks: Queries `/api/health` every 30s (timeout 3s)
- Manual logs: Render dashboard or `render logs` CLI

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` - PostgreSQL connection string (with optional pooling params)
- `JWT_SECRET` - 32+ character string for access token signing
- `JWT_REFRESH_SECRET` - 32+ character string for refresh token signing
- `NODE_ENV` - Set to `production` on Render

**Optional env vars (development defaults apply):**
- `PORT` - Default 4000
- `CORS_ORIGIN` - Default `http://localhost:3000`; comma-separated list for multiple origins
- `REDIS_URL` - Default `redis://localhost:6379`; Upstash rediss:// URLs supported
- `JWT_EXPIRES_IN` - Default `15m`
- `JWT_REFRESH_EXPIRES_IN` - Default `7d`
- `SENTRY_DSN` - Error tracking; omit to disable
- `RESEND_API_KEY` - Email delivery; omit to skip sending
- `RESEND_FROM_EMAIL` - Default `noreply@nit.sa`
- `RESEND_FROM_NAME` - Default `NIT Logistics`
- `RESEND_WEBHOOK_SECRET` - Webhook signature verification; required if using Resend webhooks
- `VAPID_PUBLIC_KEY` - Web Push public key; auto-generated if missing
- `VAPID_PRIVATE_KEY` - Web Push private key; auto-generated if missing
- `VAPID_SUBJECT` - Default `mailto:admin@nit-scs.com`
- `SEED_ADMIN_PASSWORD` - Demo seed admin password; default `Admin@2026!`

**Frontend env vars (build-time):**
- `VITE_API_URL` - Default `http://localhost:4000/api/v1`
- `VITE_WS_URL` - Default `http://localhost:4000` (for Socket.IO)
- `VITE_SENTRY_DSN` - Optional; enables Sentry in browser

**Secrets location:**
- Development: `.env` file (git-ignored)
- Production: Render environment variables (set in dashboard or via CLI)
- Example template: `.env.example` (safe to commit)

## Webhooks & Callbacks

**Incoming:**
- Resend email events: `POST /api/v1/system/email-webhook`
  - Signature verification: Svix SDK validates against RESEND_WEBHOOK_SECRET
  - Events: Delivery status (sent, failed, bounced, complained, opened, clicked)
  - Location: `packages/backend/src/domains/system/routes/email-webhook.routes.ts`

**Outgoing:**
- None detected (no external webhook callbacks initiated by this system)

## Service-to-Service Communication

**Internal (Monorepo):**
- Socket.IO: Real-time push to all connected clients (notifications, live updates)
  - Server: `packages/backend/src/socket/setup.ts`
  - Client: `socket.io-client` in frontend
  - CORS: Configured for `CORS_ORIGIN` + `wss://` support
  - Features: Room-based broadcasting (by role, by user, by domain event)

**External HTTP:**
- Axios 1.13.5 (frontend API client)
  - All requests routed through Vite dev proxy or direct to backend
  - Base URL: `VITE_API_URL` or inferred from window.location
  - Auth: Bearer token in Authorization header (from localStorage/cookies)

## Third-Party SDKs & Integrations Summary

| Service | SDK | Purpose | Required? | Config |
|---------|-----|---------|-----------|--------|
| Resend | resend | Email delivery | No | RESEND_API_KEY |
| Svix | svix | Webhook validation | No | RESEND_WEBHOOK_SECRET |
| Sentry | @sentry/node, @sentry/react | Error tracking | No | SENTRY_DSN |
| Web Push API | web-push | Push notifications | No | VAPID keys |
| PostgreSQL | @prisma/client | Database | Yes | DATABASE_URL |
| Redis | ioredis | Caching, queuing | Recommended | REDIS_URL |
| Socket.IO | socket.io (server), socket.io-client (client) | Real-time comms | Yes | Built-in |
| Prometheus | prom-client | Metrics collection | No | Built-in |

---

*Integration audit: 2026-03-22*
