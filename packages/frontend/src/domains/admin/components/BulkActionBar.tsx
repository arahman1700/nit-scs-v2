import React from 'react';
import { CheckSquare, X, Zap, Loader2 } from 'lucide-react';

interface BulkActionBarProps {
  selectedCount: number;
  onClear: () => void;
  availableActions: string[];
  bulkAction: string;
  onBulkActionChange: (action: string) => void;
  onExecute: () => void;
  isExecuting: boolean;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  onClear,
  availableActions,
  bulkAction,
  onBulkActionChange,
  onExecute,
  isExecuting,
}) => (
  <div className="px-4 py-3 border-b border-nesma-secondary/20 bg-nesma-secondary/5 flex items-center gap-4 flex-wrap">
    <div className="flex items-center gap-2">
      <CheckSquare size={16} className="text-nesma-secondary" />
      <span className="text-sm font-medium text-nesma-secondary">{selectedCount} selected</span>
      <button
        type="button"
        onClick={onClear}
        className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        title="Clear selection"
        aria-label="Clear selection"
      >
        <X size={14} />
      </button>
    </div>
    {availableActions.length > 0 && (
      <>
        <select
          value={bulkAction}
          onChange={e => onBulkActionChange(e.target.value)}
          className="bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-nesma-secondary/50"
        >
          <option value="">Select action...</option>
          {availableActions.map(a => (
            <option key={a} value={a}>
              {a.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onExecute}
          disabled={!bulkAction || isExecuting}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-nesma-primary hover:bg-nesma-accent text-white text-sm font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {isExecuting ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
          Execute
        </button>
      </>
    )}
  </div>
);
