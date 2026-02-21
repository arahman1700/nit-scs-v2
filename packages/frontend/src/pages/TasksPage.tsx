import React, { useState, useCallback, useMemo } from 'react';
import { DndContext, DragOverlay, useDraggable, useDroppable, closestCenter } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useTaskList, useCreateTask, useChangeTaskStatus } from '@/api/hooks/useTasks';
import { useEmployees } from '@/api/hooks/useMasterData';
import { toast } from '@/components/Toaster';
import {
  Plus,
  Search,
  List,
  LayoutGrid,
  X,
  Calendar,
  User,
  GripVertical,
  Circle,
  Loader2,
  ClipboardList,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  dueDate: string;
  assigneeId: string;
  assignee?: { fullName: string };
  creatorId: string;
  createdAt: string;
}

type ViewMode = 'list' | 'kanban';

const STATUSES = ['open', 'in_progress', 'completed', 'cancelled'] as const;
const PRIORITIES = ['high', 'medium', 'low'] as const;

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  open: { label: 'Open', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  in_progress: { label: 'In Progress', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  completed: { label: 'Completed', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  cancelled: { label: 'Cancelled', bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
};

const PRIORITY_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  high: { label: 'High', bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-500' },
  medium: { label: 'Medium', bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-500' },
  low: { label: 'Low', bg: 'bg-gray-500/10', text: 'text-gray-400', dot: 'bg-gray-500' },
};

// ── Draggable Task Card (Kanban) ──────────────────────────────────────────────

const TaskCard: React.FC<{ task: Task; isDragOverlay?: boolean }> = ({ task, isDragOverlay = false }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : 1,
    touchAction: 'none',
  };

  const pCfg = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.low;

  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      style={isDragOverlay ? undefined : style}
      {...(isDragOverlay ? {} : { ...listeners, ...attributes })}
      className={`bg-white/10 p-4 rounded-xl border border-white/5 cursor-grab active:cursor-grabbing hover:bg-white/10 hover:border-white/10 transition-all group shadow-lg ${isDragOverlay ? 'ring-2 ring-nesma-secondary shadow-2xl scale-105' : ''}`}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold text-gray-100 text-sm leading-snug line-clamp-2 group-hover:text-nesma-secondary transition-colors flex-1">
          {task.title}
        </h4>
        <GripVertical size={14} className="text-gray-600 flex-shrink-0 ml-2 mt-0.5" />
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2 h-2 rounded-full ${pCfg.dot}`} />
        <span className={`text-[10px] ${pCfg.text}`}>{pCfg.label}</span>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        {task.assignee ? (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <User size={10} className="text-nesma-secondary" />
            <span className="truncate max-w-[120px]">{task.assignee.fullName}</span>
          </div>
        ) : (
          <span className="text-[10px] text-gray-600">Unassigned</span>
        )}

        {task.dueDate && (
          <div className="flex items-center gap-1 text-[10px] text-gray-500">
            <Calendar size={10} />
            <span>{new Date(task.dueDate).toLocaleDateString()}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Droppable Kanban Column ───────────────────────────────────────────────────

const KanbanColumn: React.FC<{
  status: string;
  tasks: Task[];
}> = ({ status, tasks }) => {
  const { isOver, setNodeRef } = useDroppable({ id: status });
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.open;

  return (
    <div
      ref={setNodeRef}
      className={`min-w-[280px] flex-1 glass-card rounded-2xl flex flex-col h-[calc(100vh-260px)] bg-black/20 border transition-colors ${isOver ? 'border-nesma-secondary/60 bg-nesma-secondary/5' : 'border-white/5'}`}
    >
      {/* Column Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between sticky top-0 bg-nesma-dark/80 backdrop-blur-sm z-10 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <Circle size={10} className={cfg.text} fill="currentColor" />
          <h3 className="font-bold text-white text-sm uppercase tracking-wide">{cfg.label}</h3>
        </div>
        <span className="bg-white/10 text-gray-300 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold">
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {tasks.map(task => (
          <TaskCard key={task.id} task={task} />
        ))}

        {tasks.length === 0 && (
          <div
            className={`h-full flex flex-col items-center justify-center border-2 border-dashed rounded-xl min-h-[120px] transition-colors ${isOver ? 'border-nesma-secondary/40 text-nesma-secondary' : 'border-white/5 text-gray-600'}`}
          >
            <span className="text-xs opacity-50 font-medium">Drop tasks here</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Create Task Modal ─────────────────────────────────────────────────────────

const CreateTaskModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState('');

  const createTask = useCreateTask();
  const employeesQuery = useEmployees({ pageSize: 200 });
  const employees = (employeesQuery.data?.data ?? []) as { id: string; name: string }[];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.warning('Validation', 'Title is required');
      return;
    }

    createTask.mutate(
      {
        title: title.trim(),
        description: description.trim(),
        priority,
        dueDate: dueDate || undefined,
        assigneeId: assigneeId || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Task created', 'New task has been added');
          resetForm();
          onClose();
        },
        onError: err => {
          const msg = err instanceof Error ? err.message : 'Failed to create task';
          toast.error('Create failed', msg);
        },
      },
    );
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setDueDate('');
    setAssigneeId('');
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="glass-card rounded-2xl p-6 border border-white/10 max-w-lg w-full animate-fade-in shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-white">Create New Task</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">
              <X size={18} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Title *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Enter task title..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-nesma-secondary/50"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe the task..."
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-nesma-secondary/50 resize-none"
              />
            </div>

            {/* Priority + Due Date row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Priority</label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value as 'high' | 'medium' | 'low')}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-nesma-secondary/50"
                >
                  {PRIORITIES.map(p => (
                    <option key={p} value={p} className="bg-nesma-dark">
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-nesma-secondary/50"
                />
              </div>
            </div>

            {/* Assignee */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Assignee</label>
              <select
                value={assigneeId}
                onChange={e => setAssigneeId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-nesma-secondary/50"
              >
                <option value="" className="bg-nesma-dark">
                  Unassigned
                </option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id} className="bg-nesma-dark">
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-5 py-2.5 text-sm font-medium text-gray-300 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createTask.isPending}
                className="flex-1 bg-nesma-primary text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-nesma-primary/80 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createTask.isPending && <Loader2 size={14} className="animate-spin" />}
                Create Task
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

export const TasksPage: React.FC = () => {
  const [view, setView] = useState<ViewMode>(() => {
    return (localStorage.getItem('nit_tasks_view') as ViewMode) || 'list';
  });
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const tasksQuery = useTaskList();
  const changeStatus = useChangeTaskStatus();

  const allTasks = (tasksQuery.data?.data ?? []) as Task[];

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return allTasks.filter(t => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchAssignee = t.assignee?.fullName?.toLowerCase().includes(q);
        if (!matchTitle && !matchAssignee) return false;
      }
      return true;
    });
  }, [allTasks, statusFilter, priorityFilter, searchText]);

  // Tasks grouped by status for kanban
  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, Task[]> = {
      open: [],
      in_progress: [],
      completed: [],
      cancelled: [],
    };
    filteredTasks.forEach(t => {
      if (grouped[t.status]) {
        grouped[t.status].push(t);
      } else {
        grouped.open.push(t);
      }
    });
    return grouped;
  }, [filteredTasks]);

  const toggleView = (mode: ViewMode) => {
    setView(mode);
    localStorage.setItem('nit_tasks_view', mode);
  };

  // ── Kanban drag-end handler ──────────────────────────────────────────────

  const handleDragStart = useCallback(
    (event: { active: { id: string | number; data: { current?: { task?: Task } } } }) => {
      const task = event.active.data.current?.task ?? null;
      setActiveTask(task ?? null);
    },
    [],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveTask(null);

      if (!over) return;

      const taskId = active.id as string;
      const targetStatus = over.id as string;
      const task = allTasks.find(t => t.id === taskId);

      if (!task || task.status === targetStatus) return;

      changeStatus.mutate(
        { id: taskId, status: targetStatus },
        {
          onSuccess: () => {
            toast.success('Status updated', `Task moved to ${STATUS_CONFIG[targetStatus]?.label ?? targetStatus}`);
          },
          onError: err => {
            const msg = err instanceof Error ? err.message : 'Failed to update status';
            toast.error('Update failed', msg);
          },
        },
      );
    },
    [allTasks, changeStatus],
  );

  // ── Loading state ───────────────────────────────────────────────────────

  if (tasksQuery.isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="glass-card rounded-2xl p-6 border border-white/10 animate-pulse">
          <div className="h-8 w-48 bg-white/10 rounded mb-2" />
          <div className="h-4 w-64 bg-white/5 rounded" />
        </div>
        <div className="glass-card rounded-2xl p-6 border border-white/10 animate-pulse">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 bg-white/5 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (tasksQuery.isError) {
    return (
      <div className="glass-card rounded-2xl p-6 border border-red-500/20 bg-red-500/5 animate-fade-in">
        <p className="text-red-400 text-sm">Failed to load tasks. Please try again.</p>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white glow-text">Task Management</h1>
          <p className="text-sm text-gray-400 mt-1">
            {allTasks.length} total tasks &middot; {allTasks.filter(t => t.status === 'open').length} open
          </p>
        </div>

        <button
          onClick={() => setShowCreate(true)}
          className="bg-nesma-primary text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-nesma-primary/80 transition-all flex items-center gap-2 shadow-lg shadow-nesma-primary/20 border border-white/10"
        >
          <Plus size={18} />
          New Task
        </button>
      </div>

      {/* Filters + View Toggle */}
      <div className="glass-card rounded-2xl p-4 border border-white/10 flex flex-col md:flex-row items-start md:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute top-1/2 -translate-y-1/2 left-3 text-gray-400" />
          <input
            type="text"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="Search tasks..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-nesma-secondary/50"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-nesma-secondary/50"
        >
          <option value="" className="bg-nesma-dark">
            All Statuses
          </option>
          {STATUSES.map(s => (
            <option key={s} value={s} className="bg-nesma-dark">
              {STATUS_CONFIG[s].label}
            </option>
          ))}
        </select>

        {/* Priority Filter */}
        <select
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-nesma-secondary/50"
        >
          <option value="" className="bg-nesma-dark">
            All Priorities
          </option>
          {PRIORITIES.map(p => (
            <option key={p} value={p} className="bg-nesma-dark">
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </option>
          ))}
        </select>

        {/* View Toggle */}
        <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-0.5">
          <button
            onClick={() => toggleView('list')}
            className={`p-2 rounded-lg transition-all ${view === 'list' ? 'bg-nesma-primary text-white' : 'text-gray-400 hover:text-white'}`}
            title="List view"
          >
            <List size={16} />
          </button>
          <button
            onClick={() => toggleView('kanban')}
            className={`p-2 rounded-lg transition-all ${view === 'kanban' ? 'bg-nesma-primary text-white' : 'text-gray-400 hover:text-white'}`}
            title="Kanban view"
          >
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>

      {/* ── List View ──────────────────────────────────────────────────────── */}
      {view === 'list' && (
        <div className="glass-card rounded-2xl p-6 border border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="pb-3 font-medium">Title</th>
                  <th className="pb-3 font-medium">Assignee</th>
                  <th className="pb-3 font-medium">Priority</th>
                  <th className="pb-3 font-medium">Due Date</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredTasks.length > 0 ? (
                  filteredTasks.map(task => {
                    const sCfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.open;
                    const pCfg = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.low;

                    return (
                      <tr key={task.id} className="hover:bg-white/5 transition-colors">
                        {/* Title */}
                        <td className="py-3 pr-4">
                          <span className="text-sm font-medium text-white">{task.title}</span>
                        </td>

                        {/* Assignee */}
                        <td className="py-3 pr-4">
                          <span className="text-sm text-gray-400">{task.assignee?.fullName ?? 'Unassigned'}</span>
                        </td>

                        {/* Priority */}
                        <td className="py-3 pr-4">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${pCfg.bg} ${pCfg.text}`}>
                            {pCfg.label}
                          </span>
                        </td>

                        {/* Due Date */}
                        <td className="py-3 pr-4">
                          <span className="text-sm text-gray-400">
                            {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '\u2014'}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3 pr-4">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${sCfg.bg} ${sCfg.text} ${sCfg.border}`}
                          >
                            {sCfg.label}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {task.status !== 'completed' && task.status !== 'cancelled' && (
                              <>
                                {task.status === 'open' && (
                                  <button
                                    onClick={() =>
                                      changeStatus.mutate(
                                        { id: task.id, status: 'in_progress' },
                                        {
                                          onSuccess: () => toast.success('Updated', 'Task started'),
                                          onError: () => toast.error('Error', 'Failed to update'),
                                        },
                                      )
                                    }
                                    className="text-[10px] px-2 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
                                  >
                                    Start
                                  </button>
                                )}
                                {task.status === 'in_progress' && (
                                  <button
                                    onClick={() =>
                                      changeStatus.mutate(
                                        { id: task.id, status: 'completed' },
                                        {
                                          onSuccess: () => toast.success('Updated', 'Task completed'),
                                          onError: () => toast.error('Error', 'Failed to update'),
                                        },
                                      )
                                    }
                                    className="text-[10px] px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                                  >
                                    Complete
                                  </button>
                                )}
                                <button
                                  onClick={() =>
                                    changeStatus.mutate(
                                      { id: task.id, status: 'cancelled' },
                                      {
                                        onSuccess: () => toast.success('Updated', 'Task cancelled'),
                                        onError: () => toast.error('Error', 'Failed to update'),
                                      },
                                    )
                                  }
                                  className="text-[10px] px-2 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <ClipboardList size={40} className="mx-auto text-gray-600 mb-3" />
                      <p className="text-gray-500 text-sm">No tasks found</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Kanban View ────────────────────────────────────────────────────── */}
      {view === 'kanban' && (
        <DndContext collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4 items-start">
            {STATUSES.map(status => (
              <KanbanColumn key={status} status={status} tasks={tasksByStatus[status]} />
            ))}
          </div>

          <DragOverlay>{activeTask ? <TaskCard task={activeTask} isDragOverlay /> : null}</DragOverlay>
        </DndContext>
      )}

      {/* ── Create Modal ───────────────────────────────────────────────────── */}
      <CreateTaskModal isOpen={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
};
