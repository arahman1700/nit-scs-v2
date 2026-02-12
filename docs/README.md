# NIT Supply Chain System V2 — Documentation

**Company:** Nesma Infrastructure & Technology (NIT) — Saudi Arabia
**Version:** 2.0 | **Date:** February 2026
**Stack:** React 19 + Vite 6 + Express 5 + Prisma 6 + TypeScript

---

## Documents

| Document | Description | Format |
|----------|-------------|--------|
| [System Documentation](./NIT-SCS-V2-System-Documentation.md) | Comprehensive technical documentation covering architecture, 103 database models, 14 document types with state machines, FIFO inventory, approval engine, RBAC (10 roles), business flows, and all advanced features | Markdown |
| [System Documentation](./NIT-SCS-V2-System-Documentation.docx) | Same content as above — for sharing in meetings or with non-technical stakeholders | Word |
| [Architecture Maps](./system-architecture-maps.html) | 13 interactive diagrams: C4 architecture, monorepo structure, database entity groups, state machines (GRN, MI, MR, JO), FIFO flow, approval engine, RBAC matrix, notification system, and implementation dashboard | HTML (open in browser) |
| [Deployment Guide](./DEPLOYMENT.md) | Step-by-step deployment instructions for Render and Docker, environment variables, troubleshooting, and production checklist | Markdown |

---

## Quick Reference

### System Scale

| Metric | Count |
|--------|-------|
| Prisma Models | 103 |
| Document Types | 14 (GRN, MI, MRN, MR, QCI, DR, JO, WT, IMSF, Gate Pass, Surplus, Scrap, Rental Contract, Shipment) |
| State Machines | 17 (with V1 backward-compatible aliases) |
| System Roles | 10 (Admin, Manager, WH Supervisor, WH Staff, Logistics, Site Engineer, QC Officer, Freight Forwarder, Transport Supervisor, Scrap Committee) |
| Frontend Pages | 88 |
| API Hooks | 69 |
| UI Components | 77 |
| Backend Routes | 81 |
| Backend Services | 59 |
| Tests | 1,063 (782 backend + 240 shared + 41 frontend) |

### Monorepo Structure

```
nit-scs-v2/
├── packages/
│   ├── shared/      @nit-scs-v2/shared    — Types, validators, state machine, permissions
│   ├── backend/     @nit-scs-v2/backend    — Express 5 API + Prisma 6 + Socket.IO
│   └── frontend/    @nit-scs-v2/frontend   — React 19 + Vite 6 + Tailwind CSS
├── docs/            This folder
├── CLAUDE.md        Design system & project rules
└── render.yaml      Render deployment blueprint
```

### V1 to V2 Document Naming

| V1 (Internal) | V2 (Display) | Purpose |
|----------------|-------------|---------|
| MRRV | GRN | Goods Receipt Note |
| MIRV | MI | Material Issue |
| MRV | MRN | Material Return Note |
| MRF | MR | Material Requisition |
| RFIM | QCI | Quality Control Inspection |
| OSD | DR | Damage/Discrepancy Report |
| StockTransfer | WT | Warehouse Transfer |

---

## For the Technical Team

1. **Start here:** Read [System Documentation](./NIT-SCS-V2-System-Documentation.md) for complete technical details
2. **Visual overview:** Open [Architecture Maps](./system-architecture-maps.html) in your browser for interactive diagrams
3. **Deploying:** Follow [Deployment Guide](./DEPLOYMENT.md) for Render or Docker setup
4. **Coding rules:** See [CLAUDE.md](../CLAUDE.md) in the project root for design system tokens and component patterns
