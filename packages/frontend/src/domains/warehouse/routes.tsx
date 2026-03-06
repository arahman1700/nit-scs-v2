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
    </>
  );
}
