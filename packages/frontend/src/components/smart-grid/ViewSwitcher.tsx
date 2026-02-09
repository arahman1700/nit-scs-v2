import React from 'react';
import { LayoutGrid, List, Columns3 } from 'lucide-react';

export type ViewMode = 'grid' | 'card' | 'list';

interface ViewSwitcherProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  availableModes?: ViewMode[];
}

const VIEWS: { mode: ViewMode; icon: React.FC<{ size: number }>; label: string }[] = [
  { mode: 'grid', icon: Columns3, label: 'Grid' },
  { mode: 'list', icon: List, label: 'List' },
  { mode: 'card', icon: LayoutGrid, label: 'Cards' },
];

export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({ mode, onChange, availableModes = ['grid', 'card'] }) => {
  const views = VIEWS.filter(v => availableModes.includes(v.mode));

  return (
    <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
      {views.map(({ mode: viewMode, icon: Icon, label }) => (
        <button
          key={viewMode}
          type="button"
          onClick={() => onChange(viewMode)}
          className={`p-1.5 rounded-md transition-all ${
            mode === viewMode
              ? 'bg-nesma-secondary/20 text-nesma-secondary'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
          title={label}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  );
};
