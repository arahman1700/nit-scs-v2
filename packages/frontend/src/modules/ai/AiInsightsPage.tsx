import React, { useCallback } from 'react';
import {
  useAiSuggestions,
  useDismissSuggestion,
  useApplySuggestion,
  useTriggerAnalysis,
} from './hooks/useAiSuggestions';
import type { AiSuggestion } from './hooks/useAiSuggestions';
import { Lightbulb, Check, X, RefreshCw, Loader2, AlertTriangle, TrendingDown, Clock, Package } from 'lucide-react';

const TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  slow_moving: { label: 'Slow Moving', icon: <TrendingDown size={16} />, color: 'text-amber-400' },
  delay: { label: 'Approval Delay', icon: <Clock size={16} />, color: 'text-red-400' },
  reorder: { label: 'Low Stock', icon: <Package size={16} />, color: 'text-blue-400' },
  sla: { label: 'SLA Breach', icon: <AlertTriangle size={16} />, color: 'text-red-400' },
  cost_anomaly: { label: 'Cost Anomaly', icon: <AlertTriangle size={16} />, color: 'text-amber-400' },
  automation: { label: 'Automation', icon: <Lightbulb size={16} />, color: 'text-emerald-400' },
  supplier_rating: { label: 'Supplier', icon: <Package size={16} />, color: 'text-purple-400' },
};

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Critical', color: 'bg-red-500/20 text-red-400' },
  2: { label: 'High', color: 'bg-amber-500/20 text-amber-400' },
  3: { label: 'Medium', color: 'bg-blue-500/20 text-blue-400' },
  4: { label: 'Low', color: 'bg-gray-500/20 text-gray-400' },
};

export function AiInsightsPage() {
  const { data: suggestionsData, isLoading, refetch } = useAiSuggestions();
  const dismissMutation = useDismissSuggestion();
  const applyMutation = useApplySuggestion();
  const analyzeMutation = useTriggerAnalysis();

  const suggestions = (suggestionsData as unknown as { data?: AiSuggestion[] })?.data ?? [];

  const handleAnalyze = useCallback(async () => {
    await analyzeMutation.mutateAsync();
    refetch();
  }, [analyzeMutation, refetch]);

  const grouped = suggestions.reduce<Record<string, AiSuggestion[]>>((acc, s) => {
    const key = s.suggestionType;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <Lightbulb size={24} className="text-nesma-secondary" />
          <div>
            <h1 className="text-2xl font-bold text-white">AI Insights</h1>
            <p className="text-sm text-gray-400 mt-1">
              {suggestions.length} active suggestion{suggestions.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={analyzeMutation.isPending}
          className="btn-primary flex items-center gap-2"
        >
          {analyzeMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          Run Analysis
        </button>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(grouped).map(([type, items]) => {
          const meta = TYPE_META[type] ?? { label: type, icon: <Lightbulb size={16} />, color: 'text-gray-400' };
          const critical = items.filter(i => i.priority <= 2).length;
          return (
            <div key={type} className="glass-card rounded-2xl p-4">
              <div className={`flex items-center gap-2 mb-2 ${meta.color}`}>
                {meta.icon}
                <span className="text-sm font-medium">{meta.label}</span>
              </div>
              <p className="text-3xl font-bold text-white">{items.length}</p>
              {critical > 0 && <p className="text-xs text-red-400 mt-1">{critical} critical/high</p>}
            </div>
          );
        })}
        {Object.keys(grouped).length === 0 && !isLoading && (
          <div className="col-span-4 glass-card rounded-2xl p-10 text-center">
            <Lightbulb size={40} className="text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No suggestions yet. Run the analysis to get insights.</p>
          </div>
        )}
      </div>

      {/* Suggestions List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-white/10 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map(suggestion => {
            const meta = TYPE_META[suggestion.suggestionType] ?? {
              label: suggestion.suggestionType,
              icon: <Lightbulb size={16} />,
              color: 'text-gray-400',
            };
            const priority = PRIORITY_LABELS[suggestion.priority] ?? PRIORITY_LABELS[4];

            return (
              <div
                key={suggestion.id}
                className="glass-card rounded-2xl p-5 hover:bg-white/10 transition-all duration-300"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={meta.color}>{meta.icon}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priority.color}`}>
                        {priority.label}
                      </span>
                    </div>
                    <h3 className="text-white font-medium">{suggestion.title}</h3>
                    {suggestion.description && <p className="text-sm text-gray-400 mt-1">{suggestion.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {suggestion.actionPayload && (
                      <button
                        onClick={() => applyMutation.mutate(suggestion.id)}
                        disabled={applyMutation.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm hover:bg-emerald-500/30 transition-all"
                      >
                        <Check size={14} /> Apply
                      </button>
                    )}
                    <button
                      onClick={() => dismissMutation.mutate(suggestion.id)}
                      disabled={dismissMutation.isPending}
                      className="p-1.5 hover:bg-white/10 rounded-lg transition-all"
                      aria-label="Dismiss"
                    >
                      <X size={16} className="text-gray-500" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
