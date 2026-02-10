import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ArrowUpCircle, CheckCircle, DollarSign, FileText, ArrowRightLeft } from 'lucide-react';
import { SectionLandingPage } from '@/components/SectionLandingPage';
import type { KpiCardProps } from '@/components/KpiCard';
import type { TabDef } from '@/components/SectionTabBar';
import { useMirvList, useMrfList, useGatePasses, useStockTransfers } from '@/api/hooks';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Draft: 'bg-gray-500/20 text-gray-400',
    Pending: 'bg-amber-500/20 text-amber-400',
    'Pending Approval': 'bg-amber-500/20 text-amber-400',
    Approved: 'bg-emerald-500/20 text-emerald-400',
    Issued: 'bg-blue-500/20 text-blue-400',
    Rejected: 'bg-red-500/20 text-red-400',
    Cancelled: 'bg-red-500/20 text-red-400',
    Completed: 'bg-emerald-500/20 text-emerald-400',
    Active: 'bg-emerald-500/20 text-emerald-400',
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${colors[status] || 'bg-white/10 text-gray-400'}`}
    >
      {status}
    </span>
  );
}

export const IssuingSectionPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: mirvAll, isLoading: mirvLoading } = useMirvList({ pageSize: 10, sortBy: 'createdAt', sortDir: 'desc' });
  const { data: mirvPending } = useMirvList({ pageSize: 1, status: 'Pending Approval' });
  const { data: mrfData } = useMrfList({ pageSize: 10, sortBy: 'createdAt', sortDir: 'desc' });
  const { data: gpData } = useGatePasses({ pageSize: 10, sortBy: 'createdAt', sortDir: 'desc' });
  const { data: stData } = useStockTransfers({ pageSize: 10, sortBy: 'createdAt', sortDir: 'desc' });

  const mirvRows = (mirvAll?.data ?? []) as Record<string, unknown>[];
  const mrfRows = (mrfData?.data ?? []) as Record<string, unknown>[];
  const gpRows = (gpData?.data ?? []) as Record<string, unknown>[];
  const stRows = (stData?.data ?? []) as Record<string, unknown>[];

  // Issued this month
  const issuedThisMonth = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return mirvRows.filter(r => {
      const d = (r.issuedDate as string) ?? (r.createdAt as string) ?? '';
      return d.startsWith(ym) && ((r.status as string) === 'Issued' || (r.status as string) === 'Approved');
    }).length;
  }, [mirvRows]);

  // Total issued value
  const valueIssued = useMemo(() => {
    return mirvRows
      .filter(r => (r.status as string) === 'Issued' || (r.status as string) === 'Approved')
      .reduce((sum, r) => sum + ((r.totalValue as number) ?? 0), 0);
  }, [mirvRows]);

  // Status breakdown for overview
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { Draft: 0, 'Pending Approval': 0, Approved: 0, Issued: 0, Rejected: 0 };
    mirvRows.forEach(r => {
      const s = (r.status as string) ?? 'Draft';
      counts[s] = (counts[s] ?? 0) + 1;
    });
    return counts;
  }, [mirvRows]);

  // Pending MIs sorted by value descending
  const approvalQueue = useMemo(() => {
    return mirvRows
      .filter(r => (r.status as string) === 'Pending Approval' || (r.status as string) === 'Pending')
      .sort((a, b) => ((b.totalValue as number) ?? 0) - ((a.totalValue as number) ?? 0));
  }, [mirvRows]);

  const kpis: KpiCardProps[] = [
    { title: 'Pending Approvals', value: mirvPending?.meta?.total ?? 0, icon: Clock, color: 'bg-amber-500' },
    { title: 'Total Issues', value: mirvAll?.meta?.total ?? 0, icon: ArrowUpCircle, color: 'bg-blue-500' },
    { title: 'Issued This Month', value: issuedThisMonth, icon: CheckCircle, color: 'bg-emerald-500' },
    {
      title: 'Value Issued',
      value: `SAR ${valueIssued.toLocaleString()}`,
      icon: DollarSign,
      color: 'bg-nesma-primary',
    },
  ];

  const tabs: TabDef[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'mirv', label: 'MI', badge: mirvPending?.meta?.total },
    { key: 'approvals', label: 'Approvals', badge: approvalQueue.length || undefined },
    { key: 'mrf', label: 'MR' },
    { key: 'gate-passes', label: 'Gate Passes' },
    { key: 'stock-transfers', label: 'Stock Transfers' },
  ];

  return (
    <SectionLandingPage
      title="Issuing"
      subtitle="Material issues, approvals, requisitions, and outbound transfers"
      kpis={kpis}
      tabs={tabs}
      loading={mirvLoading}
      quickActions={[
        { label: 'New Issue (MI)', icon: ArrowUpCircle, onClick: () => navigate('/admin/forms/mi') },
        { label: 'Material Request', icon: FileText, onClick: () => navigate('/admin/forms/mr'), variant: 'secondary' },
        {
          label: 'Stock Transfer',
          icon: ArrowRightLeft,
          onClick: () => navigate('/admin/forms/stock-transfer'),
          variant: 'secondary',
        },
      ]}
      children={{
        overview: (
          <div className="space-y-6">
            {/* Status breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries(statusCounts).map(([status, count]) => (
                <div key={status} className="glass-card p-4 rounded-xl text-center">
                  <p className="text-2xl font-bold text-white">{count}</p>
                  <p className="text-gray-400 text-xs mt-1">{status}</p>
                </div>
              ))}
            </div>
            {/* Approval queue */}
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h3 className="text-white font-semibold">Approval Queue (by Value)</h3>
                <button
                  onClick={() => navigate('/admin/issuing/mi')}
                  className="text-nesma-secondary text-xs hover:underline"
                >
                  View All
                </button>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    {['Document #', 'Project', 'Requester', 'Value', 'Status'].map(h => (
                      <th key={h} className="text-nesma-secondary text-xs uppercase tracking-wider text-left px-4 py-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {approvalQueue.slice(0, 10).map(r => (
                    <tr key={r.id as string} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {(r.documentNumber as string) ?? (r.id as string).slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-sm text-white">{(r.projectName as string) ?? '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {(r.requesterName as string) ?? (r.requestedBy as string) ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-white font-medium">
                        {((r.totalValue as number) ?? 0).toLocaleString()} SAR
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={(r.status as string) ?? 'Pending'} />
                      </td>
                    </tr>
                  ))}
                  {approvalQueue.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-gray-500 py-8">
                        No pending approvals
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ),
        mirv: (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-white font-semibold">Material Issuances</h3>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/admin/forms/mi')}
                  className="text-nesma-secondary text-xs hover:underline"
                >
                  + Create New
                </button>
                <button
                  onClick={() => navigate('/admin/issuing/mi')}
                  className="text-nesma-secondary text-xs hover:underline"
                >
                  View All
                </button>
              </div>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  {['Document #', 'Project', 'Requester', 'Date', 'Value', 'Status'].map(h => (
                    <th key={h} className="text-nesma-secondary text-xs uppercase tracking-wider text-left px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mirvRows.map(r => (
                  <tr key={r.id as string} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {(r.documentNumber as string) ?? (r.id as string).slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-sm text-white">{(r.projectName as string) ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{(r.requesterName as string) ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {(r.issuedDate as string) ?? (r.createdAt as string)?.slice(0, 10) ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-white">
                      {((r.totalValue as number) ?? 0).toLocaleString()} SAR
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={(r.status as string) ?? 'Draft'} />
                    </td>
                  </tr>
                ))}
                {mirvRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-gray-500 py-8">
                      No MI records
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ),
        approvals: (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-white font-semibold">Pending Approvals</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  {['Document #', 'Project', 'Requester', 'Value', 'Status', 'Action'].map(h => (
                    <th key={h} className="text-nesma-secondary text-xs uppercase tracking-wider text-left px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {approvalQueue.map(r => (
                  <tr key={r.id as string} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {(r.documentNumber as string) ?? (r.id as string).slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-sm text-white">{(r.projectName as string) ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{(r.requesterName as string) ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-white font-medium">
                      {((r.totalValue as number) ?? 0).toLocaleString()} SAR
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={(r.status as string) ?? 'Pending'} />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/admin/forms/mi?id=${r.id}`)}
                        className="text-nesma-secondary text-xs hover:underline"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
                {approvalQueue.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-gray-500 py-8">
                      No pending approvals
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ),
        mrf: (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-white font-semibold">Material Requests</h3>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/admin/forms/mr')}
                  className="text-nesma-secondary text-xs hover:underline"
                >
                  + Create New
                </button>
                <button
                  onClick={() => navigate('/admin/issuing/mr')}
                  className="text-nesma-secondary text-xs hover:underline"
                >
                  View All
                </button>
              </div>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  {['Document #', 'Project', 'Requester', 'Date', 'Status'].map(h => (
                    <th key={h} className="text-nesma-secondary text-xs uppercase tracking-wider text-left px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mrfRows.map(r => (
                  <tr key={r.id as string} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {(r.documentNumber as string) ?? (r.id as string).slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-sm text-white">{(r.projectName as string) ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{(r.requesterName as string) ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{(r.createdAt as string)?.slice(0, 10) ?? '-'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={(r.status as string) ?? 'Pending'} />
                    </td>
                  </tr>
                ))}
                {mrfRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-500 py-8">
                      No MR records
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ),
        'gate-passes': (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-white font-semibold">Gate Passes</h3>
              <button
                onClick={() => navigate('/admin/issuing/gate-pass')}
                className="text-nesma-secondary text-xs hover:underline"
              >
                View All
              </button>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  {['Document #', 'Type', 'Date', 'Warehouse', 'Vehicle', 'Status'].map(h => (
                    <th key={h} className="text-nesma-secondary text-xs uppercase tracking-wider text-left px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gpRows.map(r => (
                  <tr key={r.id as string} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {(r.documentNumber as string) ?? (r.id as string).slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-sm text-white">{(r.type as string) ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {(r.date as string) ?? (r.createdAt as string)?.slice(0, 10) ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">{(r.warehouseName as string) ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{(r.vehiclePlate as string) ?? '-'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={(r.status as string) ?? 'Pending'} />
                    </td>
                  </tr>
                ))}
                {gpRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-gray-500 py-8">
                      No gate passes
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ),
        'stock-transfers': (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-white font-semibold">Stock Transfers</h3>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/admin/forms/stock-transfer')}
                  className="text-nesma-secondary text-xs hover:underline"
                >
                  + Create New
                </button>
                <button
                  onClick={() => navigate('/admin/issuing/stock-transfer')}
                  className="text-nesma-secondary text-xs hover:underline"
                >
                  View All
                </button>
              </div>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  {['Document #', 'Date', 'From', 'To', 'Items', 'Status'].map(h => (
                    <th key={h} className="text-nesma-secondary text-xs uppercase tracking-wider text-left px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stRows.map(r => (
                  <tr key={r.id as string} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {(r.documentNumber as string) ?? (r.id as string).slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {(r.transferDate as string) ?? (r.createdAt as string)?.slice(0, 10) ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-white">
                      {(r.fromWarehouseName as string) ?? (r.fromWarehouse as string) ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {(r.toWarehouseName as string) ?? (r.toWarehouse as string) ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">{(r.itemCount as number) ?? '-'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={(r.status as string) ?? 'Pending'} />
                    </td>
                  </tr>
                ))}
                {stRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-gray-500 py-8">
                      No stock transfers
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ),
      }}
    />
  );
};
