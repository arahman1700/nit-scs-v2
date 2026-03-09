# Cleanup Report

Date: 2026-03-07

## Completed

- Moved reusable form UI from `packages/frontend/src/pages/forms/` into `packages/frontend/src/components/forms/`.
- Moved AI chat widget from `packages/frontend/src/modules/ai/` into `packages/frontend/src/components/ai/`.
- Moved AI React Query hooks into `packages/frontend/src/domains/system/hooks/`.
- Moved backend health route into `packages/backend/src/domains/system/routes/`.
- Moved backend AI routes/services into `packages/backend/src/domains/system/routes/` and `packages/backend/src/domains/system/services/`.

## Quarantine Review

- No files were quarantined to `.cleanup_quarantine/`.
- Reason: the remaining V1/V2 duplicate-looking files are still live compatibility paths and are imported by active routes, hooks, forms, dashboards, or bulk-processing code.

## Not Safe To Quarantine Yet

- Frontend compatibility hooks such as `useMrrv.ts`, `useRfim.ts`, `useOsd.ts`, `useMirv.ts`, `useMrv.ts`, `useMrf.ts`, and `useStockTransfers.ts`.
- Backend compatibility routes such as `mrrv.routes.ts`, `rfim.routes.ts`, `osd.routes.ts`, `mirv.routes.ts`, `mrv.routes.ts`, `mrf.routes.ts`, and `stock-transfer.routes.ts`.
- Backend legacy service implementations still used by V2 aliases and bulk actions, including `mrrv.service.ts`, `rfim.service.ts`, `osd.service.ts`, `mirv.service.ts`, `mrv.service.ts`, `mrf.service.ts`, and `stock-transfer.service.ts`.

## Recommended Follow-Up

- Replace remaining live V1 imports/usages with V2 names first.
- Remove backward-compat aliases only after route mounts, hooks, and form flows stop referencing them.
- Re-run a full build/test pass and end-to-end smoke test before any future quarantine step.
