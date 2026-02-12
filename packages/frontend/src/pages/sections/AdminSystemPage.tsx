import React, { Suspense } from 'react';
import { Shield, Settings as SettingsIcon, Zap, Mail, ArrowRightLeft, GitBranch } from 'lucide-react';
import { SectionLandingPage } from '@/components/SectionLandingPage';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import type { KpiCardProps } from '@/components/KpiCard';
import type { TabDef } from '@/components/SectionTabBar';

// Lazy-load embedded page components
const RolesPage = React.lazy(() => import('@/pages/RolesPage').then(m => ({ default: m.RolesPage })));
const AuditLogPage = React.lazy(() => import('@/pages/AuditLogPage').then(m => ({ default: m.AuditLogPage })));
const SettingsPage = React.lazy(() => import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const ReportsPage = React.lazy(() => import('@/pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
const WorkflowListPage = React.lazy(() =>
  import('@/pages/WorkflowListPage').then(m => ({ default: m.WorkflowListPage })),
);
const EmailTemplatesPage = React.lazy(() =>
  import('@/pages/EmailTemplatesPage').then(m => ({ default: m.EmailTemplatesPage })),
);
const EmailLogsPage = React.lazy(() => import('@/pages/EmailLogsPage').then(m => ({ default: m.EmailLogsPage })));
const DelegationsPage = React.lazy(() => import('@/pages/DelegationsPage').then(m => ({ default: m.DelegationsPage })));
const ApprovalLevelsPage = React.lazy(() =>
  import('@/pages/admin/ApprovalLevelsPage').then(m => ({ default: m.ApprovalLevelsPage })),
);

const Spinner: React.FC = () => (
  <div className="flex items-center justify-center py-20">
    <div className="w-8 h-8 border-2 border-nesma-secondary border-t-transparent rounded-full animate-spin" />
  </div>
);

const kpis: KpiCardProps[] = [
  {
    title: 'System Roles',
    value: 8,
    icon: Shield,
    color: 'bg-nesma-primary',
    sublabel: 'RBAC Roles',
  },
  {
    title: 'Workflows',
    value: 'Automate',
    icon: Zap,
    color: 'bg-amber-500',
  },
  {
    title: 'Email Templates',
    value: 'Configure',
    icon: Mail,
    color: 'bg-blue-500',
  },
  {
    title: 'Settings',
    value: 'Configure',
    icon: SettingsIcon,
    color: 'bg-emerald-500',
  },
  {
    title: 'Delegations',
    value: 'Manage',
    icon: ArrowRightLeft,
    color: 'bg-purple-500',
  },
  {
    title: 'Approval Levels',
    value: 'Configure',
    icon: GitBranch,
    color: 'bg-cyan-500',
  },
];

const tabs: TabDef[] = [
  { key: 'roles', label: 'Roles & Permissions' },
  { key: 'audit', label: 'Audit Log' },
  { key: 'settings', label: 'Settings' },
  { key: 'reports', label: 'Reports' },
  { key: 'workflows', label: 'Workflows' },
  { key: 'email-templates', label: 'Email Templates' },
  { key: 'email-logs', label: 'Email Logs' },
  { key: 'delegations', label: 'Delegations' },
  { key: 'approval-levels', label: 'Approval Levels' },
];

export const AdminSystemPage: React.FC = () => {
  return (
    <SectionLandingPage
      title="System Administration"
      subtitle="Roles, audit trail, system settings, and reports"
      kpis={kpis}
      tabs={tabs}
      defaultTab="roles"
      children={{
        roles: (
          <RouteErrorBoundary label="Roles & Permissions">
            <Suspense fallback={<Spinner />}>
              <RolesPage />
            </Suspense>
          </RouteErrorBoundary>
        ),
        audit: (
          <RouteErrorBoundary label="Audit Log">
            <Suspense fallback={<Spinner />}>
              <AuditLogPage />
            </Suspense>
          </RouteErrorBoundary>
        ),
        settings: (
          <RouteErrorBoundary label="Settings">
            <Suspense fallback={<Spinner />}>
              <SettingsPage />
            </Suspense>
          </RouteErrorBoundary>
        ),
        reports: (
          <RouteErrorBoundary label="Reports">
            <Suspense fallback={<Spinner />}>
              <ReportsPage />
            </Suspense>
          </RouteErrorBoundary>
        ),
        workflows: (
          <RouteErrorBoundary label="Workflows">
            <Suspense fallback={<Spinner />}>
              <WorkflowListPage />
            </Suspense>
          </RouteErrorBoundary>
        ),
        'email-templates': (
          <RouteErrorBoundary label="Email Templates">
            <Suspense fallback={<Spinner />}>
              <EmailTemplatesPage />
            </Suspense>
          </RouteErrorBoundary>
        ),
        'email-logs': (
          <RouteErrorBoundary label="Email Logs">
            <Suspense fallback={<Spinner />}>
              <EmailLogsPage />
            </Suspense>
          </RouteErrorBoundary>
        ),
        delegations: (
          <RouteErrorBoundary label="Delegations">
            <Suspense fallback={<Spinner />}>
              <DelegationsPage />
            </Suspense>
          </RouteErrorBoundary>
        ),
        'approval-levels': (
          <RouteErrorBoundary label="Approval Levels">
            <Suspense fallback={<Spinner />}>
              <ApprovalLevelsPage />
            </Suspense>
          </RouteErrorBoundary>
        ),
      }}
    />
  );
};
