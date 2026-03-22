import React, { useState } from 'react';
import { INPUT_CLS } from './FieldOptionsEditor';
import { ChevronRight, Check, X } from 'lucide-react';

interface ValidationRulesPanelProps {
  fieldType: string;
  rules: Record<string, unknown>;
  onSave: (rules: Record<string, unknown>) => void;
}

export const ValidationRulesPanel: React.FC<ValidationRulesPanelProps> = ({ fieldType, rules: initialRules, onSave }) => {
  const [open, setOpen] = useState(false);
  const [rules, setRules] = useState<Record<string, unknown>>(initialRules);
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<boolean | null>(null);

  React.useEffect(() => {
    setRules(initialRules);
  }, [initialRules]);

  const updateRule = (key: string, value: unknown) => {
    setRules(r => ({ ...r, [key]: value }));
  };

  const handleBlur = () => {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rules)) {
      if (v !== '' && v !== undefined && v !== null) cleaned[k] = v;
    }
    onSave(cleaned);
  };

  const handleTestPattern = () => {
    const pattern = rules.pattern as string;
    if (!pattern) {
      setTestResult(null);
      return;
    }
    try {
      setTestResult(new RegExp(pattern).test(testInput));
    } catch {
      setTestResult(false);
    }
  };

  const showNumber = ['number', 'currency'].includes(fieldType);
  const showText = ['text', 'email', 'phone', 'url', 'textarea'].includes(fieldType);
  const showDate = ['date', 'datetime'].includes(fieldType);
  const showPattern = ['text', 'email', 'phone', 'url'].includes(fieldType);

  if (!showNumber && !showText && !showDate) return null;

  return (
    <div className="mt-3 border-t border-white/5 pt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs text-nesma-secondary hover:underline"
      >
        <ChevronRight size={14} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
        Validation Rules
      </button>
      {open && (
        <div className="mt-2 grid grid-cols-2 gap-3">
          {showNumber && (
            <>
              <div>
                <label htmlFor="validation-min-field" className="block text-xs text-gray-400 mb-1">
                  Min
                </label>
                <input
                  id="validation-min-field"
                  type="number"
                  value={(rules.min as number) ?? ''}
                  onChange={e => updateRule('min', e.target.value ? Number(e.target.value) : '')}
                  onBlur={handleBlur}
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label htmlFor="validation-max-field" className="block text-xs text-gray-400 mb-1">
                  Max
                </label>
                <input
                  id="validation-max-field"
                  type="number"
                  value={(rules.max as number) ?? ''}
                  onChange={e => updateRule('max', e.target.value ? Number(e.target.value) : '')}
                  onBlur={handleBlur}
                  className={INPUT_CLS}
                />
              </div>
            </>
          )}
          {showText && (
            <>
              <div>
                <label htmlFor="validation-min-length-field" className="block text-xs text-gray-400 mb-1">
                  Min Length
                </label>
                <input
                  id="validation-min-length-field"
                  type="number"
                  value={(rules.minLength as number) ?? ''}
                  onChange={e => updateRule('minLength', e.target.value ? Number(e.target.value) : '')}
                  onBlur={handleBlur}
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label htmlFor="validation-max-length-field" className="block text-xs text-gray-400 mb-1">
                  Max Length
                </label>
                <input
                  id="validation-max-length-field"
                  type="number"
                  value={(rules.maxLength as number) ?? ''}
                  onChange={e => updateRule('maxLength', e.target.value ? Number(e.target.value) : '')}
                  onBlur={handleBlur}
                  className={INPUT_CLS}
                />
              </div>
            </>
          )}
          {showDate && (
            <>
              <div>
                <label htmlFor="validation-min-date-field" className="block text-xs text-gray-400 mb-1">
                  Min Date
                </label>
                <input
                  id="validation-min-date-field"
                  type={fieldType === 'datetime' ? 'datetime-local' : 'date'}
                  value={(rules.min as string) ?? ''}
                  onChange={e => updateRule('min', e.target.value)}
                  onBlur={handleBlur}
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label htmlFor="validation-max-date-field" className="block text-xs text-gray-400 mb-1">
                  Max Date
                </label>
                <input
                  id="validation-max-date-field"
                  type={fieldType === 'datetime' ? 'datetime-local' : 'date'}
                  value={(rules.max as string) ?? ''}
                  onChange={e => updateRule('max', e.target.value)}
                  onBlur={handleBlur}
                  className={INPUT_CLS}
                />
              </div>
            </>
          )}
          {showPattern && (
            <div className="col-span-2">
              <label htmlFor="validation-pattern-field" className="block text-xs text-gray-400 mb-1">
                Pattern (regex)
              </label>
              <div className="flex gap-2">
                <input
                  id="validation-pattern-field"
                  value={(rules.pattern as string) ?? ''}
                  onChange={e => updateRule('pattern', e.target.value)}
                  onBlur={handleBlur}
                  className={`${INPUT_CLS} flex-1`}
                  placeholder="^[A-Z]{2}-\\d{4}$"
                />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input
                  value={testInput}
                  onChange={e => setTestInput(e.target.value)}
                  className={`${INPUT_CLS} flex-1`}
                  placeholder="Test value..."
                />
                <button
                  onClick={handleTestPattern}
                  className="px-3 py-2 rounded-lg bg-white/10 text-xs text-gray-300 hover:bg-white/15 transition-colors"
                >
                  Test
                </button>
                {testResult !== null &&
                  (testResult ? (
                    <Check size={16} className="text-emerald-400" />
                  ) : (
                    <X size={16} className="text-red-400" />
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
