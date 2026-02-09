# NIT Supply Chain System

Full-stack warehouse and logistics management system built for Nesma Infrastructure & Technology (NIT), Saudi Arabia.

## Overview

The NIT Supply Chain System (NIT-SCS) is a comprehensive enterprise solution for managing warehouse operations, logistics, quality control, and supply chain documentation. Built as a modern monorepo architecture, it replaces Airtable-based workflows with a robust, scalable, and compliant system designed for Saudi Arabia's data residency requirements.

**Key Features:**
- Material receiving, issuing, and returns (MRRV, MIRV, MRV)
- Quality inspection and damage reporting (RFIM, OSD)
- Job order management across 7 types (Transport, Equipment, Generator, Rental, Scrap)
- Real-time inventory tracking with FIFO valuation
- Multi-level approval workflows
- Role-based access control (8 system roles)
- Real-time WebSocket synchronization
- Audit logging and compliance tracking
- Multi-language support (English/Arabic RTL)

## Tech Stack

### Monorepo Architecture
This project uses **pnpm workspaces** with three packages:

```
nit-scs/
├── packages/
│   ├── shared/      # @nit-scs/shared - Shared types, validators, constants
│   ├── backend/     # @nit-scs/backend - Express 5 API server
│   └── frontend/    # @nit-scs/frontend - React 19 web application
```

### Backend (`@nit-scs/backend`)
- **Runtime:** Node.js 20+ (ES Modules)
- **Framework:** Express 5.1
- **Database:** PostgreSQL 15 with Prisma ORM 6.5
- **Real-time:** Socket.IO 4.8
- **Authentication:** JWT with refresh tokens
- **Validation:** Zod 3.24
- **Security:** Helmet, CORS, rate limiting (200 req/min)
- **File Upload:** Multer (10MB limit)
- **Logging:** Morgan

**Key Features:**
- 55 Prisma models (1599 lines schema)
- 22 route modules
- CRUD factory pattern for master data
- Multi-level approval workflows
- FIFO inventory accounting
- Document auto-numbering (PREFIX-YYYY-NNNN)
- Real-time Socket.IO events for all entities

### Frontend (`@nit-scs/frontend`)
- **Framework:** React 19.2 with React Router 7.13
- **State Management:**
  - Zustand 5.0 (app state: auth, role)
  - React Query 5.65 (server state, caching)
- **UI Framework:** Tailwind CSS 3.4
- **Charts:** Recharts 3.7
- **Drag & Drop:** dnd-kit 6.3
- **Icons:** Lucide React 0.563
- **HTTP Client:** Axios 1.8
- **Real-time:** Socket.IO Client 4.8
- **PDF Export:** jsPDF 4.1 + jspdf-autotable 5.0
- **Build Tool:** Vite 6.2

**Key Features:**
- Code-splitting on all 40+ page components
- Role-based routing (8 roles)
- Real-time cache invalidation via Socket.IO
- Glassmorphism design with Nesma brand colors
- Section-based navigation (Inventory, Receiving, Issuing, Quality, Logistics, Master Data, System)
- Responsive mobile/tablet/desktop layouts

### Shared (`@nit-scs/shared`)
- **Types:** TypeScript definitions (auth, documents, inventory, master data, system, logistics)
- **Validators:** Zod schemas for API request/response validation
- **Constants:** Status flows, approval levels, document prefixes, date formats
- **Permissions:** RBAC permission matrix for 8 roles
- **Formatters:** Shared utility functions (date, currency, document numbers)

## Prerequisites

