import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Zap, Trash2, Edit3, Play, Pause } from 'lucide-react';
import {
  useWorkflows,
  useCreateWorkflow,
  useDeleteWorkflow,
  useActivateWorkflow,
  useDeactivateWorkflow,
} from '@/api/hooks/useWorkflows';

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  entityType: string;
  isActive: boolean;
  priority: number;
  _count?: { rules: number };
  createdAt: string;
}

export const WorkflowListPage: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useWorkflows();
  const createWorkflow = useCreateWorkflow();
  const deleteWorkflow = useDeleteWorkflow();
  const activateWorkflow = useActivateWorkflow();
  const deactivateWorkflow = useDeactivateWorkflow();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEntity, setNewEntity] = useState('');

  const workflows = (data as { data?: Workflow[] })?.data || [];

  const handleCreate = () => {
    if (!newName.trim()) return;
    createWorkflow.mutate(
      { name: newName, entityType: newEntity || undefined, description: '' },
      {
        onSuccess: res => {
          const created = (res as { data?: Workflow })?.data;
          setCreating(false);
          setNewName('');
          setNewEntity('');
          if (created?.id) navigate(`/admin/system/workflows/${created.id}`);
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Zap size={20} className="text-amber-400" />
            Workflow Automation
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Create event-driven rules to automate emails, notifications, and status changes.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-nesma-secondary/20 text-nesma-secondary hover:bg-nesma-secondary/30 transition-colors text-sm font-medium"
        >
          <Plus size={16} /> New Workflow
        </button>
      </div>

      {/* Create modal */}
      {creating && (
        <div className="bg-white/[0.03] rounded-xl border border-white/10 p-5 space-y-3">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Workflow name (e.g. Approval Email Flow)"
            autoFocus
            className="w-full bg-black/40 text-white text-sm rounded-lg p-2.5 border border-white/10 focus:border-nesma-secondary outline-none"
          />
          <input
            type="text"
            value={newEntity}
            onChange={e => setNewEntity(e.target.value)}
            placeholder="Entity type filter (optional, e.g. mirv, jo)"
            className="w-full bg-black/40 text-white text-sm rounded-lg p-2.5 border border-white/10 focus:border-nesma-secondary outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || createWorkflow.isPending}
              className="px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors text-sm font-medium disabled:opacity-40"
            >
              {createWorkflow.isPending ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => setCreating(false)}
              className="px-4 py-2 rounded-lg bg-white/5 text-gray-400 hover:text-white transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-nesma-secondary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && workflows.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <Zap size={40} className="mx-auto mb-3 text-gray-600" />
          <p className="text-sm">No workflows yet. Create one to start automating.</p>
        </div>
      )}

      {/* Workflow cards */}
      <div className="space-y-3">
        {workflows.map(wf => (
          <div
            key={wf.id}
            className={`group bg-white/[0.03] rounded-xl border transition-all duration-200 ${
              wf.isActive ? 'border-white/10 hover:border-nesma-secondary/30' : 'border-white/5 opacity-60'
            }`}
          >
            <div className="flex items-center gap-4 p-4">
              {/* Status indicator */}
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${wf.isActive ? 'bg-emerald-400' : 'bg-gray-600'}`} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white">{wf.name}</h3>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                  {wf.entityType && (
                    <span className="px-1.5 py-0.5 rounded bg-white/10 font-mono">{wf.entityType}</span>
                  )}
                  <span>{wf._count?.rules || 0} rules</span>
                  <span>Priority {wf.priority}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => (wf.isActive ? deactivateWorkflow.mutate(wf.id) : activateWorkflow.mutate(wf.id))}
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  title={wf.isActive ? 'Deactivate' : 'Activate'}
                >
                  {wf.isActive ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <button
                  onClick={() => navigate(`/admin/system/workflows/${wf.id}`)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  title="Edit rules"
                >
                  <Edit3 size={14} />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete workflow "${wf.name}"?`)) {
                      deleteWorkflow.mutate(wf.id);
                    }
                  }}
                  className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
