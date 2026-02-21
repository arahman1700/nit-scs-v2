import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ArrowDownCircle, Ship, ClipboardCheck, Plus } from 'lucide-react';
import { SectionLandingPage } from '@/components/SectionLandingPage';
import { StatusBadge } from '@/components/StatusBadge';
import type { KpiCardProps } from '@/components/KpiCard';
import type { TabDef } from '@/components/SectionTabBar';
import { useMrrvList, useShipments, useRfimList, useCustomsClearances, useGatePasses } from '@/api/hooks';
import { displayStr } from '@/utils/displayStr';

export const ReceivingSectionPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: mrrvAll, isLoading: mrrvLoading } = useMrrvList({ pageSize: 10, sortBy: 'createdAt', sortDir: 'desc' });
  const { data: mrrvPending } = useMrrvList({ pageSize: 1, status: 'Pending' });
  const { data: shipData } = useShipments({ pageSize: 10, sortBy: 'createdAt', sortDir: 'desc' });
  const { data: shipIncoming } = useShipments({ pageSize: 1, status: 'In Transit' });
  const { data: rfimPending } = useRfimList({ pageSize: 1, status: 'Pending' });
  const { data: customsData } = useCustomsClearances({ pageSize: 10, sortBy: 'createdAt', sortDir: 'desc' });
  const { data: gpData } = useGatePasses({ pageSize: 10, sortBy: 'createdAt', sortDir: 'desc' });

  const mrrvRows = (mrrvAll?.data ?? []) as unknown as Record<string, unknown>[];
  const shipRows = (shipData?.data ?? []) as unknown as Record<string, unknown>[];
  const customsRows = (customsData?.data ?? []) as unknown as Record<string, unknown>[];
  const gpRows = (gpData?.data ?? []) as unknown as Record<string, unknown>[];

  // Status breakdown for overview mini stat cards
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { Draft: 0, Pending: 0, Approved: 0, Inspected: 0 };
    mrrvRows.forEach(r => {
      const s = (r.status as string) ?? 'Draft';
      counts[s] = (counts[s] ?? 0) + 1;
    });
    return counts;
  }, [mrrvRows]);

  const kpis: KpiCardProps[] = [
    { title: 'Pending GRN', value: mrrvPending?.meta?.total ?? 0, icon: Clock, color: 'bg-amber-500' },
    { title: 'Total Receipts', value: mrrvAll?.meta?.total ?? 0, icon: ArrowDownCircle, color: 'bg-emerald-500' },
    { title: 'Incoming Shipments', value: shipIncoming?.meta?.total ?? 0, icon: Ship, color: 'bg-blue-500' },
    { title: 'Pending QC', value: rfimPending?.meta?.total ?? 0, icon: ClipboardCheck, color: 'bg-purple-500' },
  ];

  const tabs: TabDef[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'mrrv', label: 'GRN', badge: mrrvPending?.meta?.total },
    { key: 'shipments', label: 'Shipments' },
    { key: 'customs', label: 'Customs' },
    { key: 'gate-passes', label: 'Gate Passes' },
  ];

  return (
    <SectionLandingPage
      title="Receiving"
      subtitle="Material receipts, shipments, customs clearance, and gate passes"
      kpis={kpis}
      tabs={tabs}
      loading={mrrvLoading}
      quickActions={[
        { label: 'New Receipt (GRN)', icon: ArrowDownCircle, onClick: () => navigate('/admin/forms/grn') },
        { label: 'New Shipment', icon: Ship, onClick: () => navigate('/admin/forms/shipment'), variant: 'secondary' },
        {
          label: 'Customs Clearance',
          icon: Plus,
          onClick: () => navigate('/admin/forms/customs'),
          variant: 'secondary',
        },
      ]}
      children={{
        overview: (
          <div className="space-y-6">
            {/* Status breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(statusCounts).map(([status, count]) => (
                <div key={status} className="glass-card p-4 rounded-xl text-center">
                  <p className="text-2xl font-bold text-white">{count}</p>
                  <p className="text-gray-400 text-xs mt-1">{status}</p>
                </div>
              ))}
            </div>
            {/* Top 10 GRN queue */}
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h3 className="text-white font-semibold">Recent GRN Queue</h3>
                <button
                  onClick={() => navigate('/admin/receiving/grn')}
                  className="text-nesma-secondary text-xs hover:underline"
                >
                  View All
                </button>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    {['Document #', 'Supplier', 'Warehouse', 'Date', 'Status'].map(h => (
                      <th key={h} className="text-nesma-secondary text-xs uppercase tracking-wider text-left px-4 py-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mrrvRows.slice(0, 10).map(r => (
                    <tr key={r.id as string} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {(r.documentNumber as string) ?? (r.id as string).slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-sm text-white">
                        {displayStr(r.supplierName ?? r.supplier) || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {displayStr(r.warehouseName ?? r.warehouse) || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {(r.receivedDate as string) ?? (r.createdAt as string)?.slice(0, 10) ?? '-'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={(r.status as string) ?? 'Draft'} />
                      </td>
                    </tr>
                  ))}
                  {mrrvRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-gray-500 py-8">
                        No receipts
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ),
        mrrv: (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-white font-semibold">Goods Receipt Notes</h3>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/admin/forms/grn')}
                  className="text-nesma-secondary text-xs hover:underline"
                >
                  + Create New
                </button>
                <button
                  onClick={() => navigate('/admin/receiving/grn')}
                  className="text-nesma-secondary text-xs hover:underline"
                >
                  View All
                </button>
              </div>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  {['Document #', 'Supplier', 'Date', 'Warehouse', 'Value', 'Status'].map(h => (
                    <th key={h} className="text-nesma-secondary text-xs uppercase tracking-wider text-left px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mrrvRows.map(r => (
                  <tr key={r.id as string} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {(r.documentNumber as string) ?? (r.id as string).slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-sm text-white">{(r.supplierName as string) ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {(r.receivedDate as string) ?? (r.createdAt as string)?.slice(0, 10) ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">{(r.warehouseName as string) ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-white">
                      {((r.totalValue as number) ?? 0).toLocaleString()} SAR
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={(r.status as string) ?? 'Draft'} />
                    </td>
                  </tr>
                ))}
                {mrrvRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-gray-500 py-8">
                      No GRN records
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ),
        shipments: (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-white font-semibold">Shipments</h3>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/admin/forms/shipment')}
                  className="text-nesma-secondary text-xs hover:underline"
                >
                  + Create New
                </button>
                <button
                  onClick={() => navigate('/admin/receiving/shipments')}
                  className="text-nesma-secondary text-xs hover:underline"
                >
                  View All
                </button>
              </div>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  {['Document #', 'Supplier', 'ETD', 'ETA', 'Port', 'Status'].map(h => (
                    <th key={h} className="text-nesma-secondary text-xs uppercase tracking-wider text-left px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shipRows.map(r => (
                  <tr key={r.id as string} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {(r.documentNumber as string) ?? (r.id as string).slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-sm text-white">{(r.supplierName as string) ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{(r.etd as string) ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{(r.eta as string) ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {(r.portName as string) ?? (r.port as string) ?? '-'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={(r.status as string) ?? 'Pending'} />
                    </td>
                  </tr>
                ))}
                {shipRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-gray-500 py-8">
                      No shipments
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ),
        customs: (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-white font-semibold">Customs Clearances</h3>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/admin/forms/customs')}
                  className="text-nesma-secondary text-xs hover:underline"
                >
                  + Create New
                </button>
                <button
                  onClick={() => navigate('/admin/receiving/customs')}
                  className="text-nesma-secondary text-xs hover:underline"
                >
                  View All
                </button>
              </div>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  {['Document #', 'Shipment', 'Supplier', 'Port', 'Status'].map(h => (
                    <th key={h} className="text-nesma-secondary text-xs uppercase tracking-wider text-left px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customsRows.map(r => (
                  <tr key={r.id as string} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {(r.documentNumber as string) ?? (r.id as string).slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-sm text-white">{(r.shipmentNumber as string) ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{(r.supplierName as string) ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{(r.portName as string) ?? '-'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={(r.status as string) ?? 'Pending'} />
                    </td>
                  </tr>
                ))}
                {customsRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-500 py-8">
                      No customs records
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
                onClick={() => navigate('/admin/receiving/gate-pass')}
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
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {(r.vehiclePlate as string) ?? (r.vehicle as string) ?? '-'}
                    </td>
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
      }}
    />
  );
};