- **Node.js:** >= 20.0.0
- **pnpm:** >= 9.0.0
- **PostgreSQL:** 15 or later
- **Operating System:** macOS, Linux, or Windows with WSL2

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd nit-scs
```

### 2. Install Dependencies

```bash
pnpm install
```

This will install dependencies for all three workspace packages (`shared`, `backend`, `frontend`).

### 3. Set Up Environment Variables

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your actual values (see Environment Variables section below).

### 4. Start PostgreSQL Database

Using Docker Compose (recommended for development):

```bash
docker-compose up -d
```

This starts PostgreSQL 15 on `localhost:5432` with database `nit_scs`.

Alternatively, use your own PostgreSQL instance and update `DATABASE_URL` in `.env`.

### 5. Initialize Database

Generate Prisma client and push schema to database:

```bash
pnpm --filter @nit-scs/backend prisma:generate
pnpm --filter @nit-scs/backend prisma:push
```

### 6. Seed Database

Populate the database with initial master data and demo users:

```bash
pnpm --filter @nit-scs/backend prisma:seed
```

**Default Users Created:**
- Admin: `admin@nit.com.sa` / `password123`
- Warehouse Supervisor: `warehouse@nit.com.sa` / `password123`
- Logistics Coordinator: `logistics@nit.com.sa` / `password123`
- QC Officer: `qc@nit.com.sa` / `password123`

### 7. Start Development Servers

Run all services in parallel:

```bash
pnpm dev
```

This starts:
- **Backend:** `http://localhost:4000` (API + WebSocket server)
- **Frontend:** `http://localhost:3000` (Vite dev server)

Or run services individually:

```bash
# Backend only
pnpm dev:backend

# Frontend only
pnpm dev:frontend
```

### 8. Access the Application

Open your browser to:
- **Frontend:** http://localhost:3000
- **API Health Check:** http://localhost:4000/api/health
- **API Documentation:** See `docs/ARCHITECTURE.md`

Login with one of the seeded user accounts.

## Project Structure

```
nit-scs/
├── packages/
│   ├── shared/
│   │   ├── src/
│   │   │   ├── types/           # TypeScript type definitions
│   │   │   ├── validators/      # Zod schemas
│   │   │   ├── constants/       # Constants (status flows, prefixes)
│   │   │   ├── permissions.ts   # RBAC matrix
│   │   │   └── formatters.ts    # Utility formatters
│   │   └── package.json
│   │
│   ├── backend/
│   │   ├── prisma/
│   │   │   ├── schema.prisma    # Database schema (55 models)
│   │   │   └── seed.ts          # Seed script
│   │   ├── src/
│   │   │   ├── config/          # CORS, environment
│   │   │   ├── middleware/      # Auth, RBAC, validation, error handling
│   │   │   ├── routes/          # 22 route modules
│   │   │   ├── services/        # Business logic (auth, audit, inventory)
│   │   │   ├── schemas/         # Zod validation schemas
│   │   │   ├── socket/          # Socket.IO setup
│   │   │   ├── utils/           # CRUD factory, helpers
│   │   │   └── index.ts         # Express app entry point
│   │   ├── data/                # File-based data (settings.json)
│   │   ├── uploads/             # User-uploaded files
│   │   └── package.json
│   │
│   └── frontend/
│       ├── public/              # Static assets
│       ├── src/
│       │   ├── api/hooks/       # React Query hooks (16 files)
│       │   ├── components/      # Reusable UI components
│       │   ├── pages/           # Page components (40 files)
│       │   ├── socket/          # Socket.IO client
│       │   ├── store/           # Zustand stores
│       │   ├── styles/          # Global CSS (Tailwind)
│       │   ├── utils/           # Utilities (PDF export)
│       │   ├── App.tsx          # Main app + routing
│       │   └── main.tsx         # Entry point
│       └── package.json
│
├── docs/                        # Documentation
├── .env.example                 # Environment template
├── docker-compose.yml           # PostgreSQL container
├── render.yaml                  # Render.com deployment config
├── pnpm-workspace.yaml          # pnpm workspace config
└── package.json                 # Root package scripts
```

## Available Scripts

Run these from the project root:

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all services in parallel (backend + frontend) |
| `pnpm dev:backend` | Start backend only (port 4000) |
| `pnpm dev:frontend` | Start frontend only (port 3000) |
| `pnpm build` | Build all packages for production |
| `pnpm build:shared` | Build shared package only |
| `pnpm build:backend` | Build backend only |
| `pnpm build:frontend` | Build frontend only |
| `pnpm db:migrate` | Create a new Prisma migration |
| `pnpm db:push` | Push Prisma schema to database (dev) |
| `pnpm db:seed` | Seed database with initial data |
| `pnpm db:studio` | Open Prisma Studio (database GUI) |
| `pnpm lint` | Lint all packages |
| `pnpm clean` | Remove all build outputs and node_modules |

