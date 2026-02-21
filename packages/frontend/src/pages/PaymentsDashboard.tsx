import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Search, Loader2 } from 'lucide-react';
import { useJobOrderList } from '@/api/hooks/useJobOrders';

interface JO {
  id: string;
  joNumber: string;
  joType: string;
  status: string;
  totalAmount: string | number | null;
  createdAt: string;
  completionDate: string | null;
  project?: { id: string; projectName: string; projectCode: string } | null;
  supplier?: { id: string; supplierName: string; supplierCode: string } | null;
  _count?: { payments: number };
}

export const PaymentsDashboard: React.FC = () => {
  const [search, setSearch] = useState('');

  const { data: joResponse, isLoading, isError } = useJobOrderList({ pageSize: 200 });

  const jobs: JO[] = useMemo(() => {
    if (!joResponse?.data) return [];
    return joResponse.data as unknown as JO[];
  }, [joResponse]);

  // KPI calculations
  const kpis = useMemo(() => {
    if (jobs.length === 0) return { totalJobs: 0, totalAmount: 0, invoicedPct: 0, avgCycleDays: 0 };

    const totalJobs = jobs.length;
    const totalAmount = jobs.reduce((sum, jo) => sum + Number(jo.totalAmount ?? 0), 0);
    const invoicedCount = jobs.filter(jo => jo.status === 'invoiced').length;
    const invoicedPct = totalJobs > 0 ? (invoicedCount / totalJobs) * 100 : 0;

    // Avg cycle: completionDate - createdAt for completed/invoiced JOs
    const completedJos = jobs.filter(jo => jo.completionDate);
    let avgCycleDays = 0;
    if (completedJos.length > 0) {
      const totalDays = completedJos.reduce((sum, jo) => {
        const created = new Date(jo.createdAt).getTime();
        const completed = new Date(jo.completionDate!).getTime();
        return sum + (completed - created) / (1000 * 60 * 60 * 24);
      }, 0);
      avgCycleDays = totalDays / completedJos.length;
    }

    return { totalJobs, totalAmount, invoicedPct, avgCycleDays };
  }, [jobs]);

  // Top 5 suppliers by total amount
  const supplierData = useMemo(() => {
    const map = new Map<string, number>();
    for (const jo of jobs) {
      const name = jo.supplier?.supplierName ?? 'Unknown';
      map.set(name, (map.get(name) ?? 0) + Number(jo.totalAmount ?? 0));
    }
    return Array.from(map.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [jobs]);

  // Top 5 projects by total amount
  const projectData = useMemo(() => {
    const map = new Map<string, number>();
    for (const jo of jobs) {
      const name = jo.project?.projectName ?? 'Unknown';
      map.set(name, (map.get(name) ?? 0) + Number(jo.totalAmount ?? 0));
    }
    return Array.from(map.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [jobs]);

  // Recent invoices (invoiced or completed JOs), filtered by search
  const recentInvoices = useMemo(() => {
    return jobs
      .filter(jo => jo.status === 'invoiced' || jo.status === 'completed')
      .filter(jo => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          jo.joNumber.toLowerCase().includes(q) ||
          (jo.project?.projectName ?? '').toLowerCase().includes(q) ||
          (jo.supplier?.supplierName ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
  }, [jobs, search]);

  const formatAmount = (val: number) => {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
    return val.toFixed(0);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-nesma-secondary animate-spin" />
        <span className="ml-3 text-gray-400">Loading payment data...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-red-400">Failed to load payment data. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white glow-text">Payments & Invoices</h1>
          <p className="text-gray-400 mt-1">Financial Overview and Analysis</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-full px-4 py-2 w-full md:w-64 flex items-center">
          <Search size={18} className="text-gray-400 mr-2" />
          <input
            type="text"
            placeholder="Search invoices..."
            className="bg-transparent border-none outline-none text-sm text-white w-full"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p className="text-sm text-gray-400">Total Job Orders</p>
          </div>
          <p className="text-2xl font-bold text-white">{kpis.totalJobs.toLocaleString()}</p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-nesma-secondary/20 rounded-lg text-nesma-secondary">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-sm text-gray-400">Total Amount</p>
          </div>
          <p className="text-2xl font-bold text-white">
            {formatAmount(kpis.totalAmount)} <span className="text-sm font-normal text-gray-400">SAR</span>
          </p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-500/20 rounded-lg text-green-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-sm text-gray-400">Invoiced</p>
          </div>
          <p className="text-2xl font-bold text-green-400">{kpis.invoicedPct.toFixed(1)}%</p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-sm text-gray-400">Avg Cycle</p>
          </div>
          <p className="text-2xl font-bold text-amber-400">
            {kpis.avgCycleDays > 0 ? kpis.avgCycleDays.toFixed(1) : '--'}{' '}
            <span className="text-sm font-normal text-gray-400">Days</span>
          </p>
        </div>
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold text-white mb-6">Top Suppliers by Amount</h3>
          <div className="h-72">
            {supplierData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={supplierData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#ffffff10" />
                  <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fill: '#fff', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0E2841',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                  />
                  <Bar dataKey="amount" fill="#80D1E9" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">No supplier data available</div>
            )}
          </div>
        </div>

        <div className="glass-card p-6">
          <h3 className="text-lg font-bold text-white mb-6">Top Projects by Expenditure</h3>
          <div className="h-72">
            {projectData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={projectData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#ffffff10" />
                  <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fill: '#fff', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0E2841',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                  />
                  <Bar dataKey="amount" fill="#2E3192" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">No project data available</div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Invoices Table */}
      <div className="glass-card p-6 overflow-hidden">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-white">Recent Invoices</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-gray-400 border-b border-white/10">
              <tr>
                <th className="pb-3 pl-2">JO #</th>
                <th className="pb-3">Project</th>
                <th className="pb-3">Supplier</th>
                <th className="pb-3 text-right">Amount</th>
                <th className="pb-3 text-center">Status</th>
                <th className="pb-3 pr-2 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="text-white divide-y divide-white/5">
              {recentInvoices.length > 0 ? (
                recentInvoices.map(jo => (
                  <tr key={jo.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 pl-2 font-mono text-gray-300">{jo.joNumber}</td>
                    <td className="py-3">{jo.project?.projectName ?? '--'}</td>
                    <td className="py-3">{jo.supplier?.supplierName ?? '--'}</td>
                    <td className="py-3 text-right font-medium">{Number(jo.totalAmount ?? 0).toLocaleString()} SAR</td>
                    <td className="py-3 text-center">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          jo.status === 'invoiced'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {jo.status === 'invoiced' ? 'Invoiced' : 'Completed'}
                      </span>
                    </td>
                    <td className="py-3 pr-2 text-right text-gray-400">{formatDate(jo.createdAt)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    No invoiced job orders found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
