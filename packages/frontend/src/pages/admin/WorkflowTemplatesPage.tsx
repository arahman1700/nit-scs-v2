import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useWorkflowTemplateList, useInstallWorkflowTemplate } from '@/api/hooks/useWorkflowTemplates';
import type { WorkflowTemplate } from '@/api/hooks/useWorkflowTemplates';
import { Zap, Download, ChevronDown, ChevronUp, Check, Loader2 } from 'lucide-react';

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  material: { label: 'Material', color: 'bg-blue-500/20 text-blue-400' },
  logistics: { label: 'Logistics', color: 'bg-amber-500/20 text-amber-400' },
  quality: { label: 'Quality', color: 'bg-emerald-500/20 text-emerald-400' },
  asset: { label: 'Asset', color: 'bg-purple-500/20 text-purple-400' },
  inventory: { label: 'Inventory', color: 'bg-cyan-500/20 text-cyan-400' },
  admin: { label: 'Admin', color: 'bg-gray-500/20 text-gray-400' },
};

export function WorkflowTemplatesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: listData, isLoading } = useWorkflowTemplateList();
  const installMutation = useInstallWorkflowTemplate();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());
  const [installingId, setInstallingId] = useState<string | null>(null);

  const templates = (listData as unknown as { data?: WorkflowTemplate[] })?.data ?? [];

  const categories = Array.from(new Set(templates.map(t => t.category)));

  const filtered = selectedCategory ? templates.filter(t => t.category === selectedCategory) : templates;

  const handleInstall = useCallback(
    async (template: WorkflowTemplate) => {
      setInstallingId(template.id);
      try {
        const result = await installMutation.mutateAsync(template.id);
        setInstalledIds(prev => new Set(prev).add(template.id));
        const workflowId = (result as unknown as { data?: { workflowId?: string } })?.data?.workflowId;
        if (workflowId) {
          // Optionally navigate to the newly created workflow
          setTimeout(() => navigate(`/admin/system/workflows/${workflowId}`), 1500);
        }
      } finally {
        setInstallingId(null);
      }
    },
    [installMutation, navigate],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <Zap size={24} className="text-nesma-secondary" />
          <div>
            <h1 className="text-2xl font-bold text-white">
              {t('Workflow Templates', { defaultValue: 'Workflow Templates' })}
            </h1>
            <p className="text-sm text-gray-400 mt-1">Pre-built automation templates you can install with one click.</p>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1.5 rounded-lg text-sm transition-all duration-300 ${
            !selectedCategory ? 'bg-nesma-primary text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
          }`}
        >
          All ({templates.length})
        </button>
        {categories.map(cat => {
          const info = CATEGORY_LABELS[cat] ?? { label: cat, color: 'bg-white/10 text-gray-300' };
          const count = templates.filter(t => t.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all duration-300 ${
                selectedCategory === cat ? 'bg-nesma-primary text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {info.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-40 bg-white/10 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center">
          <p className="text-gray-400">No templates found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(template => {
            const catInfo = CATEGORY_LABELS[template.category] ?? {
              label: template.category,
              color: 'bg-white/10 text-gray-300',
            };
            const isExpanded = expandedId === template.id;
            const isInstalled = installedIds.has(template.id);
            const isInstalling = installingId === template.id;

            return (
              <div
                key={template.id}
                className="glass-card rounded-2xl p-5 hover:bg-white/10 transition-all duration-300"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-white font-medium">{template.name}</h3>
                    <p className="text-sm text-gray-400 mt-1">{template.description}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${catInfo.color}`}>
                    {catInfo.label}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : template.id)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-all"
                  >
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {template.template.rules.length} rule{template.template.rules.length !== 1 ? 's' : ''}
                  </button>

                  <button
                    onClick={() => handleInstall(template)}
                    disabled={isInstalled || isInstalling}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all duration-300 ${
                      isInstalled
                        ? 'bg-emerald-500/20 text-emerald-400 cursor-default'
                        : 'bg-nesma-primary/20 text-nesma-secondary hover:bg-nesma-primary hover:text-white'
                    }`}
                  >
                    {isInstalling ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Installing...
                      </>
                    ) : isInstalled ? (
                      <>
                        <Check size={14} /> Installed
                      </>
                    ) : (
                      <>
                        <Download size={14} /> Install
                      </>
                    )}
                  </button>
                </div>

                {/* Expanded rule details */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                    {template.template.rules.map((rule, idx) => (
                      <div key={idx} className="bg-black/20 rounded-lg p-3">
                        <p className="text-sm text-white">{rule.name}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Trigger: <span className="text-gray-400">{rule.triggerEvent}</span>
                          &nbsp;&middot;&nbsp; Actions: <span className="text-gray-400">{rule.actions.length}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
