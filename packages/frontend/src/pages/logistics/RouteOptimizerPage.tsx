import React, { useState, useMemo } from 'react';
import {
  MapPin,
  Route,
  Fuel,
  Clock,
  Truck,
  Loader2,
  ChevronRight,
  Navigation,
  CircleDot,
  Flag,
  DollarSign,
} from 'lucide-react';
import { useWarehouses } from '@/api/hooks/useMasterData';
import { useUndeliveredJOs, useOptimizeRoute, useEstimateFuel } from '@/api/hooks/useRouteOptimizer';
import type { OptimizedRoute, UndeliveredJO } from '@/api/hooks/useRouteOptimizer';

// ── Component ───────────────────────────────────────────────────────────

export const RouteOptimizerPage: React.FC = () => {
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selectedJoIds, setSelectedJoIds] = useState<Set<string>>(new Set());
  const [fuelPrice, setFuelPrice] = useState<number>(2.18); // SAR default
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRoute | null>(null);
  const [fuelCost, setFuelCost] = useState<number | null>(null);

  // Queries
  const { data: warehousesRes } = useWarehouses();
  const warehouses =
    (warehousesRes as unknown as { data?: Array<{ id: string; warehouseName: string; warehouseCode: string }> })
      ?.data ?? [];

  const { data: josRes, isLoading: josLoading } = useUndeliveredJOs(selectedWarehouse || undefined);
  const undeliveredJOs: UndeliveredJO[] = (josRes as unknown as { data?: UndeliveredJO[] })?.data ?? [];

  // Only show JOs that have coordinates
  const availableJOs = useMemo(
    () => undeliveredJOs.filter(jo => jo.latitude !== null && jo.longitude !== null),
    [undeliveredJOs],
  );
  const noLocationJOs = useMemo(
    () => undeliveredJOs.filter(jo => jo.latitude === null || jo.longitude === null),
    [undeliveredJOs],
  );

  // Mutations
  const optimizeMutation = useOptimizeRoute();
  const fuelMutation = useEstimateFuel();

  function toggleJo(id: string) {
    setSelectedJoIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedJoIds.size === availableJOs.length) {
      setSelectedJoIds(new Set());
    } else {
      setSelectedJoIds(new Set(availableJOs.map(jo => jo.id)));
    }
  }

  function handleOptimize() {
    if (!selectedWarehouse || selectedJoIds.size === 0) return;
    setOptimizedRoute(null);
    setFuelCost(null);
    optimizeMutation.mutate(
      { warehouseId: selectedWarehouse, joIds: Array.from(selectedJoIds) },
      {
        onSuccess: res => {
          const route = (res as unknown as { data?: OptimizedRoute })?.data ?? null;
          setOptimizedRoute(route);
          // Automatically calculate fuel cost
          if (route && fuelPrice > 0) {
            fuelMutation.mutate(
              { distanceKm: route.totalDistanceKm, fuelPrice },
              {
                onSuccess: fuelRes => {
                  const estimate = (fuelRes as unknown as { data?: { totalCost: number } })?.data;
                  setFuelCost(estimate?.totalCost ?? null);
                },
              },
            );
          }
        },
      },
    );
  }

  function handleRecalcFuel() {
    if (!optimizedRoute || fuelPrice <= 0) return;
    fuelMutation.mutate(
      { distanceKm: optimizedRoute.totalDistanceKm, fuelPrice },
      {
        onSuccess: fuelRes => {
          const estimate = (fuelRes as unknown as { data?: { totalCost: number } })?.data;
          setFuelCost(estimate?.totalCost ?? null);
        },
      },
    );
  }

  function handleWarehouseChange(id: string) {
    setSelectedWarehouse(id);
    setSelectedJoIds(new Set());
    setOptimizedRoute(null);
    setFuelCost(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-nesma-primary/20 flex items-center justify-center">
            <Route className="w-5 h-5 text-nesma-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Route Optimizer</h1>
            <p className="text-sm text-gray-400">Optimize delivery routes for Job Order transport</p>
          </div>
        </div>
      </div>

      {/* Warehouse Selector */}
      <div className="glass-card rounded-2xl p-5 border border-white/10">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <label className="text-sm text-gray-400 whitespace-nowrap flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Origin Warehouse:
          </label>
          <select
            value={selectedWarehouse}
            onChange={e => handleWarehouseChange(e.target.value)}
            className="input-field w-full sm:w-80"
          >
            <option value="">Select warehouse...</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>
                {w.warehouseCode} - {w.warehouseName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* JO Selection */}
      {selectedWarehouse && (
        <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-5 py-4 bg-white/5 border-b border-white/10 flex items-center justify-between">
            <h3 className="font-bold text-sm text-white flex items-center gap-3">
              <span className="w-1 h-5 bg-nesma-secondary rounded-full" />
              Pending Transport JOs
              {availableJOs.length > 0 && (
                <span className="text-xs text-gray-500 font-normal ml-1">
                  ({selectedJoIds.size} of {availableJOs.length} selected)
                </span>
              )}
            </h3>
            <div className="flex items-center gap-3">
              {availableJOs.length > 0 && (
                <button
                  onClick={toggleAll}
                  className="text-xs text-nesma-primary hover:text-nesma-accent transition-colors"
                >
                  {selectedJoIds.size === availableJOs.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
              <button
                onClick={handleOptimize}
                disabled={selectedJoIds.size === 0 || optimizeMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-nesma-primary text-white rounded-xl hover:bg-nesma-accent transition-all text-sm font-medium shadow-lg shadow-nesma-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {optimizeMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Navigation className="w-4 h-4" />
                )}
                Optimize Route
              </button>
            </div>
          </div>

          {josLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
            </div>
          ) : availableJOs.length === 0 ? (
            <div className="text-center py-16 text-gray-500 text-sm">
              <Truck className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              No pending transport JOs with project locations for this warehouse.
            </div>
          ) : (
            <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
              {availableJOs.map(jo => (
                <label
                  key={jo.id}
                  className={`flex items-center gap-4 px-5 py-3 cursor-pointer transition-all ${
                    selectedJoIds.has(jo.id) ? 'bg-nesma-primary/10' : 'hover:bg-white/5'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedJoIds.has(jo.id)}
                    onChange={() => toggleJo(jo.id)}
                    className="rounded border-white/20 bg-white/10 text-nesma-primary focus:ring-nesma-primary/50"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{jo.joNumber}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                          jo.status === 'approved'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        }`}
                      >
                        {jo.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">
                      {jo.projectCode} - {jo.projectName}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {jo.latitude?.toFixed(4)}, {jo.longitude?.toFixed(4)}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}

          {noLocationJOs.length > 0 && (
            <div className="px-5 py-3 bg-amber-500/5 border-t border-amber-500/20">
              <p className="text-xs text-amber-400">
                {noLocationJOs.length} JO(s) excluded (no project coordinates):{' '}
                {noLocationJOs.map(jo => jo.joNumber).join(', ')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error display */}
      {optimizeMutation.isError && (
        <div className="glass-card rounded-2xl p-5 border border-red-500/30 bg-red-500/5">
          <p className="text-sm text-red-400">
            {(optimizeMutation.error as Error)?.message || 'Failed to optimize route'}
          </p>
        </div>
      )}

      {/* Optimized Route Results */}
      {optimizedRoute && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-card rounded-2xl p-5 border border-white/10">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                  <Route size={18} />
                </div>
                <span className="text-xs text-gray-400">Total Distance</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {optimizedRoute.totalDistanceKm}
                <span className="text-sm font-normal text-gray-400 ml-1">km</span>
              </p>
            </div>
            <div className="glass-card rounded-2xl p-5 border border-white/10">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                  <Clock size={18} />
                </div>
                <span className="text-xs text-gray-400">Est. Duration</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {optimizedRoute.estimatedDurationMinutes}
                <span className="text-sm font-normal text-gray-400 ml-1">min</span>
              </p>
            </div>
            <div className="glass-card rounded-2xl p-5 border border-white/10">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Fuel size={18} />
                </div>
                <span className="text-xs text-gray-400">Fuel Consumption</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {optimizedRoute.estimatedFuelLiters}
                <span className="text-sm font-normal text-gray-400 ml-1">L</span>
              </p>
            </div>
            <div className="glass-card rounded-2xl p-5 border border-white/10">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                  <DollarSign size={18} />
                </div>
                <span className="text-xs text-gray-400">Fuel Cost</span>
              </div>
              <div className="flex items-end gap-2">
                <p className="text-2xl font-bold text-white">
                  {fuelCost !== null ? fuelCost.toFixed(2) : '--'}
                  <span className="text-sm font-normal text-gray-400 ml-1">SAR</span>
                </p>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={fuelPrice}
                  onChange={e => setFuelPrice(Number(e.target.value))}
                  className="input-field w-24 text-xs py-1"
                  placeholder="SAR/L"
                />
                <button
                  onClick={handleRecalcFuel}
                  disabled={fuelMutation.isPending}
                  className="text-xs text-nesma-primary hover:text-nesma-accent transition-colors"
                >
                  {fuelMutation.isPending ? 'Calculating...' : 'Recalculate'}
                </button>
              </div>
            </div>
          </div>

          {/* Visual Route Representation */}
          <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
            <div className="px-5 py-4 bg-white/5 border-b border-white/10">
              <h3 className="font-bold text-sm text-white flex items-center gap-3">
                <span className="w-1 h-5 bg-nesma-secondary rounded-full" />
                Optimized Route
                <span className="text-xs text-gray-500 font-normal ml-1">({optimizedRoute.stops.length} stops)</span>
              </h3>
            </div>

            {/* Route visualization */}
            <div className="p-5">
              <div className="relative">
                {/* Origin */}
                <div className="flex items-start gap-4 mb-0">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 ring-2 ring-emerald-500/30">
                      <Flag className="w-5 h-5" />
                    </div>
                    <div className="w-0.5 h-8 bg-gradient-to-b from-emerald-500/40 to-white/10" />
                  </div>
                  <div className="pt-2 pb-4">
                    <div className="text-sm font-medium text-emerald-400">Origin</div>
                    <div className="text-sm text-white mt-0.5">{optimizedRoute.origin.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {optimizedRoute.origin.latitude.toFixed(5)}, {optimizedRoute.origin.longitude.toFixed(5)}
                    </div>
                  </div>
                </div>

                {/* Stops */}
                {optimizedRoute.stops.map((stop, idx) => {
                  const isLast = idx === optimizedRoute.stops.length - 1;
                  return (
                    <div key={stop.id} className="flex items-start gap-4 mb-0">
                      <div className="flex flex-col items-center">
                        <div className="w-10 h-10 rounded-full bg-nesma-primary/20 text-nesma-primary flex items-center justify-center shrink-0 text-sm font-bold ring-2 ring-nesma-primary/30">
                          {stop.stopOrder}
                        </div>
                        {!isLast && <div className="w-0.5 h-8 bg-gradient-to-b from-nesma-primary/30 to-white/10" />}
                      </div>
                      <div className="pt-2 pb-4 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white truncate">{stop.name}</span>
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <ChevronRight className="w-3 h-3" />
                            {stop.distanceFromPrev} km from prev
                          </span>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Route className="w-3 h-3" />
                            {stop.cumulativeDistance} km total
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {stop.latitude.toFixed(5)}, {stop.longitude.toFixed(5)}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* End marker */}
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center shrink-0 ring-2 ring-red-500/30">
                      <CircleDot className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="pt-2">
                    <div className="text-sm font-medium text-red-400">End of Route</div>
                    <div className="text-xs text-gray-500 mt-0.5">Total: {optimizedRoute.totalDistanceKm} km</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stop Details Table */}
          <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
            <div className="px-5 py-4 bg-white/5 border-b border-white/10">
              <h3 className="font-bold text-sm text-white flex items-center gap-3">
                <span className="w-1 h-5 bg-nesma-secondary rounded-full" />
                Stop Details
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider bg-white/5">
                    <th className="py-3 px-4 font-medium w-12">#</th>
                    <th className="py-3 px-4 font-medium">JO / Project</th>
                    <th className="py-3 px-4 font-medium text-right">From Prev (km)</th>
                    <th className="py-3 px-4 font-medium text-right">Cumulative (km)</th>
                    <th className="py-3 px-4 font-medium text-right">Coordinates</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {optimizedRoute.stops.map(stop => (
                    <tr key={stop.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4">
                        <div className="w-7 h-7 rounded-full bg-nesma-primary/20 text-nesma-primary flex items-center justify-center text-xs font-bold">
                          {stop.stopOrder}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-200 font-medium">{stop.name}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-sm text-gray-300 font-mono">{stop.distanceFromPrev}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-sm text-white font-mono font-medium">{stop.cumulativeDistance}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-xs text-gray-500 font-mono">
                          {stop.latitude.toFixed(5)}, {stop.longitude.toFixed(5)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/10 bg-white/5">
                    <td colSpan={2} className="py-3 px-4 text-sm font-semibold text-white">
                      Total
                    </td>
                    <td className="py-3 px-4" />
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm text-nesma-primary font-mono font-bold">
                        {optimizedRoute.totalDistanceKm} km
                      </span>
                    </td>
                    <td className="py-3 px-4" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
