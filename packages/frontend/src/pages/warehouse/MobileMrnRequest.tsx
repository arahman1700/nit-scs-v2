import { useState, useCallback, useMemo } from 'react';
import { FileText, CheckCircle2, ScanLine, ArrowLeft, AlertCircle } from 'lucide-react';
import BarcodeScanner from '@/components/BarcodeScanner';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { OfflineQueueBanner } from '@/components/OfflineQueueBanner';
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator';
import { SwipeableSteps } from '@/components/SwipeableSteps';

type Step = 'scan' | 'details' | 'review' | 'done';

interface ScannedItem {
  id: string;
  itemCode: string;
  itemDescription: string;
}

export function MobileMrnRequest() {
  const [step, setStep] = useState<Step>('scan');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedItem, setScannedItem] = useState<ScannedItem | null>(null);
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [queuedOffline, setQueuedOffline] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const { enqueueTransaction, isOnline } = useOfflineQueue();

  const STEPS: Step[] = ['scan', 'details', 'review', 'done'];
  const stepIndex = useMemo(() => STEPS.indexOf(step), [step]);
  const handleStepChange = useCallback((index: number) => {
    if (index >= 0 && index < STEPS.length) setStep(STEPS[index]);
  }, []);

  const handleItemFound = useCallback((item: Record<string, unknown>) => {
    setScannedItem({
      id: item.id as string,
      itemCode: item.itemCode as string,
      itemDescription: item.itemDescription as string,
    });
    setScannerOpen(false);
    setStep('details');
  }, []);

  const handleSubmit = async () => {
    if (!scannedItem || !quantity) return;
    setSubmitError(false);

    try {
      await enqueueTransaction('mrn-request', {
        itemId: scannedItem.id,
        itemCode: scannedItem.itemCode,
        quantity: Number(quantity),
        reason,
      });
      setQueuedOffline(!isOnline);
      setStep('done');
    } catch {
      setSubmitError(true);
    }
  };

  const resetFlow = () => {
    setStep('scan');
    setScannedItem(null);
    setQuantity('');
    setReason('');
    setQueuedOffline(false);
    setSubmitError(false);
  };

  return (
    <div className="min-h-screen bg-nesma-dark p-4 pb-24">
      <OfflineQueueBanner />

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 rounded-xl bg-purple-600/20">
          <FileText size={22} className="text-purple-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">Material Request</h1>
          <p className="text-xs text-gray-400">Scan item to create MRN request</p>
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
        {/* Step 1: Scan */}
        {step === 'scan' && (
          <div className="space-y-4">
            <div className="glass-card rounded-2xl p-6 border border-white/10 text-center">
              <ScanLine size={48} className="text-purple-400 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-white mb-2">Scan Item Barcode</h2>
              <p className="text-sm text-gray-400 mb-6">Scan the item you want to request</p>
              <button
                onClick={() => setScannerOpen(true)}
                className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-all text-lg"
              >
                Open Scanner
              </button>
            </div>

            {scannedItem && (
              <div className="glass-card rounded-2xl p-5 border border-purple-500/20 bg-purple-500/5">
                <div className="text-sm text-purple-400 mb-1">Item Found</div>
                <div className="text-white font-semibold">{scannedItem.itemDescription}</div>
                <div className="text-sm text-gray-400 mt-1">Code: {scannedItem.itemCode}</div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Details */}
        {step === 'details' && (
          <div className="space-y-4">
            <button
              onClick={() => setStep('scan')}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={16} /> Back
            </button>

            {scannedItem && (
              <div className="glass-card rounded-2xl p-4 border border-purple-500/20 bg-purple-500/5">
                <div className="text-xs text-purple-400 mb-1">Scanned Item</div>
                <div className="text-white font-semibold">{scannedItem.itemDescription}</div>
                <div className="text-sm text-gray-400">{scannedItem.itemCode}</div>
              </div>
            )}

            <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-4">
              <h2 className="text-lg font-semibold text-white">Request Details</h2>
              <div>
                <label htmlFor="mrn-quantity" className="text-xs text-gray-400 block mb-1">
                  Quantity Required
                </label>
                <input
                  id="mrn-quantity"
                  type="number"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  placeholder="Enter quantity"
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:border-nesma-secondary/50"
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="mrn-reason" className="text-xs text-gray-400 block mb-1">
                  Reason for Request
                </label>
                <textarea
                  id="mrn-reason"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Enter reason..."
                  rows={3}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-nesma-secondary/50 resize-none"
                />
              </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-nesma-dark/95 backdrop-blur-xl border-t border-white/10">
              <button
                onClick={() => setStep('review')}
                disabled={!quantity}
                className="w-full py-4 bg-nesma-primary hover:bg-nesma-primary/80 disabled:opacity-50 text-white font-semibold rounded-xl transition-all text-lg"
              >
                Review Request
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 'review' && (
          <div className="space-y-4">
            <button
              onClick={() => setStep('details')}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={16} /> Back
            </button>

            <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-4">
              <h2 className="text-lg font-semibold text-white">Review Request</h2>
              {scannedItem && (
                <div>
                  <div className="text-xs text-gray-400 mb-1">Item</div>
                  <div className="text-white">{scannedItem.itemDescription}</div>
                  <div className="text-sm text-gray-400">{scannedItem.itemCode}</div>
                </div>
              )}
              <div>
                <div className="text-xs text-gray-400 mb-1">Quantity</div>
                <div className="text-white text-lg font-semibold">{quantity}</div>
              </div>
              {reason && (
                <div>
                  <div className="text-xs text-gray-400 mb-1">Reason</div>
                  <div className="text-white text-sm">{reason}</div>
                </div>
              )}
            </div>

            {submitError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                <AlertCircle size={16} />
                Failed to submit request. Please try again.
              </div>
            )}

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-nesma-dark/95 backdrop-blur-xl border-t border-white/10">
              <button
                onClick={handleSubmit}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all text-lg flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={20} />
                Submit Request
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
              {queuedOffline ? 'Queued for Sync' : 'Request Submitted!'}
            </h2>
            <p className="text-sm text-gray-400 mb-6">
              {queuedOffline
                ? 'Request saved offline. It will sync automatically when you reconnect.'
                : 'The material request has been submitted successfully.'}
            </p>
            <button
              onClick={resetFlow}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-all"
            >
              New Request
            </button>
          </div>
        )}
      </SwipeableSteps>

      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onItemFound={handleItemFound}
        showLookup
      />
    </div>
  );
}
