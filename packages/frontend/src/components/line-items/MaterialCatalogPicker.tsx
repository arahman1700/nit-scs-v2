import React, { useState, useMemo } from 'react';
import type { MaterialCatalogItem } from '@nit-scs-v2/shared/types';
import { Search } from 'lucide-react';

interface MaterialCatalogPickerProps {
  catalog: Record<string, unknown>[];
  onSelect: (item: MaterialCatalogItem) => void;
}

export const MaterialCatalogPicker: React.FC<MaterialCatalogPickerProps> = ({ catalog, onSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = useMemo(
    () => ['All', ...new Set(catalog.map((m: Record<string, unknown>) => m.category as string))],
    [catalog],
  );

  const filteredCatalog = useMemo(
    () =>
      catalog.filter((m: Record<string, unknown>) => {
        const matchSearch =
          searchTerm === '' ||
          ((m.itemDescription as string) ?? (m.name as string) ?? '')
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          ((m.itemCode as string) ?? (m.code as string) ?? '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchCategory = selectedCategory === 'All' || m.category === selectedCategory;
        return matchSearch && matchCategory;
      }),
    [catalog, searchTerm, selectedCategory],
  );

  return (
    <div className="glass-card rounded-xl p-4 border border-nesma-secondary/20 animate-fade-in">
      <div className="flex gap-3 mb-4">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search items..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-black/30 border border-white/10 rounded-lg text-white text-sm focus:border-nesma-secondary outline-none"
            autoFocus
          />
        </div>
        <select
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          className="px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm focus:border-nesma-secondary outline-none"
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
        {filteredCatalog.map((item: Record<string, unknown>) => {
          const code = (item.itemCode as string) || (item.code as string) || '';
          const name = (item.itemDescription as string) || (item.name as string) || '';
          const price = Number(item.standardCost) || (item.unitPrice as number) || 0;
          const uom = item.uom as Record<string, unknown> | undefined;
          const unitLabel = (uom?.uomCode as string) || (item.unit as string) || '';
          return (
            <button
              key={code}
              type="button"
              onClick={() => onSelect(item as unknown as MaterialCatalogItem)}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 rounded-lg transition-colors text-left group"
            >
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono bg-white/5 px-2 py-0.5 rounded text-gray-400 border border-white/5">
                  {code}
                </span>
                <div>
                  <span className="text-sm text-gray-200 group-hover:text-white">{name}</span>
                  <span className="text-xs text-gray-400 block">{code}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm text-nesma-secondary font-medium">{price?.toLocaleString()} SAR</span>
                <span className="text-xs text-gray-400 block">/{unitLabel}</span>
              </div>
            </button>
          );
        })}
        {filteredCatalog.length === 0 && <div className="text-center py-6 text-gray-400 text-sm">No results found</div>}
      </div>
    </div>
  );
};
