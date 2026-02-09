import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Settings, X } from 'lucide-react';
import type { DashboardWidget } from '@/api/hooks/useDashboards';
import { KpiWidget } from './KpiWidget';
import { ChartWidget } from './ChartWidget';
import { TableWidget } from './TableWidget';
import { ListWidget } from './ListWidget';
import { ActivityWidget } from './ActivityWidget';
import { StatusCountWidget } from './StatusCountWidget';
import { WidgetConfigModal } from './WidgetConfigModal';

interface WidgetWrapperProps {
  widget: DashboardWidget;
  onUpdate: (widgetId: string, updates: Partial<DashboardWidget>) => void;
  onDelete: (widgetId: string) => void;
  editMode: boolean;
}

const WIDGET_RENDERERS: Record<string, React.FC<{ widget: DashboardWidget }>> = {
  kpi: KpiWidget,
  chart: ChartWidget,
  table: TableWidget,
  list: ListWidget,
  activity: ActivityWidget,
  status_counts: StatusCountWidget,
};

export const WidgetWrapper: React.FC<WidgetWrapperProps> = ({ widget, onUpdate, onDelete, editMode }) => {
  const [configOpen, setConfigOpen] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
    disabled: !editMode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Renderer = WIDGET_RENDERERS[widget.widgetType];

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden flex flex-col
          ${isDragging ? 'ring-2 ring-[#80D1E9]/50 z-50' : ''}
          ${widget.width === 2 ? 'col-span-2' : ''}
        `}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2 min-w-0">
            {editMode && (
              <button
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300 flex-shrink-0"
              >
                <GripVertical size={16} />
              </button>
            )}
            <h3 className="text-sm font-medium text-gray-200 truncate">{widget.title}</h3>
          </div>
          {editMode && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => setConfigOpen(true)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                <Settings size={14} />
              </button>
              <button
                onClick={() => onDelete(widget.id)}
                className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Widget content */}
        <div className="flex-1 p-4">
          {Renderer ? (
            <Renderer widget={widget} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              Unknown widget type: {widget.widgetType}
            </div>
          )}
        </div>
      </div>

      {configOpen && (
        <WidgetConfigModal
          widget={widget}
          onSave={updates => {
            onUpdate(widget.id, updates);
            setConfigOpen(false);
          }}
          onClose={() => setConfigOpen(false)}
        />
      )}
    </>
  );
};
