import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDynamicTypeList, useDeleteDynamicType } from '@/api/hooks/useDynamicDocumentTypes';
import type { DynamicDocumentType } from '@/api/hooks/useDynamicDocumentTypes';
import { Plus, Search, FileType2, ToggleLeft, ToggleRight } from 'lucide-react';

export const DynamicTypeListPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useDynamicTypeList({ search: search || undefined });
  const types = ((data as { data?: DynamicDocumentType[] })?.data ?? []) as DynamicDocumentType[];
  const _deleteMut = useDeleteDynamicType();

  const grouped = types.reduce<Record<string, DynamicDocumentType[]>>((acc, type) => {
    const cat = type.category || 'custom';
    (acc[cat] = acc[cat] || []).push(type);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Document Type Builder</h1>
          <p className="text-sm text-gray-400 mt-1">Create and manage custom document types</p>
        </div>
        <button onClick={() => navigate('/admin/dynamic-types/new')} className="btn-primary flex items-center gap-2">
          <Plus size={20} />
          New Document Type
        </button>
      </div>

      {/* Search */}
      <div className="glass-card rounded-2xl p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search document types..."
            className="input-field w-full pl-9"
          />
        </div>
      </div>

      {/* Types Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card rounded-2xl p-6 animate-pulse">
              <div className="h-6 bg-white/10 rounded w-1/2 mb-4" />
              <div className="h-4 bg-white/5 rounded w-3/4 mb-2" />
              <div className="h-4 bg-white/5 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        Object.entries(grouped).map(([category, categoryTypes]) => (
          <div key={category}>
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3">{category}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryTypes.map(type => (
                <div
                  key={type.id}
                  className="glass-card rounded-2xl p-6 hover:bg-white/10 transition-all duration-300 cursor-pointer group"
                  onClick={() => navigate(`/admin/dynamic-types/${type.id}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-nesma-primary/20 flex items-center justify-center">
                        <FileType2 size={20} className="text-nesma-secondary" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold">{type.name}</h3>
                        <p className="text-xs text-gray-500 font-mono">{type.code}</p>
                      </div>
                    </div>
                    {type.isActive ? (
                      <ToggleRight size={20} className="text-emerald-400" />
                    ) : (
                      <ToggleLeft size={20} className="text-gray-500" />
                    )}
                  </div>
                  {type.description && <p className="text-sm text-gray-400 mb-3 line-clamp-2">{type.description}</p>}
                  <div className="flex items-center justify-between text-xs text-gray-500 mt-4 pt-3 border-t border-white/5">
                    <span>{type._count?.fields ?? 0} fields</span>
                    <span>{type._count?.documents ?? 0} documents</span>
                    <span>v{type.version}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {!isLoading && types.length === 0 && (
        <div className="glass-card rounded-2xl p-12 text-center">
          <FileType2 size={48} className="mx-auto text-gray-600 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Document Types Yet</h3>
          <p className="text-sm text-gray-400 mb-6">Create your first custom document type to get started</p>
          <button onClick={() => navigate('/admin/dynamic-types/new')} className="btn-primary">
            Create Document Type
          </button>
        </div>
      )}
    </div>
  );
};
