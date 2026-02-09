import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import type { DashboardWidget } from '@/api/hooks/useDashboards';
import { WidgetWrapper } from './WidgetWrapper';

interface DashboardGridProps {
  widgets: DashboardWidget[];
  onReorder: (newOrder: DashboardWidget[]) => void;
  onUpdateWidget: (widgetId: string, updates: Partial<DashboardWidget>) => void;
  onDeleteWidget: (widgetId: string) => void;
  editMode: boolean;
}

export const DashboardGrid: React.FC<DashboardGridProps> = ({
  widgets,
  onReorder,
  onUpdateWidget,
  onDeleteWidget,
  editMode,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sorted = [...widgets].sort((a, b) => a.position - b.position);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sorted.findIndex(w => w.id === active.id);
    const newIndex = sorted.findIndex(w => w.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...sorted];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    const updated = reordered.map((w, i) => ({ ...w, position: i }));
    onReorder(updated);
  }

  if (sorted.length === 0 && !editMode) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No widgets added yet. Enter edit mode to add widgets.
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sorted.map(w => w.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 auto-rows-[minmax(200px,auto)]">
          {sorted.map(widget => (
            <WidgetWrapper
              key={widget.id}
              widget={widget}
              onUpdate={onUpdateWidget}
              onDelete={onDeleteWidget}
              editMode={editMode}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};
