import { Plus, Trash2 } from 'lucide-react';

interface Action {
  type: string;
  params: Record<string, string>;
}

interface ActionBuilderProps {
  value: Action[];
  onChange: (actions: Action[]) => void;
}

const ACTION_TYPES = [
  { value: 'send_email', label: 'Send Email', params: ['templateCode', 'to'] },
  { value: 'create_notification', label: 'Create Notification', params: ['title', 'body', 'recipientRole'] },
  { value: 'change_status', label: 'Change Status', params: ['targetStatus'] },
  { value: 'assign_task', label: 'Assign Task', params: ['title', 'assigneeRole', 'priority'] },
  { value: 'reserve_stock', label: 'Reserve Stock', params: [] },
  { value: 'create_follow_up', label: 'Create Follow-Up', params: ['targetDocType'] },
  { value: 'webhook', label: 'Webhook (HTTP POST)', params: ['url'] },
];

const ActionCard: React.FC<{
  action: Action;
  onChange: (a: Action) => void;
  onRemove: () => void;
  index: number;
}> = ({ action, onChange, onRemove, index }) => {
  const typeInfo = ACTION_TYPES.find(t => t.value === action.type);

  return (
    <div className="bg-black/20 rounded-xl p-3 border border-white/5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-[#80D1E9]">Action #{index + 1}</span>
        <button onClick={onRemove} className="text-red-400 hover:text-red-300 p-1">
          <Trash2 size={14} />
        </button>
      </div>

      <select
        value={action.type}
        onChange={e => onChange({ type: e.target.value, params: {} })}
        className="w-full bg-black/40 text-white text-sm rounded-lg p-2.5 border border-white/10 focus:border-[#80D1E9] outline-none mb-3"
      >
        <option value="">Select action type...</option>
        {ACTION_TYPES.map(t => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>

      {typeInfo && typeInfo.params.length > 0 && (
        <div className="space-y-2">
          {typeInfo.params.map(param => (
            <div key={param}>
              <label className="text-[10px] text-gray-500 uppercase">{param}</label>
              <input
                type="text"
                value={action.params[param] || ''}
                onChange={e =>
                  onChange({
                    ...action,
                    params: { ...action.params, [param]: e.target.value },
                  })
                }
                placeholder={getPlaceholder(action.type, param)}
                className="w-full bg-black/40 text-white text-sm rounded px-2.5 py-1.5 border border-white/10 focus:border-[#80D1E9] outline-none"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function getPlaceholder(type: string, param: string): string {
  const map: Record<string, Record<string, string>> = {
    send_email: { templateCode: 'approval_requested', to: 'role:manager or email@example.com' },
    create_notification: { title: 'Notification title', body: 'Optional body text', recipientRole: 'manager' },
    change_status: { targetStatus: 'approved' },
    assign_task: { title: 'Task title', assigneeRole: 'warehouse_supervisor', priority: 'medium' },
    create_follow_up: { targetDocType: 'mirv' },
    webhook: { url: 'https://example.com/webhook' },
  };
  return map[type]?.[param] || param;
}

export const ActionBuilder: React.FC<ActionBuilderProps> = ({ value, onChange }) => {
  const addAction = () => {
    onChange([...value, { type: '', params: {} }]);
  };

  const updateAction = (index: number, action: Action) => {
    const updated = [...value];
    updated[index] = action;
    onChange(updated);
  };

  const removeAction = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div>
      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Actions (THEN)</label>
      <div className="space-y-3">
        {value.map((action, i) => (
          <ActionCard
            key={i}
            action={action}
            onChange={a => updateAction(i, a)}
            onRemove={() => removeAction(i)}
            index={i}
          />
        ))}
      </div>
      <button
        onClick={addAction}
        className="flex items-center gap-1.5 mt-3 text-sm text-[#80D1E9] hover:text-white transition-colors"
      >
        <Plus size={14} /> Add action
      </button>
    </div>
  );
};
