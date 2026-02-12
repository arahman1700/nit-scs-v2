import React, { Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Building2, Network, ArrowRightLeft } from 'lucide-react';
import { SectionLandingPage } from '@/components/SectionLandingPage';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import type { KpiCardProps } from '@/components/KpiCard';
import type { TabDef } from '@/components/SectionTabBar';
import { useEmployees } from '@/api/hooks/useMasterData';

const DelegationsPage = React.lazy(() => import('@/pages/DelegationsPage').then(m => ({ default: m.DelegationsPage })));

const Spinner: React.FC = () => (
  <div className="flex items-center justify-center py-20">
    <div className="w-8 h-8 border-2 border-nesma-secondary border-t-transparent rounded-full animate-spin" />
  </div>
);

function _StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Active: 'bg-emerald-500/20 text-emerald-400',
    Inactive: 'bg-gray-500/20 text-gray-400',
    Pending: 'bg-amber-500/20 text-amber-400',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-white/10 text-gray-300'}`}>
      {status}
    </span>
  );
}

export const EmployeeSectionPage: React.FC = () => {
  const navigate = useNavigate();
  const employeesQuery = useEmployees({ pageSize: 1 });
  const employeesFullQuery = useEmployees({ pageSize: 15 });
  const employeesData = employeesFullQuery.data?.data ?? [];
  const employeesTotal = employeesQuery.data?.meta?.total ?? 0;

  const kpis: KpiCardProps[] = [
    { title: 'Total Employees', value: employeesTotal, icon: Users, color: 'bg-nesma-primary' },
    { title: 'Departments', value: 0, icon: Building2, color: 'bg-blue-500' },
    { title: 'Active Delegations', value: 0, icon: ArrowRightLeft, color: 'bg-purple-500' },
  ];

  const tabs: TabDef[] = [
    { key: 'employees', label: 'Employees' },
    { key: 'departments', label: 'Departments' },
    { key: 'org-chart', label: 'Org Chart' },
    { key: 'delegations', label: 'Delegations' },
  ];

  return (
    <SectionLandingPage
      title="Employees & Org"
      subtitle="Employee directory, departments, org chart, and delegations"
      kpis={kpis}
      tabs={tabs}
      loading={employeesQuery.isLoading}
      defaultTab="employees"
      quickActions={[
        { label: 'Add Employee', icon: Users, onClick: () => navigate('/admin/list/employees') },
        {
          label: 'New Delegation',
          icon: ArrowRightLeft,
          onClick: () => navigate('/admin/employees?tab=delegations'),
          variant: 'secondary',
        },
      ]}
      children={{
        employees: (
          <div className="glass-card rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-4 text-nesma-secondary font-medium">Name</th>
                  <th className="text-left p-4 text-nesma-secondary font-medium">Department</th>
                  <th className="text-left p-4 text-nesma-secondary font-medium">Title</th>
                  <th className="text-left p-4 text-nesma-secondary font-medium">Site</th>
                </tr>
              </thead>
              <tbody>
                {employeesData.slice(0, 15).map(e => (
                  <tr key={e.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="p-4 text-white font-medium">{e.name || '-'}</td>
                    <td className="p-4 text-gray-300">{e.department || '-'}</td>
                    <td className="p-4 text-gray-300">{e.title || '-'}</td>
                    <td className="p-4 text-gray-300">{e.site || '-'}</td>
                  </tr>
                ))}
                {employeesData.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-500">
                      No employees found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {employeesTotal > 15 && (
              <div className="p-3 text-center border-t border-white/10">
                <button
                  onClick={() => navigate('/admin/list/employees')}
                  className="text-nesma-secondary text-sm hover:underline"
                >
                  View All {employeesTotal} Employees
                </button>
              </div>
            )}
          </div>
        ),
        departments: (
          <div className="glass-card rounded-2xl p-8 text-center">
            <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-600" />
            <h4 className="text-white font-medium mb-2">Departments</h4>
            <p className="text-gray-400 text-sm">Manage organizational departments and team structures.</p>
          </div>
        ),
        'org-chart': (
          <div className="glass-card rounded-2xl p-8 text-center">
            <Network className="w-12 h-12 mx-auto mb-4 text-gray-600" />
            <h4 className="text-white font-medium mb-2">Organization Chart</h4>
            <p className="text-gray-400 text-sm">Visual hierarchy of reporting structures and team organization.</p>
          </div>
        ),
        delegations: (
          <RouteErrorBoundary label="Delegations">
            <Suspense fallback={<Spinner />}>
              <DelegationsPage />
            </Suspense>
          </RouteErrorBoundary>
        ),
      }}
    />
  );
};
