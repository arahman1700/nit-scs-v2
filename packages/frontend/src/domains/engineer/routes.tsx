import React from 'react';
import { Route } from 'react-router-dom';
import { UserRole } from '@nit-scs-v2/shared/types';
import { RoleGuard, ENGINEER_ROLES } from '../routeUtils';

// ── Lazy-loaded pages ────────────────────────────────────────────────────
const SiteEngineerDashboard = React.lazy(() =>
  import('@/pages/SiteEngineerDashboard').then(m => ({ default: m.SiteEngineerDashboard })),
);
const ResourceForm = React.lazy(() => import('@/pages/ResourceForm').then(m => ({ default: m.ResourceForm })));
const TasksPage = React.lazy(() => import('@/pages/TasksPage').then(m => ({ default: m.TasksPage })));

// ── Site Engineer route definitions ──────────────────────────────────────
export function engineerRoutes(currentRole: UserRole) {
  return (
    <>
      {/* SITE ENGINEER ROUTES */}
      <Route
        path="/site-engineer"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={ENGINEER_ROLES}>
            <SiteEngineerDashboard />
          </RoleGuard>
        }
      />
      <Route
        path="/site-engineer/*"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={ENGINEER_ROLES}>
            <SiteEngineerDashboard />
          </RoleGuard>
        }
      />
      <Route
        path="/site-engineer/forms/:formType"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={ENGINEER_ROLES}>
            <ResourceForm />
          </RoleGuard>
        }
      />
      <Route
        path="/site-engineer/tasks"
        element={
          <RoleGuard currentRole={currentRole} allowedRoles={ENGINEER_ROLES}>
            <TasksPage />
          </RoleGuard>
        }
      />
    </>
  );
}
