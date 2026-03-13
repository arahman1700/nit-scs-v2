import { useState, useCallback, useMemo } from 'react';
import { Wrench, CheckCircle2, ScanLine, ArrowLeft, AlertCircle, Clock } from 'lucide-react';
import BarcodeScanner from '@/components/BarcodeScanner';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { OfflineQueueBanner } from '@/components/OfflineQueueBanner';
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator';
import { SwipeableSteps } from '@/components/SwipeableSteps';

type Step = 'scan' | 'tasks' | 'labor' | 'done';

interface TaskItem {
  id: string;
  description: string;
  completed: boolean;
  notes: string;
}

export function MobileJoExecute() {
  const [step, setStep] = useState<Step>('scan');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedJoId, setScannedJoId] = useState('');
  const [scannedJoNumber, setScannedJoNumber] = useState('');
  const [tasks, setTasks] = useState<TaskItem[]>([
    { id: '1', description: 'Prepare materials and tools', completed: false, notes: '' },
    { id: '2', description: 'Execute primary work scope', completed: false, notes: '' },
    { id: '3', description: 'Quality check completed work', completed: false, notes: '' },
    { id: '4', description: 'Clean up and secure area', completed: false, notes: '' },
    { id: '5', description: 'Document completion details', completed: false, notes: '' },
  ]);
  const [laborHours, setLaborHours] = useState('');
  const [laborMinutes, setLaborMinutes] = useState('');
  const [queuedOffline, setQueuedOffline] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const { enqueueTransaction, isOnline } = useOfflineQueue();

  const STEPS: Step[] = ['scan', 'tasks', 'labor', 'done'];
  const stepIndex = useMemo(() => STEPS.indexOf(step), [step]);
  const handleStepChange = useCallback((index: number) => {
    if (index >= 0 && index < STEPS.length) setStep(STEPS[index]);
  }, []);

  const handleScan = useCallback((code: string) => {
    setScannedJoId(code);
    setScannedJoNumber(code);
    setScannerOpen(false);
    setStep('tasks');
  }, []);

  const handleItemFound = useCallback((item: Record<string, unknown>) => {
    setScannedJoId(item.id as string);
    setScannedJoNumber((item.documentNumber as string) || (item.id as string));
    setScannerOpen(false);
    setStep('tasks');
  }, []);

  const toggleTask = (taskId: string) => {
    setTasks(prev => prev.map(task => (task.id === taskId ? { ...task, completed: !task.completed } : task)));
  };

  const updateTaskNotes = (taskId: string, notes: string) => {
    setTasks(prev => prev.map(task => (task.id === taskId ? { ...task, notes } : task)));
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const allCompleted = completedCount === tasks.length;

  const totalLaborHours = (Number(laborHours) || 0) + (Number(laborMinutes) || 0) / 60;

  const handleSubmit = async () => {
    if (!scannedJoId || !laborHours) return;
    setSubmitError(false);

    try {
      await enqueueTransaction('jo-execute', {
        joId: scannedJoId,
        joNumber: scannedJoNumber,
        laborHours: totalLaborHours,
        taskResults: tasks.map(task => ({
          taskId: task.id,
          description: task.description,
          completed: task.completed,
          notes: task.notes,
        })),
      });
      setQueuedOffline(!isOnline);
      setStep('done');
    } catch {
      setSubmitError(true);
    }
  };

  const resetFlow = () => {
    setStep('scan');
    setScannedJoId('');
    setScannedJoNumber('');
    setTasks(prev => prev.map(t => ({ ...t, completed: false, notes: '' })));
    setLaborHours('');
    setLaborMinutes('');
    setQueuedOffline(false);
    setSubmitError(false);
  };

  return (
    <div className="min-h-screen bg-nesma-dark p-4 pb-24">
      <OfflineQueueBanner />

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 rounded-xl bg-indigo-600/20">
          <Wrench size={22} className="text-indigo-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">Job Order Execution</h1>
          <p className="text-xs text-gray-400">Scan JO barcode to execute tasks</p>
        </div>
        <SyncStatusIndicator />
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                step === s
                  ? 'bg-nesma-secondary text-white'
                  : i < stepIndex
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white/10 text-gray-400'
              }`}
            >
              {i < stepIndex ? <CheckCircle2 size={16} /> : i + 1}
            </div>
            {i < STEPS.length - 1 && <div className="w-6 h-px bg-white/10" />}
          </div>
        ))}
      </div>

      <SwipeableSteps currentStep={stepIndex} onStepChange={handleStepChange} totalSteps={STEPS.length}>
        {/* Step 1: Scan JO */}
        {step === 'scan' && (
          <div className="space-y-4">
            <div className="glass-card rounded-2xl p-6 border border-white/10 text-center">
              <ScanLine size={48} className="text-indigo-400 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-white mb-2">Scan Job Order</h2>
              <p className="text-sm text-gray-400 mb-6">Scan the JO barcode to begin execution</p>
              <button
                onClick={() => setScannerOpen(true)}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all text-lg"
              >
                Open Scanner
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Task Checklist */}
        {step === 'tasks' && (
          <div className="space-y-4">
            <button
              onClick={() => setStep('scan')}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={16} /> Back
            </button>

            <div className="glass-card rounded-2xl p-4 border border-indigo-500/20 bg-indigo-500/5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-indigo-400 mb-1">Job Order</div>
                  <div className="text-white font-semibold">{scannedJoNumber}</div>
                </div>
                <div className="text-sm text-gray-400">
                  {completedCount}/{tasks.length} done
                </div>
              </div>
            </div>

            <h2 className="text-lg font-semibold text-white">Task Checklist</h2>

            <div className="space-y-3">
              {tasks.map(task => (
                <div key={task.id} className="glass-card rounded-xl p-4 border border-white/10 space-y-2">
                  <button onClick={() => toggleTask(task.id)} className="flex items-center gap-3 w-full text-left">
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                        task.completed ? 'bg-emerald-600' : 'bg-white/10 border border-white/20'
                      }`}
                    >
                      {task.completed && <CheckCircle2 size={14} className="text-white" />}
                    </div>
                    <span className={`text-sm ${task.completed ? 'text-gray-400 line-through' : 'text-white'}`}>
                      {task.description}
                    </span>
                  </button>
                  {task.completed && (
                    <input
                      type="text"
                      value={task.notes}
                      onChange={e => updateTaskNotes(task.id, e.target.value)}
                      placeholder="Add notes (optional)..."
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-nesma-secondary/50 ml-9"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-nesma-dark/95 backdrop-blur-xl border-t border-white/10">
              <button
                onClick={() => setStep('labor')}
                disabled={!allCompleted}
                className="w-full py-4 bg-nesma-primary hover:bg-nesma-primary/80 disabled:opacity-50 text-white font-semibold rounded-xl transition-all text-lg"
              >
                {allCompleted ? 'Log Labor Hours' : `Complete all tasks (${completedCount}/${tasks.length})`}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Labor Hours */}
        {step === 'labor' && (
          <div className="space-y-4">
            <button
              onClick={() => setStep('tasks')}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={16} /> Back
            </button>

            <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-4">
              <div className="flex items-center gap-3">
                <Clock size={24} className="text-indigo-400" />
                <h2 className="text-lg font-semibold text-white">Labor Hours</h2>
              </div>

              <div className="glass-card rounded-xl p-3 border border-indigo-500/20 bg-indigo-500/5">
                <div className="text-xs text-indigo-400">Job Order: {scannedJoNumber}</div>
                <div className="text-sm text-white mt-0.5">
                  {completedCount} of {tasks.length} tasks completed
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label htmlFor="jo-hours" className="text-xs text-gray-400 block mb-1">
                    Hours
                  </label>
                  <input
                    id="jo-hours"
                    type="number"
                    value={laborHours}
                    onChange={e => setLaborHours(e.target.value)}
                    placeholder="0"
                    min="0"
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white text-lg text-center focus:outline-none focus:border-nesma-secondary/50"
                    autoFocus
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor="jo-minutes" className="text-xs text-gray-400 block mb-1">
                    Minutes
                  </label>
                  <input
                    id="jo-minutes"
                    type="number"
                    value={laborMinutes}
                    onChange={e => setLaborMinutes(e.target.value)}
                    placeholder="0"
                    min="0"
                    max="59"
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white text-lg text-center focus:outline-none focus:border-nesma-secondary/50"
                  />
                </div>
              </div>

              {totalLaborHours > 0 && (
                <div className="text-center">
                  <div className="text-xs text-gray-400">Total</div>
                  <div className="text-2xl font-bold text-white">{totalLaborHours.toFixed(1)}h</div>
                </div>
              )}
            </div>

            {submitError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                <AlertCircle size={16} />
                Failed to submit job order. Please try again.
              </div>
            )}

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-nesma-dark/95 backdrop-blur-xl border-t border-white/10">
              <button
                onClick={handleSubmit}
                disabled={!laborHours}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all text-lg flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={20} />
                Complete Job Order
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Done */}
        {step === 'done' && (
          <div
            className={`glass-card rounded-2xl p-8 border text-center ${
              queuedOffline ? 'border-amber-500/20 bg-amber-500/5' : 'border-emerald-500/20 bg-emerald-500/5'
            }`}
          >
            <CheckCircle2
              size={64}
              className={queuedOffline ? 'text-amber-400 mx-auto mb-4' : 'text-emerald-400 mx-auto mb-4'}
            />
            <h2 className="text-xl font-bold text-white mb-2">
              {queuedOffline ? 'Queued for Sync' : 'Job Order Complete!'}
            </h2>
            <p className="text-sm text-gray-400 mb-6">
              {queuedOffline
                ? 'Job order saved offline. It will sync automatically when you reconnect.'
                : 'The job order has been completed successfully.'}
            </p>
            <button
              onClick={resetFlow}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all"
            >
              Next Job Order
            </button>
          </div>
        )}
      </SwipeableSteps>

      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
        onItemFound={handleItemFound}
        showLookup
      />
    </div>
  );
}
