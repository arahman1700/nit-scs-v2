import React, { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { KpiCard } from './KpiCard';
import { SectionTabBar } from './SectionTabBar';
import { RouteErrorBoundary } from './RouteErrorBoundary';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import type { KpiCardProps } from './KpiCard';
import type { TabDef } from './SectionTabBar';

export interface QuickAction {
  label: string;
  icon?: React.ElementType;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

interface SectionLandingPageProps {
  title: string;
  subtitle: string;
  kpis: KpiCardProps[];
  tabs: TabDef[];
  quickActions?: QuickAction[];
  loading?: boolean;
  /** Map of tab key → render function */
  children: Record<string, React.ReactNode>;
  /** Default tab key (defaults to first tab) */
  defaultTab?: string;
}

export const SectionLandingPage: React.FC<SectionLandingPageProps> = ({
  title,
  subtitle,
  kpis,
  tabs,
  quickActions,
  loading,
  children,
  defaultTab,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramTab = searchParams.get('tab');
  const [fabOpen, setFabOpen] = useState(false);

  // Active tab: URL param > default > first tab
  const [localTab, setLocalTab] = useState(defaultTab || tabs[0]?.key || '');
  const activeTab = paramTab || localTab;

  const handleTabChange = useCallback(
    (key: string) => {
      setLocalTab(key);
      setSearchParams({ tab: key }, { replace: true });
    },
    [setSearchParams],
  );

  const hasActions = quickActions && quickActions.length > 0;

  // Close FAB menu on Escape key
  useEscapeKey(() => setFabOpen(false), fabOpen);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white glow-text">{title}</h1>
          <p className="text-gray-400 text-sm mt-1">{subtitle}</p>
        </div>

        {/* Quick Actions — desktop only (hidden on mobile, shown via FAB) */}
        {hasActions && (
          <div className="hidden md:flex flex-wrap gap-2">
            {quickActions.map((action, i) => {
              const ActionIcon = action.icon || Plus;
              const isPrimary = action.variant !== 'secondary';
              return (
                <button
                  key={i}
                  onClick={action.onClick}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all transform hover:-translate-y-0.5 ${
                    isPrimary
                      ? 'bg-nesma-primary text-white shadow-lg shadow-nesma-primary/20 hover:bg-nesma-accent'
                      : 'bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <ActionIcon size={16} />
                  {action.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {kpis.map((kpi, i) => (
          <KpiCard key={i} {...kpi} loading={loading} />
        ))}
      </div>

      {/* Tab Bar */}
      <SectionTabBar tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />

      {/* Tab Content */}
      <div className="min-h-[400px]">
        <RouteErrorBoundary key={activeTab} label={tabs.find(t => t.key === activeTab)?.label}>
          {children[activeTab] || (
            <div className="glass-card p-12 rounded-xl text-center text-gray-500">Select a tab to view content</div>
          )}
        </RouteErrorBoundary>
      </div>

      {/* Mobile FAB — floating action button for quick actions */}
      {hasActions && (
        <div className="md:hidden fixed bottom-6 right-6 z-50">
          {/* Expanded menu */}
          {fabOpen && (
            <>
              <div
                role="presentation"
                className="fixed inset-0 bg-black/40 backdrop-blur-sm"
                onClick={() => setFabOpen(false)}
              />
              <div className="absolute bottom-16 right-0 flex flex-col gap-2 items-end mb-2">
                {quickActions.map((action, i) => {
                  const ActionIcon = action.icon || Plus;
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        setFabOpen(false);
                        action.onClick();
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-nesma-dark border border-white/10 rounded-xl text-sm text-white shadow-xl animate-fade-in whitespace-nowrap"
                    >
                      <ActionIcon size={16} className="text-nesma-secondary" />
                      {action.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {/* FAB button */}
          <button
            onClick={() => setFabOpen(f => !f)}
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ${
              fabOpen ? 'bg-white/10 border border-white/20 rotate-45' : 'bg-nesma-primary shadow-nesma-primary/30'
            }`}
          >
            {fabOpen ? <X size={22} className="text-white" /> : <Plus size={22} className="text-white" />}
          </button>
        </div>
      )}
    </div>
  );
};
