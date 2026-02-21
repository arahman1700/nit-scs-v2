import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
} from 'recharts';
import {
  Users,
  Package,
  ArrowUpDown,
  ClipboardCheck,
  Clock,
  TrendingUp,
  Settings,
  Save,
  BarChart3,
} from 'lucide-react';
import { KpiCard } from '@/components/KpiCard';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import { useLaborProductivity } from '@/api/hooks/useLaborProductivity';
import { useLaborStandards, useUpsertLaborStandard, useLaborPerformance } from '@/api/hooks/useLabor';
import type { WorkerProductivity, ProductivitySummary } from '@/api/hooks/useLaborProductivity';
import type { LaborStandard, PerformanceWorker } from '@/api/hooks/useLabor';

type TabKey = 'productivity' | 'standards' | 'performance';

// ── Worker Row ────────────────────────────────────────────────────────

function WorkerRow({ worker, rank }: { worker: WorkerProductivity; rank: number }) {
  const total =
    worker.metrics.grnsProcessed +
    worker.metrics.misIssued +
    worker.metrics.wtsTransferred +
    worker.metrics.tasksCompleted;
  return (
    <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
      <td className="px-4 py-3 text-sm text-gray-400">{rank}</td>
      <td className="px-4 py-3">
        <div className="text-sm font-medium text-white">{worker.fullName}</div>
        <div className="text-xs text-gray-500 capitalize">{worker.role.replace(/_/g, ' ')}</div>
      </td>
      <td className="px-4 py-3 text-sm text-white text-center">{worker.metrics.grnsProcessed}</td>
      <td className="px-4 py-3 text-sm text-white text-center">{worker.metrics.misIssued}</td>
      <td className="px-4 py-3 text-sm text-white text-center">{worker.metrics.wtsTransferred}</td>
      <td className="px-4 py-3 text-sm text-white text-center">{worker.metrics.tasksCompleted}</td>
      <td className="px-4 py-3 text-sm text-white text-center font-semibold">{total}</td>
      <td className="px-4 py-3 text-sm text-gray-400 text-center">
        {worker.metrics.avgTaskDurationMinutes != null ? `${worker.metrics.avgTaskDurationMinutes} min` : '—'}
      </td>
    </tr>
  );
}

// ── Standards Tab ─────────────────────────────────────────────────────

const DEFAULT_TASK_TYPES = [
  { taskType: 'grn_receive', label: 'GRN Receiving' },
  { taskType: 'mi_issue', label: 'MI Issuance' },
  { taskType: 'wt_transfer', label: 'Warehouse Transfer' },
  { taskType: 'qci_inspect', label: 'QCI Inspection' },
  { taskType: 'putaway', label: 'Put-Away' },
  { taskType: 'picking', label: 'Picking' },
  { taskType: 'packing', label: 'Packing' },
  { taskType: 'cycle_count', label: 'Cycle Count' },
];

