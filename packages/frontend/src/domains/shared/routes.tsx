import React from 'react';
import { Route } from 'react-router-dom';
import { UserRole } from '@nit-scs-v2/shared/types';
import { RoleGuard, ADMIN_MANAGER_ROLES, WAREHOUSE_ROLES, TRANSPORT_ROLES, ENGINEER_ROLES } from '../routeUtils';

// ── Lazy-loaded pages ────────────────────────────────────────────────────
const TasksPage = React.lazy(() => import('@/pages/TasksPage').then(m => ({ default: m.TasksPage })));
const DocumentsPage = React.lazy(() => import('@/pages/DocumentsPage').then(m => ({ default: m.DocumentsPage })));
const PendingApprovalsPage = React.lazy(() =>
  import('@/pages/PendingApprovalsPage').then(m => ({ default: m.PendingApprovalsPage })),
);

// ── Shared feature route definitions ─────────────────────────────────────
export function sharedRoutes(currentRole: UserRole) {
  return (
    <>
      {/* SHARED FEATURE ROUTES */}
      <Route
        path="/admin/tasks"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={ADMIN_MANAGER_ROLES}>
            <TasksPage />
          </RoleGuard>
        }
      />
      <Route
        path="/admin/documents"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={ADMIN_MANAGER_ROLES}>
            <DocumentsPage />
          </RoleGuard>
        }
      />
      <Route
        path="/warehouse/tasks"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={WAREHOUSE_ROLES}>
            <TasksPage />
          </RoleGuard>
        }
      />
      <Route
        path="/transport/tasks"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={TRANSPORT_ROLES}>
            <TasksPage />
          </RoleGuard>
        }
      />
      <Route
        path="/engineer/tasks"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={ENGINEER_ROLES}>
            <TasksPage />
          </RoleGuard>
        }
      />

      {/* PENDING APPROVALS — accessible to all authenticated roles */}
      <Route path="/approvals/pending" element={<PendingApprovalsPage />} />
    </>
  );
}
