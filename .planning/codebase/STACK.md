# Technology Stack

**Analysis Date:** 2026-03-22

## Languages

**Primary:**
- TypeScript ~5.8.2 - Strict mode enabled; used across all packages (frontend, backend, shared)
- JavaScript (ES2022) - Runtime target for all compiled code

**Secondary:**
- HTML5 - Frontend markup (Vite-served)
- CSS 3.4 - Tailwind CSS framework with custom theme extensions
- SQL - PostgreSQL queries via Prisma ORM (no raw SQL except through Prisma.sql tagged templates)

## Runtime

**Environment:**
- Node.js >=20.0.0 (Alpine 20 in Docker)
- Browser: Modern ES2022 support required

**Package Manager:**
- pnpm >=9.0.0
- Lockfile: `pnpm-lock.yaml` (present, frozen lockfile enforced in CI)

## Frameworks

**Core (Backend):**
- Express 5.1.0 - HTTP server, routing, middleware
- Prisma 6.5.0 - ORM with database schema management (PostgreSQL)

**Core (Frontend):**
- React 19.2.4 - UI framework
- Vite 6.2.0 - Build tool and dev server
- React Router DOM 7.13.0 - Client-side routing

**State Management:**
- Zustand 5.0.11 - Client state (frontend)
- React Query (TanStack) 5.65.0 - Server state and async data fetching (frontend)
- React Hook Form 7.71.1 - Form state and validation

**Real-time Communication:**
- Socket.IO 4.8.0 (server and client) - WebSocket-based live updates and notifications

**Testing:**
- Vitest 4.0.18 - Unit/integration tests (backend and frontend)
- Playwright 1.52.0 - E2E testing (frontend only)
- MSW (Mock Service Worker) 2.12.9 - API mocking for tests
- Testing Library (@testing-library/react) 16.3.2 - React component testing

**Build/Dev:**
- TypeScript Compiler 5.8.2 - Type checking and compilation
- Tailwind CSS 3.4.17 - Utility-first CSS framework with RTL support
- Autoprefixer 10.4.20 - CSS vendor prefix generation
- PostCSS 8.5.0 - CSS transformation pipeline
- Vite PWA Plugin 1.2.0 - Progressive Web App support with Workbox

## Key Dependencies

**Critical (Backend):**
- `@prisma/client` 6.5.0 - Database abstraction and query builder
- `bcryptjs` 3.0.2 - Password hashing and verification
- `jsonwebtoken` 9.0.2 - JWT token generation/verification (15m access, 7d refresh)
- `ioredis` 5.9.2 - Redis client for caching, rate limiting, token blacklisting
- `express` 5.1.0 - HTTP server framework
- `zod` 3.24.0 - Schema validation for environment variables and request/response payloads

**Critical (Frontend):**
- `@tanstack/react-query` 5.65.0 - Server state management and automatic cache invalidation
- `react-hook-form` 7.71.1 - Efficient form handling with Zod validation
- `zustand` 5.0.11 - Lightweight client state (direction, auth context)
- `axios` 1.13.5 - HTTP client for API requests
- `socket.io-client` 4.8.0 - Real-time data sync and push notifications
- `react-router-dom` 7.13.0 - Client-side routing

**Infrastructure (Backend):**
- `bullmq` 5.71.0 - Job queue system (scheduled tasks, SLA checks, notifications)
- `@bull-board/api` and `@bull-board/express` 6.20.5 - Job queue dashboard UI
- `helmet` 8.1.0 - HTTP security headers
- `cors` 2.8.5 - Cross-Origin Resource Sharing (CORS_ORIGIN from env)
- `compression` 1.8.0 - Gzip compression middleware
- `morgan` 1.10.0 - HTTP request logging
- `cookie-parser` 1.4.7 - Cookie parsing and handling
- `dotenv` 16.5.0 - Environment variable loading

**Observability (Backend):**
- `@sentry/node` 10.38.0 (optional) - Error tracking and APM; requires SENTRY_DSN env var
- `pino` 10.3.0 - Structured JSON logging
- `pino-pretty` 13.1.3 - Dev-friendly log formatter
- `prom-client` 15.1.3 - Prometheus metrics client

