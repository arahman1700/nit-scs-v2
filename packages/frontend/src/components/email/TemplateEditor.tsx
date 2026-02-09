import { useState } from 'react';
import { Plus, Code, Eye } from 'lucide-react';

interface TemplateEditorProps {
  code: string;
  subject: string;
  bodyHtml: string;
  variables: string[];
  onCodeChange: (code: string) => void;
  onSubjectChange: (subject: string) => void;
  onBodyChange: (bodyHtml: string) => void;
  onVariablesChange: (variables: string[]) => void;
  onPreview?: () => void;
}

const COMMON_VARIABLES = [
  '{{documentNumber}}',
  '{{documentType}}',
  '{{status}}',
  '{{amount}}',
  '{{approverName}}',
  '{{requesterName}}',
  '{{projectName}}',
  '{{warehouseName}}',
  '{{itemName}}',
  '{{companyName}}',
  '{{loginUrl}}',
];

export const TemplateEditor: React.FC<TemplateEditorProps> = ({
  code,
  subject,
  bodyHtml,
  variables,
  onCodeChange,
  onSubjectChange,
  onBodyChange,
  onVariablesChange,
  onPreview,
}) => {
  const [showVariables, setShowVariables] = useState(false);

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('template-body') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = bodyHtml.substring(0, start) + variable + bodyHtml.substring(end);
      onBodyChange(newValue);
      // Restore cursor position after the inserted variable
      setTimeout(() => {
        textarea.selectionStart = start + variable.length;
        textarea.selectionEnd = start + variable.length;
        textarea.focus();
      }, 0);
    }
  };

  const addVariable = (variable: string) => {
    if (!variables.includes(variable)) {
      onVariablesChange([...variables, variable]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Template Code */}
      <div>
        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Template Code</label>
        <input
          type="text"
          value={code}
          onChange={e => onCodeChange(e.target.value.replace(/[^a-z0-9_]/g, ''))}
          placeholder="e.g. approval_requested"
          className="w-full bg-black/40 text-white text-sm rounded-lg p-2.5 border border-white/10 focus:border-[#80D1E9] outline-none font-mono"
        />
      </div>

      {/* Subject */}
      <div>
        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Email Subject</label>
        <input
          type="text"
          value={subject}
          onChange={e => onSubjectChange(e.target.value)}
          placeholder="e.g. {{documentType}} #{{documentNumber}} requires approval"
          className="w-full bg-black/40 text-white text-sm rounded-lg p-2.5 border border-white/10 focus:border-[#80D1E9] outline-none"
        />
      </div>

      {/* Variable toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setShowVariables(!showVariables)}
          className="flex items-center gap-1.5 text-xs text-[#80D1E9] hover:text-white transition-colors px-2 py-1 rounded-lg bg-white/5"
        >
          <Code size={12} /> Insert Variable
        </button>
        {onPreview && (
          <button
            onClick={onPreview}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded-lg bg-white/5"
          >
            <Eye size={12} /> Preview
          </button>
        )}
        {showVariables && (
          <div className="flex flex-wrap gap-1">
            {COMMON_VARIABLES.map(v => (
              <button
                key={v}
                onClick={() => insertVariable(v)}
                className="text-[10px] px-2 py-1 rounded bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 transition-colors font-mono"
              >
                {v}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* HTML Body */}
      <div>
        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
          HTML Body (Handlebars)
        </label>
        <textarea
          id="template-body"
          value={bodyHtml}
          onChange={e => onBodyChange(e.target.value)}
          rows={16}
          placeholder={`<div style="font-family: Arial, sans-serif; padding: 20px;">
  <h2>{{documentType}} Requires Your Approval</h2>
  <p>Document <strong>#{{documentNumber}}</strong> has been submitted for approval.</p>
  <p>Amount: <strong>{{amount}} SAR</strong></p>
  <a href="{{loginUrl}}" style="...">Review Now</a>
</div>`}
          className="w-full bg-black/40 text-white text-sm rounded-lg p-3 border border-white/10 focus:border-[#80D1E9] outline-none font-mono leading-relaxed resize-y"
        />
      </div>

      {/* Variables list */}
      <div>
        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
          Declared Variables
        </label>
        <div className="flex flex-wrap gap-1.5">
          {variables.map((v, i) => (
            <span key={i} className="text-xs px-2 py-1 rounded-lg bg-white/10 text-gray-300 flex items-center gap-1">
              {v}
              <button
                onClick={() => onVariablesChange(variables.filter((_, idx) => idx !== i))}
                className="text-gray-500 hover:text-red-400"
              >
                x
              </button>
            </span>
          ))}
          <button
            onClick={() => {
              const name = prompt('Variable name (without braces):');
              if (name) addVariable(name.trim());
            }}
            className="text-xs px-2 py-1 rounded-lg bg-white/5 text-gray-500 hover:text-white transition-colors flex items-center gap-1"
          >
            <Plus size={10} /> Add
          </button>
        </div>
      </div>
    </div>
  );
};
