import { ALL_EVENTS, EVENT_DESCRIPTIONS, type SystemEventType } from '@nit-scs/shared';

interface TriggerSelectorProps {
  value: string;
  onChange: (event: string) => void;
}

const eventEntries = Object.entries(ALL_EVENTS) as [string, SystemEventType][];

export const TriggerSelector: React.FC<TriggerSelectorProps> = ({ value, onChange }) => {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Trigger Event</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-black/40 text-white text-sm rounded-lg p-3 border border-white/10 focus:border-[#80D1E9] focus:ring-1 focus:ring-[#80D1E9] outline-none"
      >
        <option value="">Select an event...</option>
        {eventEntries.map(([key, eventType]) => (
          <option key={key} value={eventType}>
            {eventType} — {EVENT_DESCRIPTIONS[eventType]}
          </option>
        ))}
      </select>
      {value && EVENT_DESCRIPTIONS[value as SystemEventType] && (
        <p className="text-xs text-gray-500 mt-1">{EVENT_DESCRIPTIONS[value as SystemEventType]}</p>
      )}
    </div>
  );
};
