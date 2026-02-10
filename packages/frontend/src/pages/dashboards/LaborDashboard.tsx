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
} from 'recharts';
import { Users, Package, ArrowUpDown, ClipboardCheck, Clock, TrendingUp } from 'lucide-react';
import { useLaborProductivity } from '@/api/hooks/useLaborProductivity';
import type { WorkerProductivity, ProductivitySummary } from '@/api/hooks/useLaborProductivity';

// ── Summary Card ──────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="glass-card rounded-2xl p-5 border border-white/10">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-xl ${color}`}>
          <Icon size={18} className="text-white" />
        </div>
        <span className="text-sm text-gray-400">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value.toLocaleString()}</div>
    </div>
  );
}

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

// ── Main Component ────────────────────────────────────────────────────

export function LaborDashboard() {
  const [days, setDays] = useState(30);
  const query = useLaborProductivity(days);

  const data = (query.data as unknown as { data?: ProductivitySummary } | undefined)?.data;
  const isLoading = query.isLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <TrendingUp size={24} className="text-nesma-secondary" />
            Labor Productivity
          </h1>
          {data?.period && (
            <p className="text-sm text-gray-400 mt-1">
              {data.period.from} to {data.period.to}
            </p>
          )}
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
            <StatCard icon={Package} label="GRNs Processed" value={data.totals.grnsProcessed} color="bg-blue-600/20" />
            <StatCard icon={ArrowUpDown} label="MIs Issued" value={data.totals.misIssued} color="bg-emerald-600/20" />
            <StatCard
              icon={ArrowUpDown}
              label="WTs Transferred"
              value={data.totals.wtsTransferred}
              color="bg-amber-600/20"
            />
            <StatCard
              icon={ClipboardCheck}
              label="Tasks Completed"
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
                  <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={d => d.slice(5)} />
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
                  <Line type="monotone" dataKey="tasks" name="Tasks" stroke="#8b5cf6" strokeWidth={2} dot={false} />
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
    </div>
  );
}
