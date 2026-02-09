
import React, { useState, useRef, useEffect } from 'react';
import { Download, FileText, Printer } from 'lucide-react';

interface ExportColumn {
  key: string;
  label: string;
}

interface ExportButtonProps {
  data: Record<string, unknown>[];
  columns: ExportColumn[];
  filename?: string;
}

function generateCSV(data: Record<string, unknown>[], columns: ExportColumn[]): string {
  const escapeCSV = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = columns.map((col) => escapeCSV(col.label)).join(',');
  const rows = data.map((row) =>
    columns.map((col) => escapeCSV(row[col.key])).join(',')
  );

  return [header, ...rows].join('\n');
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob(['\uFEFF' + content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  data,
  columns,
  filename = 'export',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleExportCSV = () => {
    const csv = generateCSV(data, columns);
    const dateSuffix = new Date().toISOString().slice(0, 10);
    downloadFile(csv, `${filename}_${dateSuffix}.csv`, 'text/csv');
    setIsOpen(false);
  };

  const handlePrint = () => {
    window.print();
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all"
      >
        <Download size={16} />
        <span className="hidden sm:inline">Export</span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-[#0a1628]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/40 z-40 overflow-hidden animate-fade-in">
          <div className="py-1">
            <button
              onClick={handleExportCSV}
              className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-all group"
            >
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
                <FileText size={16} />
              </div>
              <div>
                <p className="font-medium">Export CSV</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {data.length} row{data.length !== 1 ? 's' : ''}
                </p>
              </div>
            </button>

            <div className="mx-4 h-px bg-white/5" />

            <button
              onClick={handlePrint}
              className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-all group"
            >
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                <Printer size={16} />
              </div>
              <div>
                <p className="font-medium">Print / PDF</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Browser print dialog
                </p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
