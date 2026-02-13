import React, { useState, useEffect } from 'react';
import { useSemanticCatalog, useCompatibleDimensions, useSemanticQuery } from '@/api/hooks/useSemantic';
import type { SemanticMeasure, SemanticQueryParams } from '@/api/hooks/useSemantic';
import { BarChart3, Calendar } from 'lucide-react';

interface SemanticQueryBuilderProps {
  onSave?: (config: {
    measure: string;
    dimensions: string[];
    filters: Array<{ field: string; op: string; value: unknown }>;
    dateRange?: { start: string; end: string };
  }) => void;
}

export const SemanticQueryBuilder: React.FC<SemanticQueryBuilderProps> = ({ onSave }) => {
  const [selectedMeasure, setSelectedMeasure] = useState<string>('');
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>([]);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [filters] = useState<Array<{ field: string; op: string; value: string }>>([]);

  const { data: catalogRes } = useSemanticCatalog();
  const catalog = catalogRes?.data;

  const { data: compatRes } = useCompatibleDimensions(selectedMeasure || undefined);
  const compatibleDimensions = compatRes?.data ?? [];

  const queryMutation = useSemanticQuery();

  // Auto-run query when measure changes
  useEffect(() => {
    if (!selectedMeasure) return;
    const params: SemanticQueryParams = {
      measure: selectedMeasure,
      dimensions: selectedDimensions.length > 0 ? selectedDimensions : undefined,
      filters: filters.length > 0 ? filters : undefined,
      dateRange: dateStart && dateEnd ? { start: dateStart, end: dateEnd } : undefined,
    };
    queryMutation.mutate(params);
  }, [selectedMeasure, selectedDimensions, dateStart, dateEnd, filters]);

  // Reset dimensions when measure changes
  useEffect(() => {
    setSelectedDimensions([]);
  }, [selectedMeasure]);

  function toggleDimension(key: string) {
    setSelectedDimensions(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));
  }

  function handleSave() {
    if (!selectedMeasure || !onSave) return;
    onSave({
      measure: selectedMeasure,
      dimensions: selectedDimensions,
      filters,
      dateRange: dateStart && dateEnd ? { start: dateStart, end: dateEnd } : undefined,
    });
  }

  // Find the selected measure object for display
  let selectedMeasureObj: SemanticMeasure | undefined;
  if (catalog) {
    for (const measures of Object.values(catalog)) {
      const found = measures.find(m => m.key === selectedMeasure);
      if (found) {
        selectedMeasureObj = found;
        break;
      }
    }
  }

  const result = queryMutation.data?.data;
  const resultData = result?.data;

  return (
    <div className="glass-card rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 size={20} className="text-nesma-secondary" />
        <h3 className="text-lg font-semibold text-white">Semantic Query Builder</h3>
      </div>

      {/* Step 1: Pick Measure */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1.5">1. Select Measure</label>
        <select
          value={selectedMeasure}
          onChange={e => setSelectedMeasure(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white
            focus:border-nesma-secondary/50 focus:outline-none focus:ring-1 focus:ring-nesma-secondary/30"
        >
          <option value="">Choose a measure...</option>
          {catalog &&
            Object.entries(catalog).map(([category, measures]) => (
              <optgroup key={category} label={category.charAt(0).toUpperCase() + category.slice(1)}>
                {measures.map(m => (
                  <option key={m.key} value={m.key}>
                    {m.name}
                    {m.unit ? ` (${m.unit})` : ''}
                  </option>
                ))}
              </optgroup>
            ))}
        </select>
        {selectedMeasureObj && <p className="text-xs text-gray-500 mt-1">{selectedMeasureObj.description}</p>}
      </div>

      {/* Step 2: Pick Dimensions */}
      {selectedMeasure && (
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1.5">2. Slice by Dimensions (optional)</label>
          {compatibleDimensions.length === 0 ? (
            <p className="text-sm text-gray-500">No compatible dimensions</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {compatibleDimensions.map(d => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => toggleDimension(d.key)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    selectedDimensions.includes(d.key)
                      ? 'bg-nesma-primary/30 border-nesma-secondary/50 text-white'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {d.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Filters & Date Range */}
      {selectedMeasure && (
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1.5">3. Filters (optional)</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">
                <Calendar size={12} className="inline mr-1" />
                Start Date
              </label>
              <input
                type="date"
                value={dateStart}
                onChange={e => setDateStart(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white
                  focus:border-nesma-secondary/50 focus:outline-none focus:ring-1 focus:ring-nesma-secondary/30"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">
                <Calendar size={12} className="inline mr-1" />
                End Date
              </label>
              <input
                type="date"
                value={dateEnd}
                onChange={e => setDateEnd(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white
                  focus:border-nesma-secondary/50 focus:outline-none focus:ring-1 focus:ring-nesma-secondary/30"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Preview Result */}
      {selectedMeasure && (
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1.5">4. Preview</label>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 min-h-[80px]">
            {queryMutation.isPending && (
              <div className="flex items-center gap-2 text-gray-400">
                <div className="animate-spin w-4 h-4 border-2 border-nesma-secondary/30 border-t-nesma-secondary rounded-full" />
                <span className="text-sm">Running query...</span>
              </div>
            )}

            {queryMutation.isError && (
              <p className="text-sm text-red-400">Error: {(queryMutation.error as Error)?.message || 'Query failed'}</p>
            )}

            {queryMutation.isSuccess && resultData !== undefined && (
              <>
                {typeof resultData === 'number' ? (
                  <div className="text-center py-2">
                    <div className="text-3xl font-bold text-white">{resultData.toLocaleString()}</div>
                    <div className="text-sm text-gray-400 mt-1">
                      {selectedMeasureObj?.name}
                      {selectedMeasureObj?.unit ? ` (${selectedMeasureObj.unit})` : ''}
                    </div>
                  </div>
                ) : Array.isArray(resultData) ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10">
                          {selectedDimensions.map(d => (
                            <th key={d} className="text-left text-gray-400 py-2 px-2 font-medium">
                              {compatibleDimensions.find(cd => cd.key === d)?.name || d}
                            </th>
                          ))}
                          <th className="text-right text-gray-400 py-2 px-2 font-medium">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(resultData as Array<Record<string, unknown>>).slice(0, 20).map((row, i) => (
                          <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                            {selectedDimensions.map(d => {
                              const dim = compatibleDimensions.find(cd => cd.key === d);
                              const fieldName = dim?.field || d;
                              return (
                                <td key={d} className="py-1.5 px-2 text-gray-300">
                                  {String(row[fieldName] ?? '-')}
                                </td>
                              );
                            })}
                            <td className="py-1.5 px-2 text-white text-right font-medium">
                              {typeof row.value === 'number' ? row.value.toLocaleString() : String(row.value)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(resultData as unknown[]).length > 20 && (
                      <p className="text-xs text-gray-500 mt-2">
                        Showing 20 of {(resultData as unknown[]).length} rows
                      </p>
                    )}
                  </div>
                ) : (
                  <pre className="text-sm text-gray-300 overflow-auto">{JSON.stringify(resultData, null, 2)}</pre>
                )}
              </>
            )}

            {!queryMutation.isPending && !queryMutation.isError && !queryMutation.isSuccess && (
              <p className="text-sm text-gray-500 text-center py-3">Select a measure to see results</p>
            )}
          </div>
        </div>
      )}

      {/* Save Button */}
      {onSave && selectedMeasure && (
        <div className="flex justify-end pt-2">
          <button type="button" onClick={handleSave} className="btn-primary px-5 py-2 text-sm rounded-lg">
            Use This Query
          </button>
        </div>
      )}
    </div>
  );
};
