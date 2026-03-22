import React from 'react';
import type { StatusFlowConfig } from '@/domains/system/hooks/useDynamicDocumentTypes';
import { Trash2 } from 'lucide-react';

const INPUT_BASE =
  'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-nesma-secondary focus:ring-1 focus:ring-nesma-secondary outline-none transition-all';

interface StatusFlowTabProps {
  statusFlow: StatusFlowConfig;
  onStatusFlowChange: (updater: (prev: StatusFlowConfig) => StatusFlowConfig) => void;
}

export const StatusFlowTab: React.FC<StatusFlowTabProps> = ({ statusFlow, onStatusFlowChange }) => (
  <div className="glass-card rounded-2xl p-6 space-y-6">
    <div>
      <label htmlFor="initial-status-field" className="block text-sm font-medium text-gray-300 mb-1.5">
        Initial Status
      </label>
      <input
        id="initial-status-field"
        value={statusFlow.initialStatus}
        onChange={e => onStatusFlowChange(sf => ({ ...sf, initialStatus: e.target.value }))}
        className={INPUT_BASE}
      />
    </div>

    <div>
      <div className="flex justify-between items-center mb-3">
        <label className="text-sm font-medium text-gray-300">Statuses</label>
        <button
          onClick={() => {
            const key = `status_${Date.now()}`;
            onStatusFlowChange(sf => ({
              ...sf,
              statuses: [...sf.statuses, { key, label: 'New Status', color: 'gray' }],
            }));
          }}
          className="text-sm text-nesma-secondary hover:underline"
        >
          + Add Status
        </button>
      </div>
      <div className="space-y-2">
        {statusFlow.statuses.map((status, idx) => (
          <div key={idx} className="flex gap-3 items-center">
            <input
              value={status.key}
              onChange={e => {
                const statuses = [...statusFlow.statuses];
                statuses[idx] = { ...statuses[idx], key: e.target.value };
                onStatusFlowChange(sf => ({ ...sf, statuses }));
              }}
              className={`${INPUT_BASE} w-32`}
              placeholder="key"
            />
            <input
              value={status.label}
              onChange={e => {
                const statuses = [...statusFlow.statuses];
                statuses[idx] = { ...statuses[idx], label: e.target.value };
                onStatusFlowChange(sf => ({ ...sf, statuses }));
              }}
              className={`${INPUT_BASE} flex-1`}
              placeholder="Label"
            />
            <select
              value={status.color}
              onChange={e => {
                const statuses = [...statusFlow.statuses];
                statuses[idx] = { ...statuses[idx], color: e.target.value };
                onStatusFlowChange(sf => ({ ...sf, statuses }));
              }}
              className={`${INPUT_BASE} w-28 appearance-none`}
            >
              {['gray', 'blue', 'green', 'red', 'amber', 'purple'].map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                const statuses = statusFlow.statuses.filter((_, i) => i !== idx);
                onStatusFlowChange(sf => ({ ...sf, statuses }));
              }}
              className="p-2 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400"
              aria-label="Remove status"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>

    <div>
      <label className="text-sm font-medium text-gray-300 mb-3 block">Transitions</label>
      <p className="text-xs text-gray-400 mb-3">Define which statuses can transition to which</p>
      <div className="space-y-2">
        {statusFlow.statuses.map(status => (
          <div key={status.key} className="flex items-center gap-3">
            <span className="w-32 text-sm text-gray-300 font-medium">{status.label}</span>
            <span className="text-gray-400">→</span>
            <div className="flex-1 flex flex-wrap gap-2">
              {statusFlow.statuses
                .filter(s => s.key !== status.key)
                .map(target => {
                  const isAllowed = (statusFlow.transitions[status.key] ?? []).includes(target.key);
                  return (
                    <button
                      key={target.key}
                      onClick={() => {
                        const transitions = { ...statusFlow.transitions };
                        const current = transitions[status.key] ?? [];
                        transitions[status.key] = isAllowed
                          ? current.filter(k => k !== target.key)
                          : [...current, target.key];
                        onStatusFlowChange(sf => ({ ...sf, transitions }));
                      }}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        isAllowed
                          ? 'bg-nesma-secondary/20 text-nesma-secondary border border-nesma-secondary/30'
                          : 'bg-white/5 text-gray-400 border border-white/10 hover:border-white/20'
                      }`}
                    >
                      {target.label}
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);