function StandardsTab() {
  const standardsQuery = useLaborStandards();
  const upsertMutation = useUpsertLaborStandard();
  const standards = (standardsQuery.data as unknown as { data?: LaborStandard[] } | undefined)?.data || [];

  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ standardMinutes: string; description: string; unitOfMeasure: string }>(
    {
      standardMinutes: '',
      description: '',
      unitOfMeasure: 'document',
    },
  );

  const getStandard = (taskType: string) => standards.find(s => s.taskType === taskType);

  const startEdit = (taskType: string) => {
    const existing = getStandard(taskType);
    setEditingRow(taskType);
    setEditValues({
      standardMinutes: existing ? String(existing.standardMinutes) : '',
      description: existing?.description || '',
      unitOfMeasure: existing?.unitOfMeasure || 'document',
    });
  };

  const saveEdit = (taskType: string) => {
    const mins = parseFloat(editValues.standardMinutes);
    if (isNaN(mins) || mins <= 0) return;
    upsertMutation.mutate(
      {
        taskType,
        standardMinutes: mins,
        description: editValues.description || undefined,
        unitOfMeasure: editValues.unitOfMeasure || undefined,
      },
      {
        onSuccess: () => setEditingRow(null),
      },
    );
  };

  if (standardsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nesma-secondary" />
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
      <div className="px-6 py-4 border-b border-white/10">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Settings size={18} className="text-nesma-secondary" />
          Labor Standards Configuration
        </h2>
        <p className="text-sm text-gray-400 mt-1">Define standard minutes per task type for efficiency calculations</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Task Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Description
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                Standard Minutes
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Unit</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {DEFAULT_TASK_TYPES.map(({ taskType, label }) => {
              const existing = getStandard(taskType);
              const isEditing = editingRow === taskType;

              return (
                <tr key={taskType} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-white">{label}</div>
                    <div className="text-xs text-gray-500">{taskType}</div>
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editValues.description}
                        onChange={e => setEditValues(v => ({ ...v, description: e.target.value }))}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white w-full focus:outline-none focus:border-nesma-secondary/50"
                        placeholder="Optional description"
                      />
                    ) : (
                      <span className="text-sm text-gray-400">{existing?.description || '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editValues.standardMinutes}
                        onChange={e => setEditValues(v => ({ ...v, standardMinutes: e.target.value }))}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white w-24 text-center focus:outline-none focus:border-nesma-secondary/50"
                        placeholder="0"
                        min="0"
                        step="0.5"
                      />
                    ) : (
                      <span className="text-sm text-white font-semibold">
                        {existing ? existing.standardMinutes : '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isEditing ? (
                      <select
                        value={editValues.unitOfMeasure}
                        onChange={e => setEditValues(v => ({ ...v, unitOfMeasure: e.target.value }))}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-nesma-secondary/50"
                      >
                        <option value="document">document</option>
                        <option value="line_item">line_item</option>
                        <option value="unit">unit</option>
                      </select>
                    ) : (
                      <span className="text-sm text-gray-400">{existing?.unitOfMeasure || '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isEditing ? (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => saveEdit(taskType)}
                          disabled={upsertMutation.isPending}
                          className="px-3 py-1.5 bg-nesma-accent/20 text-nesma-accent rounded-lg text-xs font-medium hover:bg-nesma-accent/30 transition-colors"
                        >
                          <Save size={14} className="inline mr-1" />
                          Save
                        </button>
                        <button
                          onClick={() => setEditingRow(null)}
                          className="px-3 py-1.5 bg-white/5 text-gray-400 rounded-lg text-xs font-medium hover:bg-white/10 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(taskType)}
                        className="px-3 py-1.5 bg-nesma-primary/20 text-nesma-secondary rounded-lg text-xs font-medium hover:bg-nesma-primary/30 transition-colors"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Performance Tab ───────────────────────────────────────────────────

function PerformanceTab() {
  const [days, setDays] = useState(30);
  const performanceQuery = useLaborPerformance(days);
  const report = (
    performanceQuery.data as unknown as
      | {
          data?: {
            period: { days: number; since: string };
            standards: Array<{ taskType: string; standardMinutes: number; unit: string }>;
            workers: PerformanceWorker[];
          };
        }
      | undefined
  )?.data;

  const getEfficiencyColor = (eff: number) => {
    if (eff >= 100) return '#10b981'; // green
    if (eff >= 80) return '#f59e0b'; // amber
    return '#ef4444'; // red
  };

  const getEfficiencyLabel = (eff: number) => {
    if (eff >= 100) return 'text-emerald-400';
    if (eff >= 80) return 'text-amber-400';
    return 'text-red-400';
  };

  if (performanceQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nesma-secondary" />
      </div>
    );
  }

  if (!report || report.workers.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-10 text-center text-gray-400">
        No performance data available. Configure labor standards and ensure workers have logged activity.
      </div>
    );
  }

  const chartData = report.workers.slice(0, 15).map(w => ({
    name: w.employeeName.split(' ').slice(0, 2).join(' '),
    efficiency: w.efficiency,
    tasks: w.totalTasks,
  }));

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">
            Showing {report.workers.length} workers over {report.period.days} days
          </p>
        </div>
        <select
          value={days}
          onChange={e => setDays(Number(e.target.value))}
          className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-nesma-secondary/50"
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Efficiency Bar Chart */}
      <div className="glass-card rounded-2xl p-6 border border-white/10">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <BarChart3 size={18} className="text-nesma-secondary" />
          Worker Efficiency vs Standard
        </h2>
        <ResponsiveContainer width="100%" height={Math.max(250, chartData.length * 40)}>
          <BarChart layout="vertical" data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis
              type="number"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              domain={[0, 'auto']}
              tickFormatter={v => `${v}%`}
            />
            <YAxis dataKey="name" type="category" tick={{ fill: '#9ca3af', fontSize: 12 }} width={120} />
            <Tooltip
              contentStyle={{
                background: '#0a1929',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
              }}
              labelStyle={{ color: '#fff' }}
              formatter={value => [`${value}%`, 'Efficiency']}
            />
            <Bar dataKey="efficiency" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={getEfficiencyColor(entry.efficiency)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center justify-center gap-6 mt-4 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-500" /> 100%+ (Above Standard)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-amber-500" /> 80-100% (Near Standard)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-red-500" /> Below 80% (Below Standard)
          </span>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Users size={18} className="text-nesma-secondary" />
            Detailed Performance Metrics
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">#</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Worker
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Tasks
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Std Minutes
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Efficiency
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Breakdown
                </th>
              </tr>
            </thead>
            <tbody>
              {report.workers.map((worker, i) => (
                <tr key={worker.employeeId} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-white">{worker.employeeName}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-white text-center">{worker.totalTasks}</td>
                  <td className="px-4 py-3 text-sm text-white text-center">
                    {Math.round(worker.totalStandardMinutes)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-sm font-bold ${getEfficiencyLabel(worker.efficiency)}`}>
                      {worker.efficiency}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {worker.taskBreakdown.map(tb => (
                        <span
                          key={tb.taskType}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 text-[11px] text-gray-300"
                        >
                          {tb.taskType.replace(/_/g, ' ')}: {tb.count}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {report.workers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-500 text-sm">
                    No worker activity in this period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────

export function LaborDashboard() {
  const [activeTab, setActiveTab] = useState<TabKey>('productivity');
  const [days, setDays] = useState(30);
  const query = useLaborProductivity(days);

  const data = (query.data as unknown as { data?: ProductivitySummary } | undefined)?.data;
  const isLoading = query.isLoading;

  const tabs: { key: TabKey; label: string; icon: typeof Users }[] = [
    { key: 'productivity', label: 'Productivity', icon: TrendingUp },
    { key: 'standards', label: 'Standards', icon: Settings },
    { key: 'performance', label: 'Performance', icon: BarChart3 },
  ];

  return (
    <RouteErrorBoundary label="Labor Dashboard">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <TrendingUp size={24} className="text-nesma-secondary" />
              Labor Management
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Monitor workforce productivity, set standards, and track efficiency
            </p>
          </div>
          {activeTab === 'productivity' && (
            <select
              value={days}
              onChange={e => setDays(Number(e.target.value))}
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-nesma-secondary/50"
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-white/5 rounded-xl w-fit">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  isActive
                    ? 'bg-nesma-primary text-white shadow-lg shadow-nesma-primary/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'productivity' && (
          <>
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nesma-secondary" />
              </div>
            ) : !data ? (
              <div className="glass-card rounded-2xl p-10 text-center text-gray-400">No data available</div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <KpiCard
                    icon={Package}
                    title="GRNs Processed"
                    value={data.totals.grnsProcessed}
                    color="bg-blue-600/20"
                  />
                  <KpiCard
                    icon={ArrowUpDown}
                    title="MIs Issued"
                    value={data.totals.misIssued}
                    color="bg-emerald-600/20"
                  />
                  <KpiCard
                    icon={ArrowUpDown}
                    title="WTs Transferred"
                    value={data.totals.wtsTransferred}
                    color="bg-amber-600/20"
                  />
                  <KpiCard
                    icon={ClipboardCheck}
                    title="Tasks Completed"
                    value={data.totals.tasksCompleted}
                    color="bg-purple-600/20"
                  />
                </div>

                {/* Daily Throughput Chart */}
                {data.dailyThroughput.length > 0 && (
                  <div className="glass-card rounded-2xl p-6 border border-white/10">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <TrendingUp size={18} className="text-nesma-secondary" />
                      Daily Throughput
                    </h2>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={data.dailyThroughput}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: '#9ca3af', fontSize: 12 }}
                          tickFormatter={d => d.slice(5)}
                        />
                        <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{
                            background: '#0a1929',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '12px',
                          }}
                          labelStyle={{ color: '#fff' }}
                          itemStyle={{ color: '#9ca3af' }}
                        />
                        <Legend wrapperStyle={{ color: '#9ca3af' }} />
                        <Line type="monotone" dataKey="grns" name="GRNs" stroke="#3b82f6" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="mis" name="MIs" stroke="#10b981" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="wts" name="WTs" stroke="#f59e0b" strokeWidth={2} dot={false} />
                        <Line
                          type="monotone"
                          dataKey="tasks"
                          name="Tasks"
                          stroke="#8b5cf6"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Worker Performance Bar Chart */}
                {data.workers.length > 0 && (
                  <div className="glass-card rounded-2xl p-6 border border-white/10">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Users size={18} className="text-nesma-secondary" />
                      Top Workers — Documents Processed
                    </h2>
                    <ResponsiveContainer width="100%" height={Math.max(200, data.workers.slice(0, 10).length * 40)}>
                      <BarChart
                        layout="vertical"
                        data={data.workers.slice(0, 10).map(w => ({
                          name: w.fullName.split(' ').slice(0, 2).join(' '),
                          GRNs: w.metrics.grnsProcessed,
                          MIs: w.metrics.misIssued,
                          WTs: w.metrics.wtsTransferred,
                          Tasks: w.metrics.tasksCompleted,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                        <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                        <YAxis dataKey="name" type="category" tick={{ fill: '#9ca3af', fontSize: 12 }} width={120} />
                        <Tooltip
                          contentStyle={{
                            background: '#0a1929',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '12px',
                          }}
                          labelStyle={{ color: '#fff' }}
                        />
                        <Legend wrapperStyle={{ color: '#9ca3af' }} />
                        <Bar dataKey="GRNs" stackId="a" fill="#3b82f6" />
                        <Bar dataKey="MIs" stackId="a" fill="#10b981" />
                        <Bar dataKey="WTs" stackId="a" fill="#f59e0b" />
                        <Bar dataKey="Tasks" stackId="a" fill="#8b5cf6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Worker Performance Table */}
                <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/10">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Clock size={18} className="text-nesma-secondary" />
                      Detailed Worker Metrics
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                            #
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                            Worker
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                            GRNs
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                            MIs
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                            WTs
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                            Tasks
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                            Total
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                            Avg Task Time
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.workers.map((worker, i) => (
                          <WorkerRow key={worker.employeeId} worker={worker} rank={i + 1} />
                        ))}
                        {data.workers.length === 0 && (
                          <tr>
                            <td colSpan={8} className="px-4 py-10 text-center text-gray-500 text-sm">
                              No worker activity in this period
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {activeTab === 'standards' && <StandardsTab />}
        {activeTab === 'performance' && <PerformanceTab />}
      </div>
    </RouteErrorBoundary>
  );
}
