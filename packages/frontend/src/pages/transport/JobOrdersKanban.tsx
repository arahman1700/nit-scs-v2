import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  useJobOrderList,
  useStartJobOrder,
  useCompleteJobOrder,
  useCancelJobOrder,
  useResumeJobOrder,
} from '@/api/hooks/useJobOrders';
import { JobStatus } from '@nit-scs-v2/shared/types';
import type { JobOrder } from '@nit-scs-v2/shared/types';
import { toast } from '@/components/Toaster';
import { Truck, User, MoreHorizontal, Plus, AlertCircle, CheckCircle, XCircle, MapPin, Search } from 'lucide-react';

// ── Backend → Kanban column mapping ──────────────────────────────────────────

/** Map backend snake_case status to the Kanban column it belongs to */
function backendStatusToColumn(backendStatus: string): JobStatus {
  switch (backendStatus) {
    case 'draft':
    case 'pending_approval':
    case 'rejected':
      return JobStatus.NEW;
    case 'approved':
    case 'assigned':
    case 'quoted':
      return JobStatus.ASSIGNING;
    case 'in_progress':
    case 'on_hold':
      return JobStatus.IN_PROGRESS;
    case 'completed':
    case 'invoiced':
      return JobStatus.COMPLETED;
    case 'cancelled':
      return JobStatus.CANCELLED;
    default:
      return JobStatus.NEW;
  }
}

/** Determine which backend API transition to call for a Kanban drag */
function resolveTransition(
  backendStatus: string,
  targetColumn: JobStatus,
): { action: 'start' | 'complete' | 'cancel' | 'resume'; valid: true } | { valid: false; reason: string } {
  if (targetColumn === JobStatus.CANCELLED) {
    const nonCancellable = ['completed', 'invoiced', 'cancelled'];
    if (nonCancellable.includes(backendStatus)) {
      return { valid: false, reason: `Cannot cancel a ${backendStatus} order` };
    }
    return { action: 'cancel', valid: true };
  }

  if (targetColumn === JobStatus.COMPLETED) {
    if (backendStatus === 'in_progress') {
      return { action: 'complete', valid: true };
    }
    return { valid: false, reason: 'Only in-progress orders can be completed' };
  }

  if (targetColumn === JobStatus.IN_PROGRESS) {
    if (backendStatus === 'assigned') {
      return { action: 'start', valid: true };
    }
    if (backendStatus === 'on_hold') {
      return { action: 'resume', valid: true };
    }
    return { valid: false, reason: 'Order must be assigned or on hold' };
  }

  // Dragging to NEW or ASSIGNING columns doesn't have direct backend transitions
  return { valid: false, reason: 'This status change requires the full workflow' };
}

// ── Draggable Job Card ──────────────────────────────────────────────────────

