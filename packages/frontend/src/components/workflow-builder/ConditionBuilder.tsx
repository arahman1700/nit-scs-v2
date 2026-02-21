import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface LeafCondition {
  field: string;
  op: string;
  value: string;
}

interface GroupCondition {
  operator: 'AND' | 'OR';
  conditions: Condition[];
}

type Condition = LeafCondition | GroupCondition;

interface ConditionBuilderProps {
  value: Condition;
  onChange: (condition: Condition) => void;
  entityType?: string;
}

const OPERATORS = [
  { value: 'eq', label: '= equals' },
  { value: 'ne', label: '!= not equals' },
  { value: 'gt', label: '> greater than' },
  { value: 'gte', label: '>= greater or equal' },
  { value: 'lt', label: '< less than' },
  { value: 'lte', label: '<= less or equal' },
  { value: 'in', label: 'in (comma-separated)' },
  { value: 'contains', label: 'contains' },
];

const COMMON_FIELDS = ['payload.newValues.status', 'payload.oldValues.status', 'entityType', 'action'];

const ENTITY_FIELD_MAP: Record<string, string[]> = {
  mrrv: [
    ...COMMON_FIELDS,
    'payload.newValues.totalAmount',
    'payload.newValues.supplierId',
    'payload.newValues.warehouseId',
    'payload.newValues.projectId',
  ],
  mirv: [
    ...COMMON_FIELDS,
    'payload.newValues.totalAmount',
    'payload.newValues.warehouseId',
    'payload.newValues.projectId',
    'payload.newValues.requestedById',
  ],
  mrv: [...COMMON_FIELDS, 'payload.newValues.warehouseId', 'payload.newValues.projectId'],
  rfim: [...COMMON_FIELDS, 'payload.newValues.result', 'payload.newValues.inspectedById'],
  osd_report: [...COMMON_FIELDS, 'payload.newValues.type', 'payload.newValues.projectId'],
  material_requisition: [
    ...COMMON_FIELDS,
    'payload.newValues.totalAmount',
    'payload.newValues.projectId',
    'payload.newValues.priority',
  ],
  job_order: [...COMMON_FIELDS, 'payload.newValues.projectId', 'payload.newValues.totalAmount'],
  shipment: [...COMMON_FIELDS, 'payload.newValues.supplierId', 'payload.newValues.carrier'],
  gate_pass: [...COMMON_FIELDS, 'payload.newValues.type', 'payload.newValues.projectId'],
  stock_transfer: [...COMMON_FIELDS, 'payload.newValues.fromWarehouseId', 'payload.newValues.toWarehouseId'],
  scrap: [...COMMON_FIELDS, 'payload.newValues.approvalStatus', 'payload.newValues.projectId'],
  imsf: [...COMMON_FIELDS, 'payload.newValues.senderProjectId', 'payload.newValues.receiverProjectId'],
};

function isGroup(c: Condition): c is GroupCondition {
  return 'operator' in c && 'conditions' in c;
}

const ConditionLeaf: React.FC<{
  condition: LeafCondition;
  onChange: (c: LeafCondition) => void;
  onRemove: () => void;
  suggestions: string[];
  depth: number;
  index: number;
}> = ({ condition, onChange, onRemove, suggestions, depth, index }) => {
  const datalistId = `field-suggestions-${depth}-${index}`;

  return (
    <div className="flex items-center gap-2 bg-black/20 rounded-lg p-2 border border-white/5">
      <input
        type="text"
        value={condition.field}
        onChange={e => onChange({ ...condition, field: e.target.value })}
        placeholder="field path"
        list={datalistId}
        className="flex-1 bg-black/40 text-white text-sm rounded px-2 py-1.5 border border-white/10 focus:border-nesma-secondary outline-none min-w-[120px]"
      />
      <datalist id={datalistId}>
        {suggestions.map(f => (
          <option key={f} value={f} />
        ))}
      </datalist>
      <select
        value={condition.op}
        onChange={e => onChange({ ...condition, op: e.target.value })}
        className="bg-black/40 text-white text-sm rounded px-2 py-1.5 border border-white/10 focus:border-nesma-secondary outline-none"
      >
        {OPERATORS.map(op => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={condition.value}
        onChange={e => onChange({ ...condition, value: e.target.value })}
        placeholder="value"
        className="flex-1 bg-black/40 text-white text-sm rounded px-2 py-1.5 border border-white/10 focus:border-nesma-secondary outline-none min-w-[80px]"
      />
      <button onClick={onRemove} className="text-red-400 hover:text-red-300 p-1">
        <Trash2 size={14} />
      </button>
    </div>
  );
};

const ConditionGroup: React.FC<{
  group: GroupCondition;
  onChange: (g: GroupCondition) => void;
  depth: number;
  suggestions: string[];
}> = ({ group, onChange, depth, suggestions }) => {
  const addCondition = () => {
    onChange({
      ...group,
      conditions: [...group.conditions, { field: '', op: 'eq', value: '' }],
    });
  };

  const addGroup = () => {
    onChange({
      ...group,
      conditions: [...group.conditions, { operator: 'AND', conditions: [] }],
    });
  };

  const updateCondition = (index: number, updated: Condition) => {
    const newConditions = [...group.conditions];
    newConditions[index] = updated;
    onChange({ ...group, conditions: newConditions });
  };

  const removeCondition = (index: number) => {
    onChange({
      ...group,
      conditions: group.conditions.filter((_, i) => i !== index),
    });
  };

  return (
    <div className={`border border-white/10 rounded-xl p-3 ${depth > 0 ? 'ml-4 bg-white/[0.02]' : ''}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-gray-400 uppercase font-bold">Match</span>
        <button
          onClick={() => onChange({ ...group, operator: group.operator === 'AND' ? 'OR' : 'AND' })}
          className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
            group.operator === 'AND'
              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
          }`}
        >
          {group.operator}
        </button>
        <span className="text-xs text-gray-400">of the following</span>
      </div>

      <div className="space-y-2">
        {group.conditions.map((condition, i) => (
          <div key={i}>
            {isGroup(condition) ? (
              <ConditionGroup
                group={condition}
                onChange={g => updateCondition(i, g)}
                depth={depth + 1}
                suggestions={suggestions}
              />
            ) : (
              <ConditionLeaf
                condition={condition as LeafCondition}
                onChange={c => updateCondition(i, c)}
                onRemove={() => removeCondition(i)}
                suggestions={suggestions}
                depth={depth}
                index={i}
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={addCondition}
          className="flex items-center gap-1 text-xs text-nesma-secondary hover:text-white transition-colors"
        >
          <Plus size={12} /> Add condition
        </button>
        {depth < 2 && (
          <button
            onClick={addGroup}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
          >
            <Plus size={12} /> Add group
          </button>
        )}
      </div>
    </div>
  );
};

export const ConditionBuilder: React.FC<ConditionBuilderProps> = ({ value, onChange, entityType }) => {
  const [group] = useState<GroupCondition>(() => {
    if (isGroup(value)) return value;
    return { operator: 'AND', conditions: value.field ? [value] : [] };
  });

  const fieldSuggestions = entityType && ENTITY_FIELD_MAP[entityType] ? ENTITY_FIELD_MAP[entityType] : COMMON_FIELDS;

  return (
    <div>
      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Conditions (IF)</label>
      <ConditionGroup
        group={isGroup(value) ? value : group}
        onChange={onChange}
        depth={0}
        suggestions={fieldSuggestions}
      />
    </div>
  );
};
