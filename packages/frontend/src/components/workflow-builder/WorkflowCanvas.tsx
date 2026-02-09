import { TriggerSelector } from './TriggerSelector';
import { ConditionBuilder } from './ConditionBuilder';
import { ActionBuilder } from './ActionBuilder';
import { ArrowDown, Zap, Filter, Play } from 'lucide-react';

interface WorkflowRule {
  id?: string;
  name: string;
  triggerEvent: string;
  conditions: Record<string, unknown>;
  actions: { type: string; params: Record<string, string> }[];
  stopOnMatch: boolean;
  enabled: boolean;
}

interface WorkflowCanvasProps {
  rule: WorkflowRule;
  onChange: (rule: WorkflowRule) => void;
}

const StepConnector: React.FC = () => (
  <div className="flex justify-center py-2">
    <div className="flex flex-col items-center">
      <div className="w-px h-4 bg-gradient-to-b from-white/20 to-white/5" />
      <ArrowDown size={14} className="text-white/20" />
    </div>
  </div>
);

const StepHeader: React.FC<{ icon: React.ElementType; label: string; color: string }> = ({
  icon: Icon,
  label,
  color,
}) => (
  <div className="flex items-center gap-2 mb-3">
    <div className={`w-7 h-7 rounded-lg ${color} flex items-center justify-center`}>
      <Icon size={14} className="text-white" />
    </div>
    <span className="text-sm font-bold text-white/80 uppercase tracking-wide">{label}</span>
  </div>
);

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({ rule, onChange }) => {
  return (
    <div className="space-y-1">
      {/* Step 1: WHEN (Trigger) */}
      <div className="bg-white/[0.03] rounded-2xl p-5 border border-white/5">
        <StepHeader icon={Zap} label="When" color="bg-amber-500/20" />
        <TriggerSelector value={rule.triggerEvent} onChange={triggerEvent => onChange({ ...rule, triggerEvent })} />
      </div>

      <StepConnector />

      {/* Step 2: IF (Conditions) */}
      <div className="bg-white/[0.03] rounded-2xl p-5 border border-white/5">
        <StepHeader icon={Filter} label="If" color="bg-blue-500/20" />
        <ConditionBuilder
          value={rule.conditions as never}
          onChange={conditions => onChange({ ...rule, conditions: conditions as unknown as Record<string, unknown> })}
        />
      </div>

      <StepConnector />

      {/* Step 3: THEN (Actions) */}
      <div className="bg-white/[0.03] rounded-2xl p-5 border border-white/5">
        <StepHeader icon={Play} label="Then" color="bg-emerald-500/20" />
        <ActionBuilder value={rule.actions} onChange={actions => onChange({ ...rule, actions })} />
      </div>

      {/* Options */}
      <div className="pt-3 flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={rule.stopOnMatch}
            onChange={e => onChange({ ...rule, stopOnMatch: e.target.checked })}
            className="rounded border-white/20 bg-black/40 text-[#80D1E9] focus:ring-[#80D1E9]"
          />
          Stop processing further rules on match
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={rule.enabled}
            onChange={e => onChange({ ...rule, enabled: e.target.checked })}
            className="rounded border-white/20 bg-black/40 text-[#80D1E9] focus:ring-[#80D1E9]"
          />
          Enabled
        </label>
      </div>
    </div>
  );
};
