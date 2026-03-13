import React from 'react';
import { Route } from 'react-router-dom';
import { UserRole } from '@nit-scs-v2/shared/types';
import { RoleGuard, WAREHOUSE_ROLES } from '../routeUtils';

// ── Lazy-loaded pages ────────────────────────────────────────────────────
const WarehouseDashboard = React.lazy(() =>
  import('@/domains/dashboards/pages/WarehouseDashboard').then(m => ({ default: m.WarehouseDashboard })),
);
const LaborDashboard = React.lazy(() =>
  import('@/pages/dashboards/LaborDashboard').then(m => ({ default: m.LaborDashboard })),
);

// Mobile scan workflow pages
const MobileDashboard = React.lazy(() =>
  import('@/pages/warehouse/MobileDashboard').then(m => ({ default: m.MobileDashboard })),
);
const MobileGrnReceive = React.lazy(() =>
  import('@/pages/warehouse/MobileGrnReceive').then(m => ({ default: m.MobileGrnReceive })),
);
const MobileMiIssue = React.lazy(() =>
  import('@/pages/warehouse/MobileMiIssue').then(m => ({ default: m.MobileMiIssue })),
);
const MobileWtTransfer = React.lazy(() =>
  import('@/pages/warehouse/MobileWtTransfer').then(m => ({ default: m.MobileWtTransfer })),
);
const MobileMrnRequest = React.lazy(() =>
  import('@/pages/warehouse/MobileMrnRequest').then(m => ({ default: m.MobileMrnRequest })),
);
const MobileQciInspect = React.lazy(() =>
  import('@/pages/warehouse/MobileQciInspect').then(m => ({ default: m.MobileQciInspect })),
);
const MobileDrReport = React.lazy(() =>
  import('@/pages/warehouse/MobileDrReport').then(m => ({ default: m.MobileDrReport })),
);
const MobileMrReturn = React.lazy(() =>
  import('@/pages/warehouse/MobileMrReturn').then(m => ({ default: m.MobileMrReturn })),
);
const MobileJoExecute = React.lazy(() =>
  import('@/pages/warehouse/MobileJoExecute').then(m => ({ default: m.MobileJoExecute })),
);
const MobileScrapDispose = React.lazy(() =>
  import('@/pages/warehouse/MobileScrapDispose').then(m => ({ default: m.MobileScrapDispose })),
);

// ── Warehouse route definitions ──────────────────────────────────────────
export function warehouseRoutes(currentRole: UserRole) {
  return (
    <>
      {/* WAREHOUSE ROUTES */}
      <Route
        path="/warehouse"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={WAREHOUSE_ROLES}>
            <WarehouseDashboard />
          </RoleGuard>
        }
      />
      <Route
        path="/warehouse/:tab"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={WAREHOUSE_ROLES}>
            <WarehouseDashboard />
          </RoleGuard>
        }
      />
      {/* MVP DEFERRED: Advanced warehouse features stripped for pilot */}
      <Route
        path="/warehouse/labor"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={WAREHOUSE_ROLES}>
            <LaborDashboard />
          </RoleGuard>
        }
      />
      <Route
        path="/warehouse/mobile"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={WAREHOUSE_ROLES}>
            <MobileDashboard />
          </RoleGuard>
        }
      />
      <Route
        path="/warehouse/mobile/grn-receive"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={WAREHOUSE_ROLES}>
            <MobileGrnReceive />
          </RoleGuard>
        }
      />
      <Route
        path="/warehouse/mobile/mi-issue"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={WAREHOUSE_ROLES}>
            <MobileMiIssue />
          </RoleGuard>
        }
      />
      <Route
        path="/warehouse/mobile/wt-transfer"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={WAREHOUSE_ROLES}>
            <MobileWtTransfer />
          </RoleGuard>
        }
      />
      <Route
        path="/warehouse/mobile/mrn"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={WAREHOUSE_ROLES}>
            <MobileMrnRequest />
          </RoleGuard>
        }
      />
      <Route
        path="/warehouse/mobile/qci"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={WAREHOUSE_ROLES}>
            <MobileQciInspect />
          </RoleGuard>
        }
      />
      <Route
        path="/warehouse/mobile/dr"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={WAREHOUSE_ROLES}>
            <MobileDrReport />
          </RoleGuard>
        }
      />
      <Route
        path="/warehouse/mobile/mr"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={WAREHOUSE_ROLES}>
            <MobileMrReturn />
          </RoleGuard>
        }
      />
      <Route
        path="/warehouse/mobile/jo"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={WAREHOUSE_ROLES}>
            <MobileJoExecute />
          </RoleGuard>
        }
      />
      <Route
        path="/warehouse/mobile/scrap"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={WAREHOUSE_ROLES}>
            <MobileScrapDispose />
          </RoleGuard>
        }
      />
    </>
  );
}
