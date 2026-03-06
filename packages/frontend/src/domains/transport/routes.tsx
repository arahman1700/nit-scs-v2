import React from 'react';
import { Route } from 'react-router-dom';
import { UserRole } from '@nit-scs-v2/shared/types';
import { RoleGuard, TRANSPORT_ROLES } from '../routeUtils';

// ── Lazy-loaded pages ────────────────────────────────────────────────────
const TransportDashboard = React.lazy(() =>
  import('@/domains/dashboards/pages/TransportDashboard').then(m => ({ default: m.TransportDashboard })),
);

// ── Transport route definitions ──────────────────────────────────────────
export function transportRoutes(currentRole: UserRole) {
  return (
    <>
      {/* TRANSPORT ROUTES */}
      <Route
        path="/transport"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={TRANSPORT_ROLES}>
            <TransportDashboard />
          </RoleGuard>
        }
      />
      <Route
        path="/transport/:view"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={TRANSPORT_ROLES}>
            <TransportDashboard />
          </RoleGuard>
        }
      />
    </>
  );
}
