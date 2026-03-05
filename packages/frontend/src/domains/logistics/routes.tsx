import React from 'react';
import { Route } from 'react-router-dom';
import { UserRole } from '@nit-scs-v2/shared/types';
import { RoleGuard, LOGISTICS_ROLES } from '../routeUtils';

// ── Lazy-loaded pages ────────────────────────────────────────────────────
const LogisticsCoordinatorDashboard = React.lazy(() =>
  import('@/pages/LogisticsCoordinatorDashboard').then(m => ({ default: m.LogisticsCoordinatorDashboard })),
);
const ResourceForm = React.lazy(() => import('@/pages/ResourceForm').then(m => ({ default: m.ResourceForm })));
const ShipmentForm = React.lazy(() => import('@/pages/ShipmentForm').then(m => ({ default: m.ShipmentForm })));
const GatePassForm = React.lazy(() => import('@/pages/GatePassForm').then(m => ({ default: m.GatePassForm })));
const TasksPage = React.lazy(() => import('@/pages/TasksPage').then(m => ({ default: m.TasksPage })));
const RouteOptimizerPage = React.lazy(() =>
  import('@/pages/logistics/RouteOptimizerPage').then(m => ({ default: m.RouteOptimizerPage })),
);

// ── Logistics Coordinator route definitions ──────────────────────────────
export function logisticsRoutes(currentRole: UserRole) {
  return (
    <>
      {/* LOGISTICS COORDINATOR ROUTES */}
      <Route
        path="/logistics"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={LOGISTICS_ROLES}>
            <LogisticsCoordinatorDashboard />
          </RoleGuard>
        }
      />
      <Route
        path="/logistics/:tab"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={LOGISTICS_ROLES}>
            <LogisticsCoordinatorDashboard />
          </RoleGuard>
        }
      />
      <Route
        path="/logistics/forms/jo"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={LOGISTICS_ROLES}>
            <ResourceForm />
          </RoleGuard>
        }
      />
      <Route
        path="/logistics/forms/shipment"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={LOGISTICS_ROLES}>
            <ShipmentForm />
          </RoleGuard>
        }
      />
      <Route
        path="/logistics/forms/gatepass"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={LOGISTICS_ROLES}>
            <GatePassForm />
          </RoleGuard>
        }
      />
      <Route
        path="/logistics/forms/:formType"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={LOGISTICS_ROLES}>
            <ResourceForm />
          </RoleGuard>
        }
      />
      <Route
        path="/logistics/forms/:formType/:id"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={LOGISTICS_ROLES}>
            <ResourceForm />
          </RoleGuard>
        }
      />
      <Route
        path="/logistics/tasks"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={LOGISTICS_ROLES}>
            <TasksPage />
          </RoleGuard>
        }
      />
      <Route
        path="/logistics/route-optimizer"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={LOGISTICS_ROLES}>
            <RouteOptimizerPage />
          </RoleGuard>
        }
      />
    </>
  );
}