**Communication (Backend):**
- `resend` 6.9.1 - Email delivery API (optional; requires RESEND_API_KEY)
- `svix` 1.84.1 - Email webhook handling (signature verification via RESEND_WEBHOOK_SECRET)
- `web-push` 3.6.7 - Web Push Notifications API (VAPID keys optional)

**Data Processing (Backend):**
- `exceljs` 4.4.0 - Excel file generation and parsing (reports, exports)
- `jspdf` 4.2.0 and `jspdf-autotable` 5.0.7 (frontend) - PDF generation
- `bwip-js` 4.8.0 - Barcode generation (Code128, QR)
- `sanitize-html` 2.14.0 - HTML sanitization to prevent XSS
- `handlebars` 4.7.8 - Email template rendering

**Frontend UI:**
- `recharts` 3.7.0 - Chart library for dashboards and reporting
- `lucide-react` 0.563.0 - Icon library (24+ SVG icons)
- `html5-qrcode` 2.3.8 - QR code scanner
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` 6.x - Drag-and-drop system
- `@tanstack/react-table` 8.21.3 - Headless table component
- `@tanstack/react-virtual` 3.13.22 - Virtualization for large lists

**Security/Utils:**
- `uuid` 11.1.0 - Unique ID generation
- `multer` 2.1.1 - File upload handling (multipart/form-data)
- `workbox-window` 7.4.0 - Service worker integration

## Configuration

**Environment:**
- `.env.example` template provided; actual secrets in `.env` (never committed)
- Environment variables validated with Zod schema in `src/config/env.ts`
- Required vars: DATABASE_URL, JWT_SECRET (32+ chars), JWT_REFRESH_SECRET (32+ chars)
- Optional vars: REDIS_URL, SENTRY_DSN, RESEND_API_KEY, VAPID keys, WEB_PUSH config
- CORS_ORIGIN defaults to `http://localhost:3000` (production needs override)

**Build:**
- TypeScript config: `tsconfig.base.json` + package-specific overrides
- ESLint: `eslint.config.js` (flat config format, v10+)
  - Enforces: no SQL injection via `$queryRawUnsafe`/$executeRawUnsafe`, no unused vars, camelCase
  - Disables formatting rules (Prettier handles that)
- Prettier: `.prettierrc` (120 char width, 2-space tabs, trailing commas, single quotes, arrow parens avoided)

**Database:**
- Prisma schema split across 17 files in `packages/backend/prisma/schema/` (0-16 prefixed for load order)
- Database: PostgreSQL 15+ (required; Xano Saudi region in production)
- Connection pooling: Production should append `?connection_limit=20&pool_timeout=10` to DATABASE_URL
- Read-only replica support via optional DATABASE_READ_URL env var

**Monorepo:**
- pnpm workspaces (`pnpm-workspace.yaml`) with 3 packages:
  - `@nit-scs-v2/backend` - Express + Prisma
  - `@nit-scs-v2/frontend` - React + Vite
  - `@nit-scs-v2/shared` - Shared types, validators, constants, utils
- Shared package has multiple exports for tree-shaking: types, validators, constants, formatters, errors, utils

## Platform Requirements

**Development:**
- Node.js >=20.0.0
- pnpm >=9.0.0
- PostgreSQL 15+ (Docker recommended via docker-compose.yml)
- Redis 7+ (Docker recommended via docker-compose.yml)
- Vite dev server on port 3000
- Express server on port 4000
- Port forwarding for Vite proxy to handle `/api/v1` and `/socket.io` requests

**Production:**
- Deployment target: Render.com (free tier with PostgreSQL database)
- Docker image built from multi-stage Dockerfile (`packages/backend/Dockerfile`)
- Runs as non-root user (nodejs:1001)
- Health check endpoint: `GET /api/health`
- Requires: DATABASE_URL (connection pooling), JWT secrets, REDIS_URL (Upstash for free tier)

---

*Stack analysis: 2026-03-22*
