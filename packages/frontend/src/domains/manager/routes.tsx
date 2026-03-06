import React from 'react';
import { Route } from 'react-router-dom';
import { UserRole } from '@nit-scs-v2/shared/types';
import { RoleGuard, MANAGER_ROLES } from '../routeUtils';

// ── Lazy-loaded pages ────────────────────────────────────────────────────
const ManagerDashboard = React.lazy(() =>
  import('@/domains/dashboards/pages/ManagerDashboard').then(m => ({ default: m.ManagerDashboard })),
);
const ResourceForm = React.lazy(() =>
  import('@/domains/admin/pages/ResourceForm').then(m => ({ default: m.ResourceForm })),
);
const TasksPage = React.lazy(() => import('@/domains/system/pages/TasksPage').then(m => ({ default: m.TasksPage })));
const DocumentsPage = React.lazy(() =>
  import('@/domains/system/pages/DocumentsPage').then(m => ({ default: m.DocumentsPage })),
);
const OperationsDashboard = React.lazy(() =>
  import('@/pages/dashboards/OperationsDashboard').then(m => ({ default: m.OperationsDashboard })),
);

// ── Manager route definitions ────────────────────────────────────────────
export function managerRoutes(currentRole: UserRole) {
  return (
    <>
      {/* MANAGER ROUTES */}
      <Route
        path="/manager"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={MANAGER_ROLES}>
            <ManagerDashboard />
          </RoleGuard>
        }
      />
      <Route
        path="/manager/:tab"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={MANAGER_ROLES}>
            <ManagerDashboard />
          </RoleGuard>
        }
      />
      <Route
        path="/manager/forms/:formType"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={MANAGER_ROLES}>
            <ResourceForm />
          </RoleGuard>
        }
      />
      <Route
        path="/manager/forms/:formType/:id"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={MANAGER_ROLES}>
            <ResourceForm />
          </RoleGuard>
        }
      />
      <Route
        path="/manager/tasks"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={MANAGER_ROLES}>
            <TasksPage />
          </RoleGuard>
        }
      />
      <Route
        path="/manager/documents"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={MANAGER_ROLES}>
            <DocumentsPage />
          </RoleGuard>
        }
      />
      <Route
        path="/manager/operations"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={MANAGER_ROLES}>
            <OperationsDashboard />
          </RoleGuard>
        }
      />
    </>
  );
}
