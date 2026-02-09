import React, { useState, useCallback } from 'react';
import { FileBarChart, Save, Play, Plus, Trash2, ChevronDown } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  type PieLabelRenderProps,
} from 'recharts';
import {
  useSavedReports,
  useSavedReport,
  useCreateReport,
  useUpdateReport,
  useDeleteReport,
  useRunReport,
} from '@/api/hooks/useSavedReports';
import type { ReportFilter, ReportResult } from '@/api/hooks/useSavedReports';
import { ReportDataSourceSelector } from '@/components/report-builder/ReportDataSourceSelector';
import { ColumnSelector } from '@/components/report-builder/ColumnSelector';
import { FilterBuilder } from '@/components/report-builder/FilterBuilder';
import { VisualizationSelector } from '@/components/report-builder/VisualizationSelector';

const CHART_COLORS = ['#80D1E9', '#2E3A8C', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export const ReportBuilderPage: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  // Local form state
  const [dataSource, setDataSource] = useState('');
  const [columns, setColumns] = useState<string[]>([]);
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [visualization, setVisualization] = useState<'table' | 'bar' | 'line' | 'pie'>('table');
  const [reportResult, setReportResult] = useState<ReportResult | null>(null);

  const { data: reports } = useSavedReports();
  const { data: report } = useSavedReport(selectedId);
  const createReport = useCreateReport();
  const updateReport = useUpdateReport();
  const deleteReport = useDeleteReport();
  const runReport = useRunReport();

  const list = reports?.data ?? [];
  const currentReport = report?.data;

  // Load report into form when selected
  React.useEffect(() => {
    if (currentReport) {
      setDataSource(currentReport.dataSource);
      setColumns(currentReport.columns);
      setFilters(currentReport.filters);
      setVisualization(currentReport.visualization);
      setReportResult(null);
    }
  }, [currentReport]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    const result = await createReport.mutateAsync({
      name: newName.trim(),
      dataSource,
      columns,
      filters,
      visualization,
    });
    setSelectedId(result.data?.id);
    setNewName('');
    setShowCreate(false);
  }, [newName, dataSource, columns, filters, visualization, createReport]);

  const handleSave = useCallback(async () => {
    if (!selectedId) return;
    await updateReport.mutateAsync({
      id: selectedId,
      dataSource,
      columns,
      filters,
      visualization,
    });
  }, [selectedId, dataSource, columns, filters, visualization, updateReport]);

  const handleRun = useCallback(async () => {
    if (!selectedId) return;
    // Save first, then run
    await handleSave();
    const result = await runReport.mutateAsync(selectedId);
    setReportResult(result.data ?? null);
  }, [selectedId, handleSave, runReport]);

  const handleDelete = useCallback(async () => {
    if (!selectedId) return;
    await deleteReport.mutateAsync(selectedId);
    setSelectedId(undefined);
    setDataSource('');
    setColumns([]);
    setFilters([]);
    setVisualization('table');
    setReportResult(null);
  }, [selectedId, deleteReport]);

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: '#0d2137',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '8px',
      color: '#fff',
      fontSize: '12px',
    },
  };

  // Render visualization preview
  function renderPreview() {
    if (!reportResult) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <FileBarChart size={48} className="mx-auto mb-3 opacity-30" />
            <p>Configure and run your report to see results</p>
          </div>
        </div>
      );
    }

    const rows = reportResult.rows;

    if (visualization === 'table') {
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                {reportResult.columns.map(col => (
                  <th key={col} className="text-left px-3 py-2 text-gray-400 font-medium text-xs uppercase">
                    {col.replace(/_/g, ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-b border-white/5 hover:bg-white/5">
                  {reportResult.columns.map(col => (
                    <td key={col} className="px-3 py-2 text-gray-300 whitespace-nowrap">
                      {String(row[col] ?? '-')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-xs text-gray-500 mt-3 px-3">{reportResult.totalCount} total results</div>
        </div>
      );
    }

    // Chart visualizations
    const chartData = rows.slice(0, 20);
    const labelKey = reportResult.columns[0] || 'name';
    const valueKey = reportResult.columns[1] || 'value';

    if (visualization === 'pie') {
      return (
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey={valueKey}
              nameKey={labelKey}
              cx="50%"
              cy="50%"
              outerRadius="80%"
              strokeWidth={0}
              label={(props: PieLabelRenderProps) =>
                `${props.name ?? ''} ${(((props.percent as number) ?? 0) * 100).toFixed(0)}%`
              }
              fontSize={11}
            >
              {chartData.map((_, index) => (
                <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (visualization === 'line') {
      return (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey={labelKey} tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} />
            <Tooltip {...tooltipStyle} />
            <Line type="monotone" dataKey={valueKey} stroke="#80D1E9" strokeWidth={2} dot={{ fill: '#80D1E9', r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    // Bar chart (default)
    return (
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey={labelKey} tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} />
          <Tooltip {...tooltipStyle} />
          <Bar dataKey={valueKey} fill="#2E3A8C" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-4">
          <div className="p-2 rounded-xl bg-[#2E3A8C]/30 text-[#80D1E9]">
            <FileBarChart size={20} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Report Builder</h1>
            <p className="text-xs text-gray-500">Create custom reports with filters and visualizations</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Report selector */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg
                text-sm text-gray-300 hover:text-white hover:border-white/20 transition-colors"
            >
              {currentReport?.name || 'Select Report'}
              <ChevronDown size={14} />
            </button>
            {showDropdown && (
              <div className="absolute right-0 mt-1 w-64 bg-[#0d2137] border border-white/10 rounded-xl shadow-2xl z-50 py-1">
                {list.map(r => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSelectedId(r.id);
                      setShowDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-white/5 transition-colors
                      ${r.id === selectedId ? 'text-[#80D1E9]' : 'text-gray-300'}`}
                  >
                    {r.name}
                  </button>
                ))}
                <div className="border-t border-white/10 mt-1 pt-1">
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      setShowCreate(true);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#80D1E9] hover:bg-white/5"
                  >
                    <Plus size={14} /> New Report
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Save */}
          {selectedId && (
            <button
              onClick={handleSave}
              disabled={updateReport.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10
                text-sm text-gray-300 hover:text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <Save size={14} />
              {updateReport.isPending ? 'Saving...' : 'Save'}
            </button>
          )}

          {/* Run */}
          {selectedId && (
            <button
              onClick={handleRun}
              disabled={runReport.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-[#2E3A8C] hover:bg-[#2E3A8C]/80
                text-white text-sm rounded-lg transition-colors disabled:opacity-50"
            >
              <Play size={14} />
              {runReport.isPending ? 'Running...' : 'Run Report'}
            </button>
          )}

          {/* Delete */}
          {selectedId && (
            <button
              onClick={handleDelete}
              disabled={deleteReport.isPending}
              className="p-2 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
              title="Delete report"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0d2137] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">New Report</h2>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Report name..."
              autoFocus
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white
                placeholder:text-gray-600 focus:border-[#80D1E9]/50 focus:outline-none mb-4"
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || createReport.isPending}
                className="px-5 py-2 text-sm bg-[#2E3A8C] hover:bg-[#2E3A8C]/80 text-white
                  rounded-lg disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex">
        {/* Left panel — config */}
        <div className="w-80 flex-shrink-0 border-r border-white/10 p-5 space-y-6 overflow-y-auto max-h-[calc(100vh-80px)]">
          <ReportDataSourceSelector value={dataSource} onChange={setDataSource} />
          <ColumnSelector dataSource={dataSource} selected={columns} onChange={setColumns} />
          <FilterBuilder columns={columns} filters={filters} onChange={setFilters} />
          <VisualizationSelector value={visualization} onChange={setVisualization} />
        </div>

        {/* Right panel — preview */}
        <div className="flex-1 p-6 min-h-[calc(100vh-80px)]">
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 h-full">
            {renderPreview()}
          </div>
        </div>
      </div>
    </div>
  );
};
