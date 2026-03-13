import { useState, useCallback, useMemo } from 'react';
import { ClipboardCheck, CheckCircle2, ScanLine, ArrowLeft, AlertCircle, XCircle } from 'lucide-react';
import BarcodeScanner from '@/components/BarcodeScanner';
import { FileUploadZone } from '@/components/FileUploadZone';
import type { UploadedFile } from '@/components/FileUploadZone';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { OfflineQueueBanner } from '@/components/OfflineQueueBanner';
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator';
import { SwipeableSteps } from '@/components/SwipeableSteps';

type Step = 'scan' | 'inspect' | 'result' | 'done';

interface InspectionLine {
  id: string;
  description: string;
  passed: boolean | null;
  notes: string;
}

export function MobileQciInspect() {
  const [step, setStep] = useState<Step>('scan');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedGrnId, setScannedGrnId] = useState('');
  const [scannedGrnNumber, setScannedGrnNumber] = useState('');
  const [inspectionLines, setInspectionLines] = useState<InspectionLine[]>([
    { id: '1', description: 'Visual appearance check', passed: null, notes: '' },
    { id: '2', description: 'Packaging integrity', passed: null, notes: '' },
    { id: '3', description: 'Quantity verification', passed: null, notes: '' },
    { id: '4', description: 'Documentation complete', passed: null, notes: '' },
    { id: '5', description: 'Specification compliance', passed: null, notes: '' },
  ]);
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);
  const [queuedOffline, setQueuedOffline] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const { enqueueTransaction, isOnline } = useOfflineQueue();

  const STEPS: Step[] = ['scan', 'inspect', 'result', 'done'];
  const stepIndex = useMemo(() => STEPS.indexOf(step), [step]);
  const handleStepChange = useCallback((index: number) => {
    if (index >= 0 && index < STEPS.length) setStep(STEPS[index]);
  }, []);

  const handleScan = useCallback((code: string) => {
    setScannedGrnId(code);
    setScannedGrnNumber(code);
    setScannerOpen(false);
    setStep('inspect');
  }, []);

  const handleItemFound = useCallback((item: Record<string, unknown>) => {
    setScannedGrnId(item.id as string);
    setScannedGrnNumber((item.documentNumber as string) || (item.id as string));
    setScannerOpen(false);
    setStep('inspect');
  }, []);

  const updateLine = (lineId: string, updates: Partial<InspectionLine>) => {
    setInspectionLines(prev => prev.map(line => (line.id === lineId ? { ...line, ...updates } : line)));
  };

  const allInspected = inspectionLines.every(line => line.passed !== null);
  const overallPass = inspectionLines.every(line => line.passed === true);
  const passCount = inspectionLines.filter(line => line.passed === true).length;
  const failCount = inspectionLines.filter(line => line.passed === false).length;

  const handleSubmit = async () => {
    if (!scannedGrnId) return;
    setSubmitError(false);

    try {
      await enqueueTransaction('qci-inspect', {
        grnId: scannedGrnId,
        grnNumber: scannedGrnNumber,
        overallResult: overallPass ? 'pass' : 'fail',
        inspectionResults: inspectionLines.map(line => ({
          checkId: line.id,
          description: line.description,
          passed: line.passed,
          notes: line.notes,
        })),
        attachments: attachments.map(f => ({ url: f.url, name: f.originalName })),
      });
      setQueuedOffline(!isOnline);
      setStep('done');
    } catch {
      setSubmitError(true);
    }
  };

  const resetFlow = () => {
    setStep('scan');
    setScannedGrnId('');
    setScannedGrnNumber('');
    setInspectionLines(prev => prev.map(l => ({ ...l, passed: null, notes: '' })));
    setAttachments([]);
    setQueuedOffline(false);
    setSubmitError(false);
  };

  return (
    <div className="min-h-screen bg-nesma-dark p-4 pb-24">
      <OfflineQueueBanner />

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 rounded-xl bg-cyan-600/20">
          <ClipboardCheck size={22} className="text-cyan-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">QC Inspection</h1>
          <p className="text-xs text-gray-400">Scan GRN to start inspection</p>
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
        {/* Step 1: Scan GRN */}
        {step === 'scan' && (
          <div className="space-y-4">
            <div className="glass-card rounded-2xl p-6 border border-white/10 text-center">
              <ScanLine size={48} className="text-cyan-400 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-white mb-2">Scan GRN Barcode</h2>
              <p className="text-sm text-gray-400 mb-6">Scan the GRN document barcode to begin inspection</p>
              <button
                onClick={() => setScannerOpen(true)}
                className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-xl transition-all text-lg"
              >
                Open Scanner
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Inspection Checklist */}
        {step === 'inspect' && (
          <div className="space-y-4">
            <button
              onClick={() => setStep('scan')}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={16} /> Back
            </button>

            <div className="glass-card rounded-2xl p-4 border border-cyan-500/20 bg-cyan-500/5">
              <div className="text-xs text-cyan-400 mb-1">GRN Document</div>
              <div className="text-white font-semibold">{scannedGrnNumber}</div>
            </div>

            <h2 className="text-lg font-semibold text-white">Inspection Checklist</h2>

            <div className="space-y-3">
              {inspectionLines.map(line => (
                <div key={line.id} className="glass-card rounded-xl p-4 border border-white/10 space-y-3">
                  <div className="text-sm text-white font-medium">{line.description}</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateLine(line.id, { passed: true })}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                        line.passed === true
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      <CheckCircle2 size={16} /> Pass
                    </button>
                    <button
                      onClick={() => updateLine(line.id, { passed: false })}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                        line.passed === false ? 'bg-red-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      <XCircle size={16} /> Fail
                    </button>
                  </div>
                  {line.passed === false && (
                    <input
                      type="text"
                      value={line.notes}
                      onChange={e => updateLine(line.id, { notes: e.target.value })}
                      placeholder="Add failure notes..."
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-nesma-secondary/50"
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Inspection Photos */}
            <div className="glass-card rounded-2xl p-4 border border-white/10">
              <h3 className="text-sm font-semibold text-white mb-3">Inspection Photos</h3>
              <FileUploadZone
                entityType="rfim"
                entityId={scannedGrnId || undefined}
                maxFiles={10}
                acceptedTypes=".jpg,.jpeg,.png,.pdf"
                files={attachments}
                onFilesChange={setAttachments}
              />
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-nesma-dark/95 backdrop-blur-xl border-t border-white/10">
              <button
                onClick={() => setStep('result')}
                disabled={!allInspected}
                className="w-full py-4 bg-nesma-primary hover:bg-nesma-primary/80 disabled:opacity-50 text-white font-semibold rounded-xl transition-all text-lg"
              >
                View Results
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Pass/Fail Result */}
        {step === 'result' && (
          <div className="space-y-4">
            <button
              onClick={() => setStep('inspect')}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={16} /> Back
            </button>

            <div
              className={`glass-card rounded-2xl p-6 border text-center ${
                overallPass ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'
              }`}
            >
              {overallPass ? (
                <CheckCircle2 size={48} className="text-emerald-400 mx-auto mb-3" />
              ) : (
                <XCircle size={48} className="text-red-400 mx-auto mb-3" />
              )}
              <h2 className="text-xl font-bold text-white mb-2">
                {overallPass ? 'All Checks Passed' : 'Inspection Failed'}
              </h2>
              <div className="flex justify-center gap-6 mt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-400">{passCount}</div>
                  <div className="text-xs text-gray-400">Passed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-400">{failCount}</div>
                  <div className="text-xs text-gray-400">Failed</div>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-4 border border-white/10">
              <div className="text-xs text-gray-400 mb-1">GRN</div>
              <div className="text-white font-semibold">{scannedGrnNumber}</div>
            </div>

            {submitError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                <AlertCircle size={16} />
                Failed to submit inspection. Please try again.
              </div>
            )}

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-nesma-dark/95 backdrop-blur-xl border-t border-white/10">
              <button
                onClick={handleSubmit}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all text-lg flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={20} />
                Submit Inspection
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
              {queuedOffline ? 'Queued for Sync' : 'Inspection Submitted!'}
            </h2>
            <p className="text-sm text-gray-400 mb-6">
              {queuedOffline
                ? 'Inspection saved offline. It will sync automatically when you reconnect.'
                : 'The QC inspection has been recorded successfully.'}
            </p>
            <button
              onClick={resetFlow}
              className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-xl transition-all"
            >
              Next Inspection
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
