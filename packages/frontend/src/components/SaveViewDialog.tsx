import React, { useState, useEffect } from 'react';
import { useSaveView, useUpdateView } from '@/api/hooks/useUserViews';
import type { UserView, UserViewConfig } from '@/api/hooks/useUserViews';
import { Save, X } from 'lucide-react';

interface SaveViewDialogProps {
  open: boolean;
  onClose: () => void;
  entityType: string;
  config: UserViewConfig;
  existingView?: UserView | null;
}

export const SaveViewDialog: React.FC<SaveViewDialogProps> = ({ open, onClose, entityType, config, existingView }) => {
  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const saveView = useSaveView();
  const updateView = useUpdateView();

  const isUpdating = !!existingView;
  const isPending = saveView.isPending || updateView.isPending;

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName(existingView?.name ?? '');
      setIsDefault(existingView?.isDefault ?? false);
    }
  }, [open, existingView]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isPending) return;

    if (isUpdating && existingView) {
      updateView.mutate(
        { id: existingView.id, entityType, name: name.trim(), config, isDefault },
        { onSuccess: () => onClose() },
      );
    } else {
      saveView.mutate({ entityType, name: name.trim(), config, isDefault }, { onSuccess: () => onClose() });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
      <form onSubmit={handleSubmit} className="glass-panel rounded-2xl p-6 w-full max-w-md border border-white/10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">{isUpdating ? 'Update View' : 'Save View'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close dialog"
          >
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">View Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={100}
              placeholder="e.g. My Active GRNs"
              className="input-field w-full"
              autoFocus
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={e => setIsDefault(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-white/5 text-nesma-primary focus:ring-nesma-primary/50"
            />
            <span className="text-sm text-gray-300">Set as default view</span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || isPending}
            className="btn-primary px-4 py-2 rounded-lg text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={16} />
            {isPending ? 'Saving...' : isUpdating ? 'Update' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
};
