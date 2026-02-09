import { useState, useMemo } from 'react';
import { Eye, Send } from 'lucide-react';
import { usePreviewEmailTemplate } from '@/api/hooks/useEmailTemplates';

interface TemplatePreviewProps {
  templateId: string | undefined;
  variables: string[];
}

/**
 * Minimal HTML sanitizer that strips script tags and event handlers.
 * For admin-only template preview where HTML comes from our own backend.
 */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]*/gi, '')
    .replace(/javascript\s*:/gi, '');
}

export const TemplatePreview: React.FC<TemplatePreviewProps> = ({ templateId, variables }) => {
  const [sampleData, setSampleData] = useState<Record<string, string>>({});
  const preview = usePreviewEmailTemplate();

  const handlePreview = () => {
    if (!templateId) return;
    preview.mutate({ id: templateId, variables: sampleData });
  };

  const result = preview.data as { data?: { subject?: string; html?: string } } | undefined;

  const sanitizedHtml = useMemo(() => {
    if (!result?.data?.html) return '';
    return sanitizeHtml(result.data.html);
  }, [result?.data?.html]);

  return (
    <div className="space-y-4">
      {/* Sample variable inputs */}
      <div>
        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Sample Variables</label>
        <div className="grid grid-cols-2 gap-2">
          {variables.map(v => (
            <div key={v}>
              <label className="text-[10px] text-gray-500 uppercase">{v}</label>
              <input
                type="text"
                value={sampleData[v] || ''}
                onChange={e => setSampleData({ ...sampleData, [v]: e.target.value })}
                placeholder={`Sample ${v}`}
                className="w-full bg-black/40 text-white text-sm rounded px-2.5 py-1.5 border border-white/10 focus:border-[#80D1E9] outline-none"
              />
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handlePreview}
        disabled={!templateId || preview.isPending}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#80D1E9]/20 text-[#80D1E9] hover:bg-[#80D1E9]/30 transition-colors disabled:opacity-40 text-sm font-medium"
      >
        {preview.isPending ? (
          <div className="w-4 h-4 border-2 border-[#80D1E9] border-t-transparent rounded-full animate-spin" />
        ) : (
          <Eye size={14} />
        )}
        Render Preview
      </button>

      {/* Preview output — rendered in a sandboxed iframe for safety */}
      {sanitizedHtml && (
        <div className="bg-white rounded-lg overflow-hidden">
          {/* Subject bar */}
          <div className="bg-gray-100 px-4 py-2 border-b flex items-center gap-2">
            <Send size={12} className="text-gray-500" />
            <span className="text-sm text-gray-700 font-medium">{result?.data?.subject || '(no subject)'}</span>
          </div>
          {/* HTML body rendered via sandbox iframe */}
          <iframe srcDoc={sanitizedHtml} sandbox="" title="Email preview" className="w-full min-h-[300px] border-0" />
        </div>
      )}

      {preview.isError && (
        <div className="text-red-400 text-sm bg-red-500/10 rounded-lg px-3 py-2">
          Preview failed: {(preview.error as Error).message}
        </div>
      )}
    </div>
  );
};
