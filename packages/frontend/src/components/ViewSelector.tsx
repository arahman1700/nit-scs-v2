import React, { useState, useRef, useEffect } from 'react';
import { useUserViews, useUpdateView, useDeleteView } from '@/api/hooks/useUserViews';
import type { UserView } from '@/api/hooks/useUserViews';
import { Bookmark, ChevronDown, Check, Star, Trash2, Plus, Loader2 } from 'lucide-react';

interface ViewSelectorProps {
  entityType: string;
  activeViewId: string | null;
  onViewChange: (view: UserView | null) => void;
  onSaveRequest: () => void;
}

export const ViewSelector: React.FC<ViewSelectorProps> = ({
  entityType,
  activeViewId,
  onViewChange,
  onSaveRequest,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useUserViews(entityType);
  const updateView = useUpdateView();
  const deleteView = useDeleteView();

  const views: UserView[] = (data as unknown as { data?: UserView[] })?.data ?? [];

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSetDefault = (e: React.MouseEvent, view: UserView) => {
    e.stopPropagation();
    updateView.mutate({ id: view.id, entityType, isDefault: !view.isDefault });
  };

  const handleDelete = (e: React.MouseEvent, view: UserView) => {
    e.stopPropagation();
    deleteView.mutate({ id: view.id, entityType });
    if (activeViewId === view.id) {
      onViewChange(null);
    }
  };

  const handleSelectView = (view: UserView | null) => {
    onViewChange(view);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="glass-card rounded-lg px-3 py-1.5 text-sm flex items-center gap-2 cursor-pointer hover:bg-white/10 transition-all duration-300"
      >
        <Bookmark size={16} className="text-nesma-secondary" />
        <span className="text-gray-300">Views</span>
        {views.length > 0 && (
          <span className="bg-nesma-primary/30 text-nesma-secondary text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
            {views.length}
          </span>
        )}
        <ChevronDown
          size={14}
          className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute top-full mt-1 right-0 w-64 glass-panel rounded-xl border border-white/10 shadow-2xl shadow-black/40 z-50 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={18} className="text-nesma-secondary animate-spin" />
            </div>
          ) : (
            <>
              {/* Default View option */}
              <button
                onClick={() => handleSelectView(null)}
                className={`w-full px-3 py-2 flex items-center justify-between hover:bg-white/10 cursor-pointer transition-colors ${
                  activeViewId === null ? 'bg-white/5' : ''
                }`}
              >
                <span className="text-sm text-gray-300">Default View</span>
                {activeViewId === null && <Check size={14} className="text-nesma-accent" />}
              </button>

              {/* Saved views */}
              {views.map(view => (
                <div
                  key={view.id}
                  onClick={() => handleSelectView(view)}
                  className={`group px-3 py-2 flex items-center justify-between hover:bg-white/10 cursor-pointer transition-colors ${
                    activeViewId === view.id ? 'bg-white/5' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {activeViewId === view.id && <Check size={14} className="text-nesma-accent flex-shrink-0" />}
                    <span className="text-sm text-gray-300 truncate">{view.name}</span>
                    {view.isDefault && <Star size={12} className="text-nesma-gold flex-shrink-0 fill-nesma-gold" />}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={e => handleSetDefault(e, view)}
                      className="p-1 rounded hover:bg-white/10 transition-colors"
                      aria-label={view.isDefault ? 'Unset as default' : 'Set as default'}
                    >
                      <Star
                        size={12}
                        className={view.isDefault ? 'text-nesma-gold fill-nesma-gold' : 'text-gray-500'}
                      />
                    </button>
                    <button
                      onClick={e => handleDelete(e, view)}
                      className="p-1 rounded hover:bg-white/10 transition-colors"
                      aria-label="Delete view"
                    >
                      <Trash2 size={12} className="text-gray-500 hover:text-red-400" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Divider + Save button */}
              <div className="border-t border-white/10">
                <button
                  onClick={() => {
                    setOpen(false);
                    onSaveRequest();
                  }}
                  className="w-full px-3 py-2.5 flex items-center gap-2 hover:bg-white/10 cursor-pointer transition-colors text-nesma-secondary text-sm"
                >
                  <Plus size={14} />
                  <span>Save Current View</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
