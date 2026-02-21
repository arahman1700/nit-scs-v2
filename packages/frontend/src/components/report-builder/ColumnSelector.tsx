import React from 'react';
import { Check } from 'lucide-react';

// Column definitions per data source
const COLUMNS_BY_SOURCE: Record<string, string[]> = {
  mrrv: ['document_number', 'status', 'supplier', 'project', 'warehouse', 'total_items', 'created_at', 'received_at'],
  mirv: ['document_number', 'status', 'project', 'warehouse', 'requested_by', 'total_value', 'created_at', 'issued_at'],
  mrv: ['document_number', 'status', 'return_reason', 'project', 'warehouse', 'created_at'],
  mrf: ['document_number', 'status', 'project', 'requested_by', 'priority', 'total_items', 'created_at'],
  jo: ['jo_number', 'status', 'jo_type', 'project', 'supplier', 'value', 'sla_due', 'created_at', 'completed_at'],
  rfim: ['document_number', 'status', 'inspection_type', 'result', 'inspector', 'created_at'],
  osd: ['document_number', 'status', 'osd_type', 'shipment', 'quantity_affected', 'created_at'],
  inventory: ['item_code', 'item_name', 'category', 'warehouse', 'quantity', 'unit', 'unit_cost', 'total_value'],
  shipments: ['tracking_number', 'status', 'supplier', 'origin', 'eta', 'items_count', 'created_at'],
  gate_pass: ['document_number', 'status', 'pass_type', 'vehicle', 'driver', 'warehouse', 'created_at'],
  stock_transfer: ['document_number', 'status', 'from_warehouse', 'to_warehouse', 'total_items', 'created_at'],
  employees: ['employee_id', 'name', 'role', 'department', 'project', 'status'],
  suppliers: ['name', 'category', 'contact', 'total_orders', 'rating', 'status'],
  projects: ['project_code', 'name', 'client', 'status', 'active_jobs', 'total_value'],
};

interface ColumnSelectorProps {
  dataSource: string;
  selected: string[];
  onChange: (columns: string[]) => void;
}

export const ColumnSelector: React.FC<ColumnSelectorProps> = ({ dataSource, selected, onChange }) => {
  const available = COLUMNS_BY_SOURCE[dataSource] ?? [];

  function toggleColumn(col: string) {
    if (selected.includes(col)) {
      onChange(selected.filter(c => c !== col));
    } else {
      onChange([...selected, col]);
    }
  }

  function selectAll() {
    onChange(available);
  }

  function clearAll() {
    onChange([]);
  }

  if (!dataSource) {
    return <div className="text-sm text-gray-500">Select a data source first</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm text-gray-400">Columns</label>
        <div className="flex gap-2 text-xs">
          <button onClick={selectAll} className="text-nesma-secondary hover:underline">
            All
          </button>
          <button onClick={clearAll} className="text-gray-500 hover:text-gray-300">
            None
          </button>
        </div>
      </div>
      <div className="space-y-1 max-h-60 overflow-y-auto">
        {available.map(col => {
          const isSelected = selected.includes(col);
          return (
            <button
              key={col}
              onClick={() => toggleColumn(col)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left text-sm transition-colors
                ${isSelected ? 'bg-nesma-primary/30 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}
            >
              <div
                className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0
                  ${isSelected ? 'bg-nesma-primary border-nesma-secondary/50' : 'border-white/20'}`}
              >
                {isSelected && <Check size={10} className="text-white" />}
              </div>
              <span className="capitalize">{col.replace(/_/g, ' ')}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
