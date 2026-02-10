import React, { useState, useRef, useEffect } from 'react';
import { Download, FileText, FileSpreadsheet, Printer, Loader2 } from 'lucide-react';
import { exportToExcel } from '@/lib/excelExport';

interface ExportButtonProps {
  onExportPdf?: () => void;
  onExportExcel?: () => void;
  onPrint?: () => void;
  /** Pass data+columns for built-in CSV export when no custom onExportExcel handler */
  data?: Record<string, unknown>[];
  columns?: Array<{ key: string; label: string }>;
  filename?: string;
  loading?: boolean;
  disabled?: boolean;
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  onExportPdf,
  onExportExcel,
  onPrint,
  data,
  columns,
  filename = 'export',
  loading = false,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
    if (onExportExcel) {
      onExportExcel();
    } else if (data && columns) {
      exportToExcel(
        data,
        columns.map(c => ({ header: c.label, key: c.key })),
        filename,
      );
    }
    setIsOpen(false);
  };

  const handleExportPdf = () => {
    onExportPdf?.();
    setIsOpen(false);
  };

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
    setIsOpen(false);
  };

  const hasPdf = !!onExportPdf;
  const hasExcel = !!onExportExcel || (!!data && !!columns);
  const rowCount = data?.length;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || loading}
        className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        <span className="hidden sm:inline">Export</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-[#0a1628]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/40 z-40 overflow-hidden animate-fade-in">
          <div className="py-1">
            {hasPdf && (
              <>
                <button
                  onClick={handleExportPdf}
                  disabled={loading}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-all group disabled:opacity-50"
                >
                  <div className="p-1.5 rounded-lg bg-red-500/10 text-red-400 group-hover:bg-red-500/20 transition-colors">
                    <FileText size={16} />
                  </div>
                  <div>
                    <p className="font-medium">Export PDF</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Download as PDF document</p>
                  </div>
                </button>
                <div className="mx-4 h-px bg-white/5" />
              </>
            )}

            {hasExcel && (
              <>
                <button
                  onClick={handleExportCSV}
                  disabled={loading}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-all group disabled:opacity-50"
                >
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
                    <FileSpreadsheet size={16} />
                  </div>
                  <div>
                    <p className="font-medium">Export CSV</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {rowCount !== undefined ? `${rowCount} row${rowCount !== 1 ? 's' : ''}` : 'Spreadsheet format'}
                    </p>
                  </div>
                </button>
                <div className="mx-4 h-px bg-white/5" />
              </>
            )}

            <button
              onClick={handlePrint}
              className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-all group"
            >
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                <Printer size={16} />
              </div>
              <div>
                <p className="font-medium">Print</p>
                <p className="text-[10px] text-gray-500 mt-0.5">Browser print dialog</p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