## Environment Variables

Create a `.env` file at the project root with these variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://nit_admin:nit_scs_dev_2026@localhost:5432/nit_scs` |
| `JWT_SECRET` | Secret for signing access tokens | `change-me-in-production` |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens | `change-me-in-production-refresh` |
| `JWT_EXPIRES_IN` | Access token expiration | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiration | `7d` |
| `PORT` | Backend server port | `4000` |
| `NODE_ENV` | Environment (development/production) | `development` |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:3000` |
| `VITE_API_URL` | Frontend API base URL | `http://localhost:4000/api` |
| `VITE_WS_URL` | Frontend WebSocket URL | `http://localhost:4000` |

**Security Notes:**
- **Never commit `.env` files to version control**
- Generate strong random secrets for production (`openssl rand -base64 32`)
- In production, use environment-specific secrets management (Render Secrets, AWS Secrets Manager, etc.)

## Database Management

### Migrations (Recommended for Production)

Create a migration after schema changes:

```bash
pnpm db:migrate
```

This creates a migration file in `packages/backend/prisma/migrations/`.

### Schema Push (Dev Only)

For rapid iteration in development:

```bash
pnpm db:push
```

**Warning:** This bypasses migrations and can lose data. Use only in dev.

### Prisma Studio

Visual database browser:

```bash
pnpm db:studio
```

Opens at `http://localhost:5555`.

### Reset Database

To completely reset and reseed:

```bash
pnpm --filter @nit-scs/backend prisma migrate reset
```

## Deployment

See `docs/DEPLOYMENT.md` for detailed deployment guides including:
- Render.com deployment (one-click with `render.yaml`)
- Docker deployment
- Environment configuration
- Post-deployment steps

## Development Guidelines

### Code Style
- TypeScript strict mode enabled
- ESM modules (`"type": "module"`)
- Use Zod for all validation
- Follow existing patterns in `crud-factory.ts` for master data routes

### Branching Strategy
- `main`: Production-ready code
- `develop`: Integration branch
- Feature branches: `feature/description`
- Bug fixes: `fix/description`

### Commit Messages
- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`
- Keep commits atomic and descriptive

### Testing
- Manual testing via Prisma Studio and browser DevTools
- Postman/Insomnia for API testing
- Production checklist in `docs/DEPLOYMENT.md`

## System Roles

The system supports 8 roles with different permissions:

1. **Admin** - Full system access
2. **Manager** - Approvals, reports, analytics
3. **Warehouse Supervisor** - Warehouse operations + approvals
4. **Warehouse Staff** - Warehouse operations only
5. **Logistics Coordinator** - Job orders, shipments, transport
6. **Site Engineer** - Material requests, site operations
7. **QC Officer** - Quality inspections, RFIM, OSD
8. **Freight Forwarder** - Shipping, customs, gate passes

See `packages/shared/src/permissions.ts` for the complete RBAC matrix.

## Key Documents

The system manages these core documents:

| Code | Arabic | English | Purpose |
|------|--------|---------|---------|
| MRRV | سند استلام مواد | Material Receiving Report Voucher | Receive materials |
| MIRV | سند صرف مواد | Material Issue Report Voucher | Issue materials |
| MRV | سند إرجاع مواد | Material Return Voucher | Return materials |
| RFIM | طلب فحص مواد | Request for Inspection of Materials | Quality inspection |
| OSD | تقرير نقص/تلف | Over/Short/Damage Report | Damage reporting |
| JO | أمر عمل | Job Order | Work orders (7 types) |

## Support

For questions, issues, or contributions:
- **Project Owner:** Abdulrahman Hussein (Logistics Manager, NIT)
- **Documentation:** See `docs/` directory
- **Architecture:** See `docs/ARCHITECTURE.md`
- **Deployment:** See `docs/DEPLOYMENT.md`

## License

Proprietary - Nesma Infrastructure & Technology (NIT), Saudi Arabia.

All rights reserved. Unauthorized copying, distribution, or use of this software is strictly prohibited.

---

**Version:** 1.0.0
**Last Updated:** 2026-02-08
**Built with:** Express 5, React 19, Prisma, PostgreSQL, Socket.IO
