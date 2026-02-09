import React, { useMemo, useState } from 'react';
import { useSuppliers } from '@/api/hooks/useMasterData';
import type { Supplier } from '@nit-scs-v2/shared/types';
import { Users, CheckCircle, MapPin, Star, Search } from 'lucide-react';

export const SupplierView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const supplierQuery = useSuppliers({ pageSize: 200 });
  const suppliers = (supplierQuery.data?.data ?? []) as Supplier[];

  const filteredSuppliers = useMemo(
    () =>
      suppliers.filter(
        s =>
          searchTerm === '' ||
          s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (s.city ?? '').toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [searchTerm, suppliers],
  );

  const suppliersByCity = useMemo(() => {
    const byCityMap: Record<string, number> = {};
    suppliers.forEach(s => {
      const city = s.city ?? '';
      byCityMap[city] = (byCityMap[city] || 0) + 1;
    });
    return byCityMap;
  }, [suppliers]);

  if (supplierQuery.isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-10 bg-white/5 rounded w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: suppliers.length, icon: Users, cls: 'bg-blue-500/20 text-blue-400' },
          {
            label: 'Active',
            value: suppliers.filter(s => s.status === 'Active').length,
            icon: CheckCircle,
            cls: 'bg-emerald-500/20 text-emerald-400',
          },
          {
            label: 'Cities',
            value: Object.keys(suppliersByCity).length,
            icon: MapPin,
            cls: 'bg-nesma-secondary/20 text-nesma-secondary',
          },
          {
            label: 'Local',
            value: suppliers.filter(s => s.type === 'LOCAL SUPPLIER').length,
            icon: Star,
            cls: 'bg-amber-500/20 text-amber-400',
          },
        ].map(s => (
          <div key={s.label} className="glass-card p-5 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-lg ${s.cls}`}>
                <s.icon size={18} />
              </div>
              <span className="text-xs text-gray-400">{s.label}</span>
            </div>
            <p className="text-2xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search suppliers..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-black/30 border border-white/10 rounded-lg text-white text-sm focus:border-nesma-secondary outline-none"
        />
      </div>

      {/* Suppliers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSuppliers.map(supplier => (
          <div
            key={supplier.id as string}
            className="glass-card p-5 rounded-xl hover:bg-white/10 transition-all group border border-white/5 hover:border-nesma-secondary/20"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-nesma-primary/30 flex items-center justify-center text-sm text-nesma-secondary font-bold border border-nesma-primary/20">
                  {(supplier.name as string)
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .slice(0, 2)}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-200 group-hover:text-white transition-colors leading-tight">
                    {supplier.name as string}
                  </h4>
                  <span className="text-xs text-gray-500 font-mono">{supplier.id as string}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-3 border-t border-white/5">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <MapPin size={14} className="text-gray-500" />
                <span>{supplier.city as string}</span>
              </div>
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
                    supplier.status === 'Active'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                  }`}
                >
                  {supplier.status === 'Active' ? 'Active' : (supplier.status as string)}
                </span>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                  {(supplier.type as string).replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredSuppliers.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Users size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No suppliers found</p>
        </div>
      )}

      {/* Distribution by City */}
      <div className="glass-card p-6 rounded-2xl">
        <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-3">
          <span className="w-1 h-5 bg-nesma-secondary rounded-full" />
          By City
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(suppliersByCity)
            .sort((a, b) => b[1] - a[1])
            .map(([city, count]) => (
              <div key={city} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <span className="text-sm text-gray-300 flex items-center gap-2">
                  <MapPin size={12} className="text-nesma-secondary" /> {city}
                </span>
                <span className="text-sm text-white font-bold">{count}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
