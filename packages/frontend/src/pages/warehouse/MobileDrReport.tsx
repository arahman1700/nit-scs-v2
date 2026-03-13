import { useState, useCallback, useMemo } from 'react';
import { AlertTriangle, CheckCircle2, ScanLine, ArrowLeft, AlertCircle } from 'lucide-react';
import BarcodeScanner from '@/components/BarcodeScanner';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { OfflineQueueBanner } from '@/components/OfflineQueueBanner';
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator';
import { SwipeableSteps } from '@/components/SwipeableSteps';

type Step = 'scan' | 'discrepancy' | 'quantity' | 'done';
type DiscrepancyType = 'over' | 'short' | 'damage';

export function MobileDrReport() {
  const [step, setStep] = useState<Step>('scan');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedGrnId, setScannedGrnId] = useState('');
  const [scannedGrnNumber, setScannedGrnNumber] = useState('');
  const [discrepancyType, setDiscrepancyType] = useState<DiscrepancyType | null>(null);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [queuedOffline, setQueuedOffline] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const { enqueueTransaction, isOnline } = useOfflineQueue();

  const STEPS: Step[] = ['scan', 'discrepancy', 'quantity', 'done'];
  const stepIndex = useMemo(() => STEPS.indexOf(step), [step]);
  const handleStepChange = useCallback((index: number) => {
    if (index >= 0 && index < STEPS.length) setStep(STEPS[index]);
  }, []);

  const handleScan = useCallback((code: string) => {
    setScannedGrnId(code);
    setScannedGrnNumber(code);
    setScannerOpen(false);
    setStep('discrepancy');
  }, []);

  const handleItemFound = useCallback((item: Record<string, unknown>) => {
    setScannedGrnId(item.id as string);
    setScannedGrnNumber((item.documentNumber as string) || (item.id as string));
    setScannerOpen(false);
    setStep('discrepancy');
  }, []);

  const discrepancyOptions: { value: DiscrepancyType; label: string; desc: string; color: string }[] = [
    { value: 'over', label: 'Over Delivery', desc: 'Received more than ordered', color: 'blue' },
    { value: 'short', label: 'Short Delivery', desc: 'Received less than ordered', color: 'amber' },
    { value: 'damage', label: 'Damaged Goods', desc: 'Items arrived damaged', color: 'red' },
  ];

  const handleSubmit = async () => {
    if (!scannedGrnId || !discrepancyType || !quantity) return;
    setSubmitError(false);

    try {
      await enqueueTransaction('dr-report', {
        grnId: scannedGrnId,
        grnNumber: scannedGrnNumber,
        discrepancyType,
        quantity: Number(quantity),
        notes,
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
    setDiscrepancyType(null);
    setQuantity('');
    setNotes('');
    setQueuedOffline(false);
    setSubmitError(false);
  };

  return (
    <div className="min-h-screen bg-nesma-dark p-4 pb-24">
      <OfflineQueueBanner />

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 rounded-xl bg-amber-600/20">
          <AlertTriangle size={22} className="text-amber-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">Discrepancy Report</h1>
          <p className="text-xs text-gray-400">Scan GRN to report discrepancy</p>
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
              <ScanLine size={48} className="text-amber-400 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-white mb-2">Scan GRN Barcode</h2>
              <p className="text-sm text-gray-400 mb-6">Scan the GRN to report a discrepancy</p>
              <button
                onClick={() => setScannerOpen(true)}
                className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl transition-all text-lg"
              >
                Open Scanner
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Select Discrepancy Type */}
        {step === 'discrepancy' && (
          <div className="space-y-4">
            <button
              onClick={() => setStep('scan')}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={16} /> Back
            </button>

            <div className="glass-card rounded-2xl p-4 border border-amber-500/20 bg-amber-500/5">
              <div className="text-xs text-amber-400 mb-1">GRN Document</div>
              <div className="text-white font-semibold">{scannedGrnNumber}</div>
            </div>

            <h2 className="text-lg font-semibold text-white">Select Discrepancy Type</h2>

            <div className="space-y-3">
              {discrepancyOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setDiscrepancyType(opt.value);
                    setStep('quantity');
                  }}
                  className={`w-full text-left glass-card rounded-xl p-4 border transition-all ${
                    discrepancyType === opt.value
                      ? 'border-amber-500/50 bg-amber-500/10'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="text-white font-semibold text-sm">{opt.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Quantity & Notes */}
        {step === 'quantity' && (
          <div className="space-y-4">
            <button
              onClick={() => setStep('discrepancy')}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={16} /> Back
            </button>

            <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-4">
              <h2 className="text-lg font-semibold text-white">Discrepancy Details</h2>

              <div className="glass-card rounded-xl p-3 border border-amber-500/20 bg-amber-500/5">
                <div className="text-xs text-amber-400">GRN: {scannedGrnNumber}</div>
                <div className="text-sm text-white font-medium mt-0.5">
                  Type: {discrepancyOptions.find(o => o.value === discrepancyType)?.label}
                </div>
              </div>

              <div>
                <label htmlFor="dr-quantity" className="text-xs text-gray-400 block mb-1">
                  {discrepancyType === 'damage' ? 'Damaged Quantity' : 'Discrepancy Quantity'}
                </label>
                <input
                  id="dr-quantity"
                  type="number"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  placeholder="Enter quantity"
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:border-nesma-secondary/50"
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="dr-notes" className="text-xs text-gray-400 block mb-1">
                  Notes
                </label>
                <textarea
                  id="dr-notes"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Describe the discrepancy..."
                  rows={3}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-nesma-secondary/50 resize-none"
                />
              </div>
            </div>

            {submitError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                <AlertCircle size={16} />
                Failed to submit report. Please try again.
              </div>
            )}

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-nesma-dark/95 backdrop-blur-xl border-t border-white/10">
              <button
                onClick={handleSubmit}
                disabled={!quantity}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all text-lg flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={20} />
                Submit Report
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
              {queuedOffline ? 'Queued for Sync' : 'Report Submitted!'}
            </h2>
            <p className="text-sm text-gray-400 mb-6">
              {queuedOffline
                ? 'Report saved offline. It will sync automatically when you reconnect.'
                : 'The discrepancy report has been submitted successfully.'}
            </p>
            <button
              onClick={resetFlow}
              className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl transition-all"
            >
              New Report
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
