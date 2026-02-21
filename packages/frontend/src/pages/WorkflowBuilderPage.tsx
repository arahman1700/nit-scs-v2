import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Save, TestTube } from 'lucide-react';
import {
  useWorkflow,
  useWorkflowRules,
  useCreateRule,
  useUpdateRule,
  useDeleteRule,
  useTestRule,
  useRuleLogs,
} from '@/api/hooks/useWorkflows';
import { WorkflowCanvas } from '@/components/workflow-builder/WorkflowCanvas';
import { RuleCard } from '@/components/workflow-builder/RuleCard';
import { ExecutionLogTable } from '@/components/workflow-builder/ExecutionLogTable';

interface Rule {
  id: string;
  name: string;
  triggerEvent: string;
  conditions: Record<string, unknown>;
  actions: { type: string; params: Record<string, string> }[];
  priority: number;
  enabled: boolean;
  stopOnMatch: boolean;
}

const EMPTY_RULE = {
  name: '',
  triggerEvent: '',
  conditions: { operator: 'AND' as const, conditions: [] as never[] },
  actions: [] as { type: string; params: Record<string, string> }[],
  priority: 0,
  stopOnMatch: false,
  enabled: true,
};

export const WorkflowBuilderPage: React.FC = () => {
  const { workflowId } = useParams<{ workflowId: string }>();
  const navigate = useNavigate();
  const { data: wfData } = useWorkflow(workflowId);
  const { data: rulesData, isLoading: rulesLoading } = useWorkflowRules(workflowId);
  const createRule = useCreateRule();
  const updateRule = useUpdateRule();
  const deleteRule = useDeleteRule();
  const testRule = useTestRule();

  const [editingRule, setEditingRule] = useState<(Rule & { isNew?: boolean }) | null>(null);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'rules' | 'logs'>('rules');

  const workflow = (wfData as { data?: { id: string; name: string } })?.data;
  const rules = ((rulesData as { data?: Rule[] })?.data || []) as Rule[];
  const { data: logsData, isLoading: logsLoading } = useRuleLogs(workflowId, selectedRuleId || undefined);
  const logs = ((logsData as { data?: unknown[] })?.data || []) as {
    id: string;
    ruleId: string;
    triggerEvent: string;
    matched: boolean;
    actionsRun: { type: string; success: boolean; error?: string }[];
    executionTimeMs: number;
    error: string | null;
    createdAt: string;
  }[];

  const handleSaveRule = () => {
    if (!editingRule || !workflowId) return;
    if (editingRule.isNew) {
      createRule.mutate({ workflowId, ...editingRule }, { onSuccess: () => setEditingRule(null) });
    } else {
      const { id, isNew: _, ...ruleBody } = editingRule;
      updateRule.mutate({ workflowId, id, ...ruleBody }, { onSuccess: () => setEditingRule(null) });
    }
  };

  const handleDeleteRule = (rule: Rule) => {
    if (!workflowId) return;
    if (confirm(`Delete rule "${rule.name}"?`)) {
      deleteRule.mutate({ workflowId, id: rule.id });
    }
  };

  const handleTestRule = (ruleId: string) => {
    if (!workflowId) return;
    testRule.mutate({
      workflowId,
      id: ruleId,
      event: { type: 'test', entityType: 'test', entityId: 'test-001', action: 'test', payload: {} },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/admin/system?tab=workflows')}
          className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-lg font-bold text-white">{workflow?.name || 'Workflow Builder'}</h2>
          <p className="text-xs text-gray-500">
            {rules.length} rule{rules.length !== 1 ? 's' : ''} configured
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-black/20 rounded-lg p-1 w-fit">
        {(['rules', 'logs'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'
            }`}
          >
            {tab === 'rules' ? 'Rules' : 'Execution Logs'}
          </button>
        ))}
      </div>

      {activeTab === 'rules' && (
        <>
          {/* Rule editor (expanded) */}
          {editingRule && (
            <div className="bg-white/[0.02] rounded-2xl border border-white/10 p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                  Rule Name
                </label>
                <input
                  type="text"
                  value={editingRule.name}
                  onChange={e => setEditingRule({ ...editingRule, name: e.target.value })}
                  placeholder="e.g. Send approval email"
                  className="w-full bg-black/40 text-white text-sm rounded-lg p-2.5 border border-white/10 focus:border-nesma-secondary outline-none"
                />
              </div>

              <WorkflowCanvas rule={editingRule} onChange={updated => setEditingRule({ ...editingRule, ...updated })} />

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSaveRule}
                  disabled={!editingRule.name.trim() || createRule.isPending || updateRule.isPending}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors text-sm font-medium disabled:opacity-40"
                >
                  <Save size={14} />
                  {editingRule.isNew ? 'Create Rule' : 'Save Changes'}
                </button>
                {!editingRule.isNew && (
                  <button
                    onClick={() => handleTestRule(editingRule.id)}
                    disabled={testRule.isPending}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors text-sm font-medium"
                  >
                    <TestTube size={14} /> Test
                  </button>
                )}
                <button
                  onClick={() => setEditingRule(null)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 text-gray-400 hover:text-white transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Rule list */}
          {!editingRule && (
            <>
              {rulesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-nesma-secondary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : rules.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-sm">
                  No rules yet. Add your first rule to start automating.
                </div>
              ) : (
                <div className="space-y-2">
                  {rules.map(rule => (
                    <RuleCard
                      key={rule.id}
                      rule={rule}
                      onEdit={() => setEditingRule(rule)}
                      onToggle={enabled => {
                        if (!workflowId) return;
                        updateRule.mutate({ workflowId, id: rule.id, enabled });
                      }}
                      onDelete={() => handleDeleteRule(rule)}
                    />
                  ))}
                </div>
              )}

              <button
                onClick={() => setEditingRule({ ...EMPTY_RULE, id: '', isNew: true })}
                className="flex items-center gap-2 text-sm text-nesma-secondary hover:text-white transition-colors"
              >
                <Plus size={16} /> Add Rule
              </button>
            </>
          )}
        </>
      )}

      {activeTab === 'logs' && (
        <div>
          {/* Rule filter for logs */}
          <div className="flex items-center gap-3 mb-4">
            <select
              value={selectedRuleId || ''}
              onChange={e => setSelectedRuleId(e.target.value || null)}
              className="bg-black/40 text-white text-sm rounded-lg p-2.5 border border-white/10 focus:border-nesma-secondary outline-none"
            >
              <option value="">All rules</option>
              {rules.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <ExecutionLogTable logs={logs} isLoading={logsLoading} />
        </div>
      )}
    </div>
  );
};
