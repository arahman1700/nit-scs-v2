import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { DashboardWidget } from '@/api/hooks/useDashboards';

const DATA_SOURCES = [
  { value: 'stats/pending_requests', label: 'Pending Requests' },
  { value: 'stats/active_jobs', label: 'Active Jobs' },
  { value: 'stats/incoming_shipments', label: 'Incoming Shipments' },
  { value: 'stats/low_stock_items', label: 'Low Stock Items' },
  { value: 'stats/total_inventory_value', label: 'Total Inventory Value' },
  { value: 'stats/overdue_sla', label: 'Overdue SLA' },
  { value: 'grouped/jo_by_status', label: 'Job Orders by Status' },
  { value: 'grouped/jo_by_type', label: 'Job Orders by Type' },
  { value: 'grouped/mrrv_by_status', label: 'GRN by Status' },
  { value: 'grouped/mirv_by_status', label: 'MI by Status' },
  { value: 'grouped/inventory_by_category', label: 'Inventory by Category' },
  { value: 'grouped/shipments_by_status', label: 'Shipments by Status' },
  { value: 'timeseries/receiving_trend', label: 'Receiving Trend' },
  { value: 'timeseries/issuing_trend', label: 'Issuing Trend' },
  { value: 'timeseries/jo_created_trend', label: 'JO Created Trend' },
  { value: 'table/recent_activity', label: 'Recent Activity' },
  { value: 'table/recent_mrrv', label: 'Recent GRN' },
  { value: 'table/recent_mirv', label: 'Recent MI' },
  { value: 'table/recent_jo', label: 'Recent Job Orders' },
  { value: 'table/low_stock', label: 'Low Stock Items' },
];

const CHART_TYPES = ['bar', 'line', 'pie'] as const;

interface WidgetConfigModalProps {
  widget: DashboardWidget;
  onSave: (updates: Partial<DashboardWidget>) => void;
  onClose: () => void;
}

export const WidgetConfigModal: React.FC<WidgetConfigModalProps> = ({ widget, onSave, onClose }) => {
  const [title, setTitle] = useState(widget.title);
  const [dataSource, setDataSource] = useState(widget.dataSource);
  const [displayConfig, setDisplayConfig] = useState<Record<string, unknown>>(widget.displayConfig || {});
  const [width, setWidth] = useState(widget.width);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({ title, dataSource, displayConfig, width });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0d2137] border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Configure Widget</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white
                focus:border-[#80D1E9]/50 focus:outline-none focus:ring-1 focus:ring-[#80D1E9]/30"
            />
          </div>

          {/* Data Source */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Data Source</label>
            <select
              value={dataSource}
              onChange={e => setDataSource(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white
                focus:border-[#80D1E9]/50 focus:outline-none focus:ring-1 focus:ring-[#80D1E9]/30"
            >
              <option value="">Select a data source</option>
              {DATA_SOURCES.map(ds => (
                <option key={ds.value} value={ds.value}>
                  {ds.label}
                </option>
              ))}
            </select>
          </div>

          {/* Chart type (for chart widgets) */}
          {widget.widgetType === 'chart' && (
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Chart Type</label>
              <div className="flex gap-2">
                {CHART_TYPES.map(ct => (
                  <button
                    key={ct}
                    type="button"
                    onClick={() => setDisplayConfig({ ...displayConfig, chartType: ct })}
                    className={`px-4 py-2 rounded-lg text-sm border transition-colors
                      ${
                        displayConfig.chartType === ct
                          ? 'bg-[#2E3A8C]/50 border-[#80D1E9]/50 text-white'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                      }`}
                  >
                    {ct.charAt(0).toUpperCase() + ct.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Width */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Width</label>
            <div className="flex gap-2">
              {[1, 2].map(w => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWidth(w)}
                  className={`px-4 py-2 rounded-lg text-sm border transition-colors
                    ${
                      width === w
                        ? 'bg-[#2E3A8C]/50 border-[#80D1E9]/50 text-white'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                    }`}
                >
                  {w === 1 ? 'Normal' : 'Wide'}
                </button>
              ))}
            </div>
          </div>

          {/* Color (for KPI widgets) */}
          {widget.widgetType === 'kpi' && (
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Color</label>
              <div className="flex gap-2">
                {['emerald', 'blue', 'amber', 'red', 'purple'].map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setDisplayConfig({ ...displayConfig, color })}
                    className={`w-8 h-8 rounded-lg border-2 transition-transform
                      bg-${color}-500
                      ${displayConfig.color === color ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
                    style={{
                      backgroundColor:
                        color === 'emerald'
                          ? '#10b981'
                          : color === 'blue'
                            ? '#3b82f6'
                            : color === 'amber'
                              ? '#f59e0b'
                              : color === 'red'
                                ? '#ef4444'
                                : '#8b5cf6',
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm bg-[#2E3A8C] hover:bg-[#2E3A8C]/80 text-white
                rounded-lg transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
