import React, { Suspense } from 'react';
import { Shield, Settings as SettingsIcon, Zap, Mail } from 'lucide-react';
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
const ApprovalLevelsPage = React.lazy(() =>
  import('@/pages/admin/ApprovalLevelsPage').then(m => ({ default: m.ApprovalLevelsPage })),
);

// Platform tools — lazy loaded
const DashboardBuilderPage = React.lazy(() =>
  import('@/pages/DashboardBuilderPage').then(m => ({ default: m.DashboardBuilderPage })),
);
const ReportBuilderPage = React.lazy(() =>
  import('@/pages/ReportBuilderPage').then(m => ({ default: m.ReportBuilderPage })),
);
const DynamicTypeListPage = React.lazy(() =>
  import('@/pages/admin/DynamicTypeListPage').then(m => ({ default: m.DynamicTypeListPage })),
);
const CustomDataSourcePage = React.lazy(() =>
  import('@/pages/admin/CustomDataSourcePage').then(m => ({ default: m.CustomDataSourcePage })),
);
const CustomFieldsPage = React.lazy(() =>
  import('@/pages/admin/CustomFieldsPage').then(m => ({ default: m.CustomFieldsPage })),
);
const WorkflowTemplatesPage = React.lazy(() =>
  import('@/pages/admin/WorkflowTemplatesPage').then(m => ({ default: m.WorkflowTemplatesPage })),
);
const AiInsightsPage = React.lazy(() =>
  import('@/modules/ai/AiInsightsPage').then(m => ({ default: m.AiInsightsPage })),
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
];

const tabs: TabDef[] = [
  { key: 'roles', label: 'Roles & Permissions' },
  { key: 'audit', label: 'Audit Log' },
  { key: 'settings', label: 'Settings' },
  { key: 'reports', label: 'Reports' },
  { key: 'approval-levels', label: 'Approval Levels' },
  { key: 'workflows', label: 'Workflows' },
  { key: 'email-templates', label: 'Email Templates' },
  { key: 'email-logs', label: 'Email Logs' },
  { key: 'dashboard-builder', label: 'Dashboard Builder' },
  { key: 'report-builder', label: 'Report Builder' },
  { key: 'document-types', label: 'Document Types' },
  { key: 'data-sources', label: 'Data Sources' },
  { key: 'custom-fields', label: 'Custom Fields' },
  { key: 'workflow-templates', label: 'Workflow Templates' },
  { key: 'ai-insights', label: 'AI Insights' },
];

// Backward-compatible alias
export { AdminSystemPage as SettingsSectionPage };

export const AdminSystemPage: React.FC = () => {
  return (
    <SectionLandingPage
      title="Settings"
      subtitle="Roles, audit trail, system settings, platform tools, and reports"
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
        'approval-levels': (
          <RouteErrorBoundary label="Approval Levels">
            <Suspense fallback={<Spinner />}>
              <ApprovalLevelsPage />
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
        'dashboard-builder': (
          <RouteErrorBoundary label="Dashboard Builder">
            <Suspense fallback={<Spinner />}>
              <DashboardBuilderPage />
            </Suspense>
          </RouteErrorBoundary>
        ),
        'report-builder': (
          <RouteErrorBoundary label="Report Builder">
            <Suspense fallback={<Spinner />}>
              <ReportBuilderPage />
            </Suspense>
          </RouteErrorBoundary>
        ),
        'document-types': (
          <RouteErrorBoundary label="Document Types">
            <Suspense fallback={<Spinner />}>
              <DynamicTypeListPage />
            </Suspense>
          </RouteErrorBoundary>
        ),
        'data-sources': (
          <RouteErrorBoundary label="Data Sources">
            <Suspense fallback={<Spinner />}>
              <CustomDataSourcePage />
            </Suspense>
          </RouteErrorBoundary>
        ),
        'custom-fields': (
          <RouteErrorBoundary label="Custom Fields">
            <Suspense fallback={<Spinner />}>
              <CustomFieldsPage />
            </Suspense>
          </RouteErrorBoundary>
        ),
        'workflow-templates': (
          <RouteErrorBoundary label="Workflow Templates">
            <Suspense fallback={<Spinner />}>
              <WorkflowTemplatesPage />
            </Suspense>
          </RouteErrorBoundary>
        ),
        'ai-insights': (
          <RouteErrorBoundary label="AI Insights">
            <Suspense fallback={<Spinner />}>
              <AiInsightsPage />
            </Suspense>
          </RouteErrorBoundary>
        ),
      }}
    />
  );
};
