import React from 'react';

const ENTITY_TYPES = [
  { value: 'mrrv', label: 'Material Receiving (MRRV)' },
  { value: 'mirv', label: 'Material Issuing (MIRV)' },
  { value: 'mrv', label: 'Material Returns (MRV)' },
  { value: 'mrf', label: 'Material Requisitions (MRF)' },
  { value: 'jo', label: 'Job Orders' },
  { value: 'rfim', label: 'Inspections (RFIM)' },
  { value: 'osd', label: 'OSD Reports' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'shipments', label: 'Shipments' },
  { value: 'gate_pass', label: 'Gate Passes' },
  { value: 'stock_transfer', label: 'Stock Transfers' },
  { value: 'employees', label: 'Employees' },
  { value: 'suppliers', label: 'Suppliers' },
  { value: 'projects', label: 'Projects' },
];

interface ReportDataSourceSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export const ReportDataSourceSelector: React.FC<ReportDataSourceSelectorProps> = ({ value, onChange }) => {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1.5">Data Source</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white
          focus:border-[#80D1E9]/50 focus:outline-none focus:ring-1 focus:ring-[#80D1E9]/30"
      >
        <option value="">Select entity type...</option>
        {ENTITY_TYPES.map(et => (
          <option key={et.value} value={et.value}>
            {et.label}
          </option>
        ))}
      </select>
    </div>
  );
};
