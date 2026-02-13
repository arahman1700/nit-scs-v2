import React, { useState } from 'react';
import { BarChart3, Table, PieChart, LineChart, Copy, Loader2 } from 'lucide-react';
import { useReportTemplates, useTemplateToReport } from '@/api/hooks/useSavedReports';
import type { SavedReport } from '@/api/hooks/useSavedReports';

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'adhoc', label: 'Ad-Hoc' },
] as const;

const VIZ_ICONS: Record<string, React.ReactNode> = {
  table: <Table size={16} />,
  bar: <BarChart3 size={16} />,
  line: <LineChart size={16} />,
  pie: <PieChart size={16} />,
};

const CATEGORY_COLORS: Record<string, string> = {
  daily: 'bg-blue-500/20 text-blue-400',
  weekly: 'bg-purple-500/20 text-purple-400',
  monthly: 'bg-emerald-500/20 text-emerald-400',
  adhoc: 'bg-amber-500/20 text-amber-400',
};

interface ReportTemplateGalleryProps {
  onTemplateUsed: (reportId: string) => void;
}

export const ReportTemplateGallery: React.FC<ReportTemplateGalleryProps> = ({ onTemplateUsed }) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [usingId, setUsingId] = useState<string | null>(null);

  const { data: templatesResp, isLoading } = useReportTemplates();
  const useTemplate = useTemplateToReport();

  const templates: SavedReport[] = templatesResp?.data ?? [];

  const filtered = activeCategory === 'all' ? templates : templates.filter(t => t.category === activeCategory);

  const handleUse = async (templateId: string) => {
    setUsingId(templateId);
    try {
      const result = await useTemplate.mutateAsync(templateId);
      const newId = (result as unknown as { data?: { id?: string } })?.data?.id;
      if (newId) {
        onTemplateUsed(newId);
      }
    } finally {
      setUsingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (templates.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Report Templates</h2>
        <span className="text-xs text-gray-500">{templates.length} templates</span>
      </div>

      {/* Category filter pills */}
      <div className="flex items-center gap-2">
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-300 ${
              activeCategory === cat.key
                ? 'bg-nesma-primary text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(template => (
          <div
            key={template.id}
            className="glass-card rounded-2xl p-4 hover:bg-white/10 transition-all duration-300 flex flex-col"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-white/5 text-nesma-secondary">
                  {VIZ_ICONS[template.visualization] ?? <Table size={16} />}
                </div>
                {template.category && (
                  <span
                    className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                      CATEGORY_COLORS[template.category] ?? 'bg-white/10 text-gray-400'
                    }`}
                  >
                    {template.category}
                  </span>
                )}
              </div>
            </div>

            <h3 className="text-sm font-medium text-white mb-1">{template.name}</h3>
            <p className="text-xs text-gray-400 mb-4 flex-1 line-clamp-2">{template.description}</p>

            <button
              onClick={() => handleUse(template.id)}
              disabled={usingId === template.id}
              className="flex items-center justify-center gap-2 w-full px-3 py-2 text-xs font-medium
                bg-nesma-primary/20 text-nesma-secondary hover:bg-nesma-primary/40
                rounded-lg transition-all duration-300 disabled:opacity-50"
            >
              {usingId === template.id ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
              {usingId === template.id ? 'Creating...' : 'Use Template'}
            </button>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">No templates in this category.</div>
      )}
    </div>
  );
};
