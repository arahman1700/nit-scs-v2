import React from 'react';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import { KpiCard } from '@/components/KpiCard';
import { useSecurityDashboard } from '@/domains/auth/hooks/useSecurity';
import type { SecurityDashboard as SecurityDashboardData } from '@/domains/auth/hooks/useSecurity';
import { Shield, Users, ShieldAlert, Lock, CheckCircle, Loader2, Globe } from 'lucide-react';

// ── Loading Skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div>
        <div className="h-8 w-64 bg-white/10 rounded mb-2" />
        <div className="h-4 w-96 bg-white/5 rounded" />
      </div>

      {/* KPI row skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card rounded-xl p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <div className="h-8 w-16 bg-white/10 rounded" />
                <div className="h-4 w-28 bg-white/5 rounded" />
              </div>
              <div className="w-14 h-14 bg-white/10 rounded-xl" />
            </div>
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <div className="h-5 w-48 bg-white/10 rounded" />
        </div>
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-4 w-32 bg-white/10 rounded" />
              <div className="h-4 w-24 bg-white/5 rounded" />
              <div className="h-4 w-20 bg-white/5 rounded" />
              <div className="h-4 w-28 bg-white/5 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Suspicious IPs skeleton */}
      <div className="glass-card rounded-2xl border border-white/10 p-6">
        <div className="h-5 w-40 bg-white/10 rounded mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 bg-white/5 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Suspicious IPs List ───────────────────────────────────────────────────────

function SuspiciousIpsList({ ips }: { ips: string[] }) {
  if (ips.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-gray-500">
        <CheckCircle size={18} />
        <span className="text-sm">No suspicious IPs detected</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {ips.map(ip => (
        <div
          key={ip}
          className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 hover:bg-white/10 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-red-500/20">
              <Globe size={14} className="text-red-400" />
            </div>
            <span className="text-sm text-white font-mono">{ip}</span>
          </div>
          <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/20 text-red-400 font-medium">Suspicious</span>
        </div>
      ))}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export const SecurityDashboard: React.FC = () => {
  const query = useSecurityDashboard();
  const data = (query.data as unknown as { data?: SecurityDashboardData } | undefined)?.data;
  const isLoading = query.isLoading;
  const isFetching = query.isFetching;

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!data) {
    return <div className="glass-card rounded-2xl p-10 text-center text-gray-400">No security data available</div>;
  }

  const successRate =
    data.activeUsers24h > 0
      ? Math.round(((data.activeUsers24h - data.failedAttempts24h) / data.activeUsers24h) * 100)
      : 100;

  return (
    <RouteErrorBoundary label="Security Dashboard">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Shield size={24} className="text-nesma-secondary" />
              Security Dashboard
            </h1>
            <p className="text-sm text-gray-400 mt-1">Login activity and account security overview (last 24 hours)</p>
          </div>
          {isFetching && !isLoading && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 size={14} className="animate-spin" />
              Refreshing...
            </div>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon={Users} title="Active Users (24h)" value={data.activeUsers24h} color="bg-blue-600/20" />
          <KpiCard
            icon={ShieldAlert}
            title="Failed Attempts (24h)"
            value={data.failedAttempts24h}
            color="bg-red-600/20"
            alert={data.failedAttempts24h > 10}
          />
          <KpiCard
            icon={Lock}
            title="Locked Accounts"
            value={data.lockedAccounts}
            color="bg-amber-600/20"
            alert={data.lockedAccounts > 0}
          />
          <KpiCard
            icon={CheckCircle}
            title="Success Rate"
            value={`${successRate}%`}
            color={successRate >= 90 ? 'bg-emerald-600/20' : 'bg-amber-600/20'}
            sublabel={successRate >= 90 ? 'Healthy' : 'Needs attention'}
          />
        </div>

        {/* Security Summary Cards Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quick Stats Card */}
          <div className="glass-card rounded-2xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Shield size={18} className="text-nesma-secondary" />
              Security Summary
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-600/20">
                    <Users size={16} className="text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">Active Users</p>
                    <p className="text-xs text-gray-500">Last 24 hours</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-white">{data.activeUsers24h}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-600/20">
                    <ShieldAlert size={16} className="text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">Failed Login Attempts</p>
                    <p className="text-xs text-gray-500">Last 24 hours</p>
                  </div>
                </div>
                <span className={`text-lg font-bold ${data.failedAttempts24h > 0 ? 'text-red-400' : 'text-white'}`}>
                  {data.failedAttempts24h}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-600/20">
                    <Lock size={16} className="text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">Locked Accounts</p>
                    <p className="text-xs text-gray-500">Currently locked</p>
                  </div>
                </div>
                <span className={`text-lg font-bold ${data.lockedAccounts > 0 ? 'text-amber-400' : 'text-white'}`}>
                  {data.lockedAccounts}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-600/20">
                    <CheckCircle size={16} className="text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">Login Success Rate</p>
                    <p className="text-xs text-gray-500">Calculated from 24h data</p>
                  </div>
                </div>
                <span className={`text-lg font-bold ${successRate >= 90 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {successRate}%
                </span>
              </div>
            </div>
          </div>

          {/* Suspicious IPs Card */}
          <div className="glass-card rounded-2xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Globe size={18} className="text-nesma-secondary" />
              Suspicious IP Addresses
              {data.suspiciousIps.length > 0 && (
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-500/20 text-red-400">
                  {data.suspiciousIps.length}
                </span>
              )}
            </h2>
            <SuspiciousIpsList ips={data.suspiciousIps} />
          </div>
        </div>
      </div>
    </RouteErrorBoundary>
  );
};
