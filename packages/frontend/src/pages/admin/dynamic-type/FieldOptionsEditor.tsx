import React, { useState } from 'react';
import { ChevronRight, ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react';

export const INPUT_CLS =
  'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-nesma-secondary focus:ring-1 focus:ring-nesma-secondary outline-none transition-all';

interface FieldOptionsEditorProps {
  options: Array<{ value: string; label: string }>;
  onSave: (options: Array<{ value: string; label: string }>) => void;
}

export const FieldOptionsEditor: React.FC<FieldOptionsEditorProps> = ({ options: initialOptions, onSave }) => {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState(initialOptions);

  React.useEffect(() => {
    setOpts(initialOptions);
  }, [initialOptions]);

  const handleMove = (idx: number, dir: -1 | 1) => {
    const next = [...opts];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setOpts(next);
    onSave(next);
  };

  const handleUpdate = (idx: number, key: 'value' | 'label', val: string) => {
    const next = [...opts];
    next[idx] = { ...next[idx], [key]: val };
    setOpts(next);
  };

  const handleBlur = () => onSave(opts);

  const handleRemove = (idx: number) => {
    const next = opts.filter((_, i) => i !== idx);
    setOpts(next);
    onSave(next);
  };

  const handleAdd = () => {
    const next = [...opts, { value: `opt_${Date.now()}`, label: 'New Option' }];
    setOpts(next);
    onSave(next);
  };

  return (
    <div className="mt-3 border-t border-white/5 pt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs text-nesma-secondary hover:underline"
      >
        <ChevronRight size={14} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
        Options ({opts.length})
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {opts.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                value={opt.value}
                onChange={e => handleUpdate(idx, 'value', e.target.value)}
                onBlur={handleBlur}
                className={`${INPUT_CLS} w-32`}
                placeholder="value"
              />
              <input
                value={opt.label}
                onChange={e => handleUpdate(idx, 'label', e.target.value)}
                onBlur={handleBlur}
                className={`${INPUT_CLS} flex-1`}
                placeholder="label"
              />
              <button
                onClick={() => handleMove(idx, -1)}
                disabled={idx === 0}
                className="p-1 rounded hover:bg-white/10 text-gray-400 disabled:opacity-30"
                aria-label="Move option up"
              >
                <ChevronUp size={14} />
              </button>
              <button
                onClick={() => handleMove(idx, 1)}
                disabled={idx === opts.length - 1}
                className="p-1 rounded hover:bg-white/10 text-gray-400 disabled:opacity-30"
                aria-label="Move option down"
              >
                <ChevronDown size={14} />
              </button>
              <button
                onClick={() => handleRemove(idx)}
                className="p-1 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400"
                aria-label="Remove option"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button onClick={handleAdd} className="flex items-center gap-1 text-xs text-nesma-secondary hover:underline">
            <Plus size={14} /> Add Option
          </button>
        </div>
      )}
    </div>
  );
};
