import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { SearchResult } from '@/api/hooks/useSearch';
import {
  Package,
  ArrowUpCircle,
  RotateCcw,
  ClipboardList,
  ClipboardCheck,
  AlertTriangle,
  Briefcase,
  ShieldCheck,
  Ship,
  ArrowLeftRight,
  Warehouse,
  Trash2,
  PlusCircle,
  Users,
  Wrench,
  Loader2,
} from 'lucide-react';

interface GlobalSearchDropdownProps {
  results: SearchResult[];
  isLoading: boolean;
  query: string;
  onClose: () => void;
  onSelect: (type: string, id: string) => void;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  grn: Package,
  mi: ArrowUpCircle,
  mrn: RotateCcw,
  mr: ClipboardList,
  qci: ClipboardCheck,
  dr: AlertTriangle,
  jo: Briefcase,
  'gate-pass': ShieldCheck,
  shipment: Ship,
  imsf: ArrowLeftRight,
  wt: Warehouse,
  scrap: Trash2,
  surplus: PlusCircle,
  handover: Users,
  'tool-issue': Wrench,
};

const TYPE_LABELS: Record<string, string> = {
  grn: 'GRN',
  mi: 'Material Issue',
  mrn: 'MRN',
  mr: 'Material Requisition',
  qci: 'QCI',
  dr: 'Discrepancy Report',
  jo: 'Job Order',
  'gate-pass': 'Gate Pass',
  shipment: 'Shipment',
  imsf: 'IMSF',
  wt: 'Warehouse Transfer',
  scrap: 'Scrap',
  surplus: 'Surplus',
  handover: 'Handover',
  'tool-issue': 'Tool Issue',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (['approved', 'completed', 'delivered', 'received', 'stored', 'qc_approved', 'returned'].includes(s))
    return 'text-emerald-400 bg-emerald-500/10';
  if (['draft', 'created', 'identified'].includes(s)) return 'text-gray-400 bg-white/5';
  if (['rejected', 'cancelled'].includes(s)) return 'text-red-400 bg-red-500/10';
  return 'text-amber-400 bg-amber-500/10';
}

export const GlobalSearchDropdown: React.FC<GlobalSearchDropdownProps> = ({
  results,
  isLoading,
  query,
  onClose,
  onSelect,
}) => {
  const [activeIndex, setActiveIndex] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);

  // Group results by type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.type] ??= []).push(r);
    return acc;
  }, {});

  // Flat list for keyboard navigation
  const flatResults = Object.values(grouped).flat();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(prev => (prev < flatResults.length - 1 ? prev + 1 : 0));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => (prev > 0 ? prev - 1 : flatResults.length - 1));
      }
      if (e.key === 'Enter' && activeIndex >= 0 && activeIndex < flatResults.length) {
        e.preventDefault();
        const item = flatResults[activeIndex];
        onSelect(item.type, item.id);
      }
    },
    [activeIndex, flatResults, onClose, onSelect],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-search-item]');
      items[activeIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(-1);
  }, [results]);

  // Empty / loading states
  if (query.length < 2) {
    return (
      <div className="absolute top-full left-0 right-0 mt-2 glass-panel rounded-xl border border-white/10 shadow-2xl z-50 p-6 text-center">
        <p className="text-sm text-gray-400">Type 2+ characters to search</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="absolute top-full left-0 right-0 mt-2 glass-panel rounded-xl border border-white/10 shadow-2xl z-50 p-6 text-center">
        <Loader2 size={20} className="animate-spin text-nesma-secondary mx-auto mb-2" />
        <p className="text-sm text-gray-400">Searching...</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="absolute top-full left-0 right-0 mt-2 glass-panel rounded-xl border border-white/10 shadow-2xl z-50 p-6 text-center">
        <p className="text-sm text-gray-400">No results found for &quot;{query}&quot;</p>
      </div>
    );
  }

  let flatIndex = 0;

  return (
    <div
      ref={listRef}
      className="absolute top-full left-0 right-0 mt-2 glass-panel rounded-xl border border-white/10 shadow-2xl z-50 max-h-96 overflow-y-auto"
    >
      {Object.entries(grouped).map(([type, items]) => {
        const Icon = TYPE_ICONS[type] ?? Package;
        const label = TYPE_LABELS[type] ?? type;

        return (
          <div key={type}>
            <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5">
              <Icon size={12} className="text-gray-500" />
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{label}</span>
              <span className="text-[10px] text-gray-600">{items.length}</span>
            </div>
            {items.map(item => {
              const idx = flatIndex++;
              const isActive = idx === activeIndex;
              return (
                <div
                  key={item.id}
                  data-search-item
                  className={`px-4 py-3 cursor-pointer transition-all flex items-center gap-3 ${
                    isActive ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}
                  onClick={() => onSelect(item.type, item.id)}
                  onMouseEnter={() => setActiveIndex(idx)}
                >
                  <Icon size={16} className="text-nesma-secondary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">{item.number}</span>
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusColor(item.status)}`}
                      >
                        {item.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{item.summary}</p>
                  </div>
                  <span className="text-[10px] text-gray-500 shrink-0">{formatDate(item.createdAt)}</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
