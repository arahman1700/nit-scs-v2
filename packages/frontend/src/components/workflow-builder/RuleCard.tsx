import { ChevronRight, ToggleLeft, ToggleRight, Trash2, Edit3, Zap } from 'lucide-react';
import { EVENT_DESCRIPTIONS, type SystemEventType } from '@nit-scs-v2/shared';

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

interface RuleCardProps {
  rule: Rule;
  onEdit: () => void;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
}

function countConditions(conditions: Record<string, unknown>): number {
  if ('conditions' in conditions && Array.isArray(conditions.conditions)) {
    return (conditions.conditions as Record<string, unknown>[]).reduce((sum, c) => sum + countConditions(c), 0);
  }
  if ('field' in conditions) return 1;
  return 0;
}

export const RuleCard: React.FC<RuleCardProps> = ({ rule, onEdit, onToggle, onDelete }) => {
  const conditionCount = countConditions(rule.conditions);
  const actionCount = rule.actions.length;
  const eventDesc = EVENT_DESCRIPTIONS[rule.triggerEvent as SystemEventType] || rule.triggerEvent;

  return (
    <div
      className={`group bg-white/[0.03] rounded-xl border transition-all duration-200 ${
        rule.enabled ? 'border-white/10 hover:border-nesma-secondary/30' : 'border-white/5 opacity-60'
      }`}
    >
      <div className="flex items-center gap-4 p-4">
        {/* Enable/disable toggle */}
        <button
          onClick={() => onToggle(!rule.enabled)}
          className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
          title={rule.enabled ? 'Disable rule' : 'Enable rule'}
        >
          {rule.enabled ? <ToggleRight size={24} className="text-emerald-400" /> : <ToggleLeft size={24} />}
        </button>

        {/* Rule info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold text-white truncate">{rule.name}</h4>
            {rule.stopOnMatch && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">STOP</span>
            )}
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-400">P{rule.priority}</span>
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Zap size={10} className="text-amber-400" />
              {eventDesc}
            </span>
            <span>
              {conditionCount} condition{conditionCount !== 1 ? 's' : ''}
            </span>
            <ChevronRight size={10} />
            <span>
              {actionCount} action{actionCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Edit rule"
          >
            <Edit3 size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            title="Delete rule"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
