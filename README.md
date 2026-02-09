# NIT Supply Chain System (NIT-SCS)

Full-stack supply chain management system for Nesma Infrastructure & Technology (NIT).
Manages material receiving, issuance, returns, job orders, inventory, shipments, and logistics workflows.

## Tech Stack

| Layer    | Technology                                   |
| -------- | -------------------------------------------- |
| Frontend | React 19, Vite, Tailwind CSS, TanStack Query |
| Backend  | Express 5, Prisma ORM, Socket.IO             |
| Database | PostgreSQL 15                                |
| Cache    | Redis 7                                      |
| Shared   | Zod validators, TypeScript types, formatters |
| Testing  | Vitest, Supertest, Testing Library           |
| CI/CD    | GitHub Actions                               |

## Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0
- **Docker** (for PostgreSQL + Redis)

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url>
cd "NIT x Idaratech - Supply Chain System"
pnpm install

# 2. Start databases
docker compose up -d

# 3. Setup environment
cp .env.example .env

# 4. Initialize database
pnpm db:push     # Create/sync schema
pnpm db:seed     # Seed demo data (admin + sample documents)

# 5. Run development servers
pnpm dev         # Starts backend (port 4000) + frontend (port 3000)
```

## Project Structure

```
packages/
  backend/        Express 5 API server
    prisma/         Schema (53 models), migrations, seed data
    src/
      config/       Environment, Redis, logger, Swagger, CORS
      middleware/    Auth, RBAC, rate limiter, pagination, validation
      routes/       30+ route modules (auth, MRRV, MIRV, JO, etc.)
      services/     Business logic (inventory FIFO, approvals, SLA)
      events/       Event bus, action handlers, rule engine
      socket/       Socket.IO setup and real-time sync
      utils/        Prisma client, JWT, CRUD/document factories, caching
  frontend/       React 19 SPA (PWA)
    src/
      api/          API client, TanStack Query hooks
      components/   Shared components (forms, tables, modals)
      pages/        Route pages and section landing pages
      store/        Zustand global store
      socket/       Real-time sync hooks
  shared/         Shared between backend and frontend
    src/
      validators/   Zod schemas for all DTOs
      types/        TypeScript interfaces
      formatters    Number/date formatting utilities
      errors        Custom error classes
      permissions   Role-permission mapping
```

## Available Scripts

| Command             | Description                           |
| ------------------- | ------------------------------------- |
| `pnpm dev`          | Start all packages in dev mode        |
| `pnpm dev:backend`  | Start backend only                    |
| `pnpm dev:frontend` | Start frontend only                   |
| `pnpm build`        | Build all packages                    |
| `pnpm test`         | Run all tests (1,063 tests, 45 files) |
| `pnpm lint`         | Lint all packages                     |
| `pnpm format`       | Format code with Prettier             |
| `pnpm db:push`      | Push schema to database               |
| `pnpm db:seed`      | Seed demo data                        |
| `pnpm db:studio`    | Open Prisma Studio                    |
| `pnpm db:migrate`   | Run Prisma migrations                 |

## Environment Variables

See `.env.example` for all options. Key variables:

| Variable             | Required | Description                            |
| -------------------- | -------- | -------------------------------------- |
| `DATABASE_URL`       | Yes      | PostgreSQL connection string           |
| `JWT_SECRET`         | Yes\*    | JWT signing key (32+ chars in prod)    |
| `JWT_REFRESH_SECRET` | Yes\*    | Refresh token key (32+ chars in prod)  |
| `REDIS_URL`          | No       | Redis URL (optional in dev)            |
| `RESEND_API_KEY`     | No       | Email service key (optional in dev)    |
| `CORS_ORIGIN`        | No       | Frontend URL (default: localhost:3000) |

\*Development fallback secrets are provided automatically.

## API Documentation

Swagger UI is available at `http://localhost:4000/api/docs` when the backend is running.
JSON spec: `http://localhost:4000/api/docs.json`

Health check: `GET /api/v1/health` (returns DB, Redis, memory status)

## Architecture

### User Roles (8)

`admin`, `manager`, `warehouse_supervisor`, `warehouse_staff`, `logistics_coordinator`, `site_engineer`, `qc_officer`, `freight_forwarder`

### Document Types (10)

MRRV (receiving), RFIM (inspection), OSD (damage), MIRV (issuance), MRV (returns), MRF (requisition), Gate Pass, Stock Transfer, Job Order (7 subtypes), Shipment

### Key Features

- **FIFO Inventory** with lot tracking and optimistic locking
- **Multi-level Approval** chains with delegation support
- **SLA Tracking** with automated breach notifications (5 cron jobs)
- **Row-Level Security** scoped by project/warehouse assignment
- **Real-time Updates** via Socket.IO
- **Bulk Operations** and Excel import for master data
- **Document Comments** on any document type
- **Barcode Scanner** with camera and manual entry
- **Print Templates** with PDF export
- **Dashboard Builder** with customizable widgets
- **Workflow Engine** with IF-THEN rule automation
- **Email System** with Handlebars templates and retry logic

## Testing

```bash
# Run all tests
pnpm test

# Run specific package tests
pnpm --filter @nit-scs/backend test
pnpm --filter @nit-scs/frontend test
pnpm --filter @nit-scs/shared test
```

Test coverage: **45 files, 1,063 tests** (shared: 240, backend: 782, frontend: 41)

## Deployment

### Docker (Production)

```bash
# Build and run with Docker Compose
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Render

See `render.yaml` for Render deployment configuration. The backend serves the frontend SPA in production.

### Manual

```bash
pnpm build
NODE_ENV=production node packages/backend/dist/index.js
```

## License

Proprietary - NIT / Idaratech