const JobCard: React.FC<{ job: JobOrder; borderColor: string; isDragOverlay?: boolean }> = ({
  job,
  borderColor,
  isDragOverlay = false,
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: job.id,
    data: { job },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : 1,
    touchAction: 'none',
  };

  const card = (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      style={isDragOverlay ? undefined : style}
      {...(isDragOverlay ? {} : { ...listeners, ...attributes })}
      className={`bg-[#132D4B] p-4 rounded-xl border border-white/5 cursor-grab active:cursor-grabbing hover:bg-[#1A3A5E] hover:border-${borderColor}/50 transition-all group shadow-lg relative overflow-hidden ${isDragOverlay ? 'ring-2 ring-nesma-secondary shadow-2xl scale-105' : ''}`}
    >
      {/* Priority Stripe */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 ${
          job.priority === 'High' ? 'bg-red-500' : job.priority === 'Medium' ? 'bg-orange-500' : 'bg-emerald-500'
        }`}
      ></div>

      <div className="pl-2">
        <div className="flex justify-between items-start mb-2">
          <span className="text-[10px] px-2 py-0.5 rounded bg-black/30 text-gray-400 font-mono tracking-wider border border-white/5">
            {job.id}
          </span>
          <button className="text-gray-500 hover:text-white transition-opacity">
            <MoreHorizontal size={16} />
          </button>
        </div>

        <h4 className="font-bold text-gray-100 mb-2 text-sm leading-snug group-hover:text-nesma-secondary transition-colors line-clamp-2">
          {job.title}
        </h4>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <MapPin size={12} className="text-nesma-secondary" />
            <span className="truncate">{job.project || 'Unassigned Project'}</span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/5 mt-2">
            <div className="flex items-center gap-1.5 bg-black/20 px-2 py-1 rounded text-[10px] text-gray-300">
              <Truck size={10} />
              <span>{job.type}</span>
            </div>

            {job.slaStatus && (
              <span
                className={`text-[10px] font-bold ${
                  job.slaStatus === 'On Track'
                    ? 'text-emerald-400'
                    : job.slaStatus === 'At Risk'
                      ? 'text-orange-400'
                      : 'text-red-400'
                }`}
              >
                {job.slaStatus}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return card;
};

// ── Droppable Kanban Column ─────────────────────────────────────────────────

const KanbanColumn: React.FC<{
  status: string;
  jobs: JobOrder[];
  color: string;
  borderColor: string;
  icon: React.FC<{ size?: number }>;
}> = ({ status, jobs, borderColor, icon: Icon }) => {
  const { isOver, setNodeRef } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`min-w-[320px] max-w-[320px] glass-card rounded-2xl flex flex-col h-[calc(100vh-200px)] bg-black/20 border transition-colors ${isOver ? 'border-nesma-secondary/60 bg-nesma-secondary/5' : 'border-white/5'}`}
    >
      {/* Column Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between sticky top-0 bg-[#0E2841]/80 backdrop-blur-sm z-10 rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-${borderColor}/10 text-${borderColor}-400`}>
            <Icon size={18} />
          </div>
          <h3 className="font-bold text-white text-sm uppercase tracking-wide">{status}</h3>
        </div>
        <span className="bg-white/10 text-gray-300 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold">
          {jobs.length}
        </span>
      </div>

      {/* Drop Zone Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {jobs.map(job => (
          <JobCard key={job.id} job={job} borderColor={borderColor} />
        ))}

        {jobs.length === 0 && (
          <div
            className={`h-full flex flex-col items-center justify-center border-2 border-dashed rounded-xl min-h-[150px] transition-colors ${isOver ? 'border-nesma-secondary/40 text-nesma-secondary' : 'border-white/5 text-gray-600'}`}
          >
            <span className="text-xs opacity-50 font-medium">Drop items here</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main Kanban Board ───────────────────────────────────────────────────────

export const JobOrdersKanban: React.FC = () => {
  const navigate = useNavigate();
  const joQuery = useJobOrderList({ pageSize: 200 });
  const joData = (joQuery.data?.data ?? []) as JobOrder[];

  // Track the real backend status for each job (keyed by job id)
  const backendStatusMap = useRef<Record<string, string>>({});
  // Track the data version to detect when API data changes
  const lastSyncRef = useRef<string>('');

  const [jobs, setJobs] = useState<JobOrder[]>([]);
  const [activeJob, setActiveJob] = useState<JobOrder | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Transition mutations
  const startMutation = useStartJobOrder();
  const completeMutation = useCompleteJobOrder();
  const cancelMutation = useCancelJobOrder();
  const resumeMutation = useResumeJobOrder();

  // Sync API data into local state — map backend status to Kanban columns
  // Re-sync whenever joData changes (new data from API / Socket.IO invalidation)
  useEffect(() => {
    if (joData.length === 0) return;
    // Build a fingerprint to detect actual data changes
    const fingerprint = joData.map(jo => `${jo.id}:${(jo as unknown as { status: string }).status}`).join(',');
    if (fingerprint === lastSyncRef.current) return;
    lastSyncRef.current = fingerprint;

    const mapped = joData.map(jo => {
      const rawStatus = (jo as unknown as { status: string }).status ?? 'draft';
      backendStatusMap.current[jo.id] = rawStatus;
      return { ...jo, status: backendStatusToColumn(rawStatus) };
    });
    setJobs(mapped);
  }, [joData]);

  // dnd-kit sensors: pointer (mouse/touch) + keyboard for accessibility
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const job = jobs.find(j => j.id === event.active.id);
    setActiveJob(job ?? null);
  };

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveJob(null);

      if (!over) return;

      const jobId = active.id as string;
      const targetColumn = over.id as JobStatus;
      const currentBackendStatus = backendStatusMap.current[jobId];

      if (!currentBackendStatus) return;

      // If dropping in the same column, do nothing
      if (backendStatusToColumn(currentBackendStatus) === targetColumn) return;

      const transition = resolveTransition(currentBackendStatus, targetColumn);

      if (!transition.valid) {
        toast.warning('Invalid transition', transition.reason);
        return;
      }

      // Optimistic update — move the card immediately
      const previousStatus = backendStatusToColumn(currentBackendStatus);
      setJobs(prev => prev.map(job => (job.id === jobId ? { ...job, status: targetColumn } : job)));

      const revert = () => {
        setJobs(prev => prev.map(job => (job.id === jobId ? { ...job, status: previousStatus } : job)));
      };

      const onSuccess = (newBackendStatus: string) => {
        backendStatusMap.current[jobId] = newBackendStatus;
        toast.success('Status updated', `Job order moved to ${targetColumn}`);
      };

      const onError = (err: unknown) => {
        revert();
        const msg = err instanceof Error ? err.message : 'Failed to update status';
        toast.error('Update failed', msg);
      };

      switch (transition.action) {
        case 'start':
          startMutation.mutate(jobId, {
            onSuccess: () => onSuccess('in_progress'),
            onError,
          });
          break;
        case 'complete':
          completeMutation.mutate(jobId, {
            onSuccess: () => onSuccess('completed'),
            onError,
          });
          break;
        case 'cancel':
          cancelMutation.mutate(
            { id: jobId },
            {
              onSuccess: () => onSuccess('cancelled'),
              onError,
            },
          );
          break;
        case 'resume':
          resumeMutation.mutate(jobId, {
            onSuccess: () => onSuccess('in_progress'),
            onError,
          });
          break;
      }
    },
    [startMutation, completeMutation, cancelMutation, resumeMutation],
  );

  // Filter jobs by search term across title, id, project, and type
  const filteredJobs = useMemo(() => {
    if (!searchTerm.trim()) return jobs;
    const term = searchTerm.toLowerCase();
    return jobs.filter(
      j =>
        j.title?.toLowerCase().includes(term) ||
        j.id?.toLowerCase().includes(term) ||
        j.project?.toLowerCase().includes(term) ||
        j.type?.toLowerCase().includes(term),
    );
  }, [jobs, searchTerm]);

  const getJobsByStatus = (status: JobStatus) => filteredJobs.filter(j => j.status === status);

  if (joQuery.isLoading) {
    return (
      <div className="flex gap-4">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="animate-pulse bg-white/5 rounded-2xl h-64 min-w-[320px]"></div>
        ))}
      </div>
    );
  }

  if (joQuery.isError) {
    return <div className="text-red-400 p-4">Failed to load job orders</div>;
  }

  const columns: {
    status: JobStatus;
    color: string;
    borderColor: string;
    icon: React.FC<{ size?: number }>;
  }[] = [
    { status: JobStatus.NEW, color: 'bg-gray-400', borderColor: 'gray', icon: AlertCircle },
    { status: JobStatus.ASSIGNING, color: 'bg-amber-400', borderColor: 'amber', icon: User },
    { status: JobStatus.IN_PROGRESS, color: 'bg-nesma-secondary', borderColor: 'blue', icon: Truck },
    { status: JobStatus.COMPLETED, color: 'bg-emerald-400', borderColor: 'emerald', icon: CheckCircle },
    { status: JobStatus.CANCELLED, color: 'bg-red-400', borderColor: 'red', icon: XCircle },
  ];

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white glow-text">Job Orders Board</h1>
          <p className="text-sm text-gray-400 mt-1">Drag and drop cards to update status</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search size={16} className="absolute top-1/2 -translate-y-1/2 left-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search orders..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-nesma-secondary"
            />
          </div>
          <button
            onClick={() => navigate('/admin/forms/jo')}
            className="bg-nesma-primary text-white px-5 py-2 rounded-xl hover:bg-nesma-accent flex items-center gap-2 shadow-lg shadow-nesma-primary/20 transition-all border border-white/10"
          >
            <Plus size={18} />
            <span className="hidden md:inline">New Job Order</span>
          </button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1 items-start snap-x">
          {columns.map(col => (
            <KanbanColumn
              key={col.status}
              status={col.status}
              jobs={getJobsByStatus(col.status)}
              color={col.color}
              borderColor={col.borderColor}
              icon={col.icon}
            />
          ))}
        </div>

        {/* Drag Overlay — renders the card "floating" under the cursor */}
        <DragOverlay>{activeJob ? <JobCard job={activeJob} borderColor="blue" isDragOverlay /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
};
