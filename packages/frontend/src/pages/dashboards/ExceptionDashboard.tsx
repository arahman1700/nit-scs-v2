import React, { useState } from 'react';
import { useExceptions } from '@/api/hooks/useDashboard';
import type { ExceptionData } from '@/api/hooks/useDashboard';
import {
  AlertTriangle,
  Clock,
  PackageMinus,
  PauseCircle,
  Timer,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle,
} from 'lucide-react';

type SectionKey = 'overdueApprovals' | 'slaBreaches' | 'lowStock' | 'stalledDocuments' | 'expiringInventory';

const V2_TYPE_NAMES: Record<string, string> = {
  mirv: 'MI',
  mrrv: 'GRN',
  jo: 'JO',
  mrf: 'MR',
};

function daysSince(dateStr: string | Date): number {
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function daysUntil(dateStr: string): number {
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function KpiCard({
  icon: Icon,
  label,
  count,
  colorClass,
}: {
  icon: typeof Clock;
  label: string;
  count: number;
  colorClass: string;
}) {
  const isZero = count === 0;
  return (
    <div className="glass-card rounded-2xl p-4 border border-white/10">
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-2 rounded-xl ${isZero ? 'bg-white/5' : colorClass}`}>
          <Icon size={18} className={isZero ? 'text-gray-500' : 'text-white'} />
        </div>
        <span className="text-xs text-gray-400 leading-tight">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${isZero ? 'text-gray-500' : 'text-white'}`}>{count}</div>
    </div>
  );
}

function CollapsibleSection({
  title,
  count,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const Toggle = isOpen ? ChevronUp : ChevronDown;
  return (
    <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {count > 0 ? (
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-500/20 text-red-400">{count}</span>
          ) : (
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-white/10 text-gray-500">0</span>
          )}
        </div>
        <Toggle size={16} className="text-gray-400" />
      </button>
      {isOpen && <div className="border-t border-white/10">{children}</div>}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-gray-500">
      <CheckCircle size={18} />
      <span className="text-sm">No exceptions</span>
    </div>
  );
}

function OverdueApprovalsTable({ items }: { items: ExceptionData['overdueApprovals']['items'] }) {
  if (items.length === 0) return <EmptyState />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10">
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Type</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">ID</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
              Age (days)
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr
              key={`${item.type}-${item.id}-${i}`}
              className="border-b border-white/5 hover:bg-white/5 transition-colors"
            >
              <td className="px-4 py-3 text-sm font-medium text-white">
                {V2_TYPE_NAMES[item.type] ?? item.type.toUpperCase()}
              </td>
              <td className="px-4 py-3 text-sm text-gray-300 font-mono">{item.id.slice(0, 8)}</td>
              <td className="px-4 py-3">
                <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-400">
                  {item.status.replace(/_/g, ' ')}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-red-400 text-right font-medium">{daysSince(item.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SlaBreachesTable({ items }: { items: ExceptionData['slaBreaches']['items'] }) {
  if (items.length === 0) return <EmptyState />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10">
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Document #
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Due Date</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
              Days Overdue
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
              <td className="px-4 py-3 text-sm font-medium text-white">{item.documentNumber}</td>
              <td className="px-4 py-3">
                <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/20 text-red-400">
                  {item.status.replace(/_/g, ' ')}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-300">{new Date(item.slaDueDate).toLocaleDateString()}</td>
              <td className="px-4 py-3 text-sm text-red-400 text-right font-medium">{daysSince(item.slaDueDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LowStockTable({ items }: { items: ExceptionData['lowStock']['items'] }) {
  if (items.length === 0) return <EmptyState />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10">
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Item Code
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Item Name
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Warehouse
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
              Qty on Hand
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
              Min Level
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Deficit</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const deficit = item.min_level - item.qty_on_hand;
            return (
              <tr key={`${item.item_id}-${i}`} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 text-sm font-mono text-white">{item.item_code}</td>
                <td className="px-4 py-3 text-sm text-gray-300">{item.item_name}</td>
                <td className="px-4 py-3 text-sm text-gray-300">{item.warehouse_name}</td>
                <td className="px-4 py-3 text-sm text-amber-400 text-right">{item.qty_on_hand}</td>
                <td className="px-4 py-3 text-sm text-gray-400 text-right">{item.min_level}</td>
                <td className="px-4 py-3 text-sm text-red-400 text-right font-medium">
                  {deficit > 0 ? `-${deficit}` : '0'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StalledDocumentsTable({ items }: { items: ExceptionData['stalledDocuments']['items'] }) {
  if (items.length === 0) return <EmptyState />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10">
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Type</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">ID</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Last Updated
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
              Days Stalled
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr
              key={`${item.type}-${item.id}-${i}`}
              className="border-b border-white/5 hover:bg-white/5 transition-colors"
            >
              <td className="px-4 py-3 text-sm font-medium text-white">
                {V2_TYPE_NAMES[item.type] ?? item.type.toUpperCase()}
              </td>
              <td className="px-4 py-3 text-sm text-gray-300 font-mono">{item.id.slice(0, 8)}</td>
              <td className="px-4 py-3">
                <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-400">
                  {item.status.replace(/_/g, ' ')}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-300">{new Date(item.updated_at).toLocaleDateString()}</td>
              <td className="px-4 py-3 text-sm text-amber-400 text-right font-medium">{daysSince(item.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExpiringInventoryTable({ items }: { items: ExceptionData['expiringInventory']['items'] }) {
  if (items.length === 0) return <EmptyState />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10">
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Item Code
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Item Name
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Expiry Date
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
              Days Until Expiry
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => {
            const days = daysUntil(item.expiryDate);
            return (
              <tr key={item.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 text-sm font-mono text-white">{item.item.itemCode}</td>
                <td className="px-4 py-3 text-sm text-gray-300">{item.item.itemName}</td>
                <td className="px-4 py-3 text-sm text-gray-300">{new Date(item.expiryDate).toLocaleDateString()}</td>
                <td
                  className={`px-4 py-3 text-sm text-right font-medium ${days <= 7 ? 'text-red-400' : 'text-amber-400'}`}
                >
                  {days}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export const ExceptionDashboard: React.FC = () => {
  const query = useExceptions();
  const data = (query.data as unknown as { data?: ExceptionData } | undefined)?.data;
  const isLoading = query.isLoading;
  const isFetching = query.isFetching;

  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    overdueApprovals: true,
    slaBreaches: true,
    lowStock: true,
    stalledDocuments: false,
    expiringInventory: false,
  });

  const toggle = (key: SectionKey) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nesma-secondary" />
      </div>
    );
  }

  if (!data) {
    return <div className="glass-card rounded-2xl p-10 text-center text-gray-400">No exception data available</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <AlertTriangle size={24} className="text-nesma-secondary" />
            Operational Exceptions
            {data.totalExceptions > 0 && (
              <span className="px-3 py-1 text-sm font-bold rounded-full bg-red-500/20 text-red-400">
                {data.totalExceptions}
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-400 mt-1">Items requiring attention across all operations</p>
        </div>
        {isFetching && !isLoading && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Loader2 size={14} className="animate-spin" />
            Refreshing...
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          icon={Clock}
          label="Overdue Approvals"
          count={data.overdueApprovals.count}
          colorClass={data.overdueApprovals.count > 0 ? 'bg-red-600/20' : 'bg-white/5'}
        />
        <KpiCard
          icon={AlertTriangle}
          label="SLA Breaches"
          count={data.slaBreaches.count}
          colorClass={data.slaBreaches.count > 0 ? 'bg-red-600/20' : 'bg-white/5'}
        />
        <KpiCard
          icon={PackageMinus}
          label="Low Stock"
          count={data.lowStock.count}
          colorClass={data.lowStock.count > 0 ? 'bg-amber-600/20' : 'bg-white/5'}
        />
        <KpiCard
          icon={PauseCircle}
          label="Stalled Documents"
          count={data.stalledDocuments.count}
          colorClass={data.stalledDocuments.count > 0 ? 'bg-amber-600/20' : 'bg-white/5'}
        />
        <KpiCard
          icon={Timer}
          label="Expiring Inventory"
          count={data.expiringInventory.count}
          colorClass={data.expiringInventory.count > 0 ? 'bg-amber-600/20' : 'bg-white/5'}
        />
      </div>

      {/* Collapsible Sections */}
      <div className="space-y-4">
        <CollapsibleSection
          title="Overdue Approvals"
          count={data.overdueApprovals.count}
          isOpen={openSections.overdueApprovals}
          onToggle={() => toggle('overdueApprovals')}
        >
          <OverdueApprovalsTable items={data.overdueApprovals.items} />
        </CollapsibleSection>

        <CollapsibleSection
          title="SLA Breaches"
          count={data.slaBreaches.count}
          isOpen={openSections.slaBreaches}
          onToggle={() => toggle('slaBreaches')}
        >
          <SlaBreachesTable items={data.slaBreaches.items} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Low Stock Items"
          count={data.lowStock.count}
          isOpen={openSections.lowStock}
          onToggle={() => toggle('lowStock')}
        >
          <LowStockTable items={data.lowStock.items} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Stalled Documents"
          count={data.stalledDocuments.count}
          isOpen={openSections.stalledDocuments}
          onToggle={() => toggle('stalledDocuments')}
        >
          <StalledDocumentsTable items={data.stalledDocuments.items} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Expiring Inventory"
          count={data.expiringInventory.count}
          isOpen={openSections.expiringInventory}
          onToggle={() => toggle('expiringInventory')}
        >
          <ExpiringInventoryTable items={data.expiringInventory.items} />
        </CollapsibleSection>
      </div>
    </div>
  );
};
