import React from 'react';
import { Route } from 'react-router-dom';
import { UserRole } from '@nit-scs-v2/shared/types';
import { RoleGuard, QC_ROLES } from '../routeUtils';

// ── Lazy-loaded pages ────────────────────────────────────────────────────
const QCOfficerDashboard = React.lazy(() =>
  import('@/pages/QCOfficerDashboard').then(m => ({ default: m.QCOfficerDashboard })),
);
const ResourceForm = React.lazy(() => import('@/pages/ResourceForm').then(m => ({ default: m.ResourceForm })));
const TasksPage = React.lazy(() => import('@/pages/TasksPage').then(m => ({ default: m.TasksPage })));
const InspectionToolsPage = React.lazy(() =>
  import('@/pages/quality/InspectionToolsPage').then(m => ({ default: m.InspectionToolsPage })),
);

// ── QC Officer route definitions ─────────────────────────────────────────
export function qcRoutes(currentRole: UserRole) {
  return (
    <>
      {/* QC OFFICER ROUTES */}
      <Route
        path="/qc"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={QC_ROLES}>
            <QCOfficerDashboard />
          </RoleGuard>
        }
      />
      <Route
        path="/qc/:tab"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={QC_ROLES}>
            <QCOfficerDashboard />
          </RoleGuard>
        }
      />
      <Route
        path="/qc/forms/osd"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={QC_ROLES}>
            <ResourceForm />
          </RoleGuard>
        }
      />
      <Route
        path="/qc/forms/:formType"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={QC_ROLES}>
            <ResourceForm />
          </RoleGuard>
        }
      />
      <Route
        path="/qc/tasks"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={QC_ROLES}>
            <TasksPage />
          </RoleGuard>
        }
      />
      <Route
        path="/quality/inspection-tools"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={QC_ROLES}>
            <InspectionToolsPage />
          </RoleGuard>
        }
      />
    </>
  );
}
