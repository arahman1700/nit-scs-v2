import { useState, useCallback, useMemo } from 'react';
import { RotateCcw, CheckCircle2, ScanLine, ArrowLeft, AlertCircle } from 'lucide-react';
import BarcodeScanner from '@/components/BarcodeScanner';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { OfflineQueueBanner } from '@/components/OfflineQueueBanner';
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator';
import { SwipeableSteps } from '@/components/SwipeableSteps';

type Step = 'scan' | 'details' | 'quantity' | 'done';
type ItemCondition = 'good' | 'damaged' | 'expired' | 'defective';

interface ScannedItem {
  id: string;
  itemCode: string;
  itemDescription: string;
}

export function MobileMrReturn() {
  const [step, setStep] = useState<Step>('scan');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedItem, setScannedItem] = useState<ScannedItem | null>(null);
  const [reason, setReason] = useState('');
  const [condition, setCondition] = useState<ItemCondition | null>(null);
  const [quantity, setQuantity] = useState('');
  const [queuedOffline, setQueuedOffline] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const { enqueueTransaction, isOnline } = useOfflineQueue();

  const STEPS: Step[] = ['scan', 'details', 'quantity', 'done'];
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

  const conditionOptions: { value: ItemCondition; label: string; color: string }[] = [
    { value: 'good', label: 'Good Condition', color: 'emerald' },
    { value: 'damaged', label: 'Damaged', color: 'red' },
    { value: 'expired', label: 'Expired', color: 'amber' },
    { value: 'defective', label: 'Defective', color: 'purple' },
  ];

  const handleSubmit = async () => {
    if (!scannedItem || !condition || !quantity) return;
    setSubmitError(false);

    try {
      await enqueueTransaction('mr-return', {
        itemId: scannedItem.id,
        itemCode: scannedItem.itemCode,
        quantity: Number(quantity),
        reason,
        condition,
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
    setReason('');
    setCondition(null);
    setQuantity('');
    setQueuedOffline(false);
    setSubmitError(false);
  };

  return (
    <div className="min-h-screen bg-nesma-dark p-4 pb-24">
      <OfflineQueueBanner />

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 rounded-xl bg-orange-600/20">
          <RotateCcw size={22} className="text-orange-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">Material Return</h1>
          <p className="text-xs text-gray-400">Scan item to initiate return</p>
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
              <ScanLine size={48} className="text-orange-400 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-white mb-2">Scan Item Barcode</h2>
              <p className="text-sm text-gray-400 mb-6">Scan the item you want to return</p>
              <button
                onClick={() => setScannerOpen(true)}
                className="w-full py-4 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-xl transition-all text-lg"
              >
                Open Scanner
              </button>
            </div>

            {scannedItem && (
              <div className="glass-card rounded-2xl p-5 border border-orange-500/20 bg-orange-500/5">
                <div className="text-sm text-orange-400 mb-1">Item Found</div>
                <div className="text-white font-semibold">{scannedItem.itemDescription}</div>
                <div className="text-sm text-gray-400 mt-1">Code: {scannedItem.itemCode}</div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Return Reason + Condition */}
        {step === 'details' && (
          <div className="space-y-4">
            <button
              onClick={() => setStep('scan')}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={16} /> Back
            </button>

            {scannedItem && (
              <div className="glass-card rounded-2xl p-4 border border-orange-500/20 bg-orange-500/5">
                <div className="text-xs text-orange-400 mb-1">Returning Item</div>
                <div className="text-white font-semibold">{scannedItem.itemDescription}</div>
                <div className="text-sm text-gray-400">{scannedItem.itemCode}</div>
              </div>
            )}

            <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-4">
              <h2 className="text-lg font-semibold text-white">Return Details</h2>

              <div>
                <div className="text-xs text-gray-400 mb-2">Item Condition</div>
                <div className="grid grid-cols-2 gap-2">
                  {conditionOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setCondition(opt.value)}
                      className={`py-3 rounded-xl text-sm font-semibold transition-all ${
                        condition === opt.value
                          ? opt.value === 'good'
                            ? 'bg-emerald-600 text-white'
                            : opt.value === 'damaged'
                              ? 'bg-red-600 text-white'
                              : opt.value === 'expired'
                                ? 'bg-amber-600 text-white'
                                : 'bg-purple-600 text-white'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="mr-reason" className="text-xs text-gray-400 block mb-1">
                  Return Reason
                </label>
                <textarea
                  id="mr-reason"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Why is this item being returned?"
                  rows={3}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-nesma-secondary/50 resize-none"
                />
              </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-nesma-dark/95 backdrop-blur-xl border-t border-white/10">
              <button
                onClick={() => setStep('quantity')}
                disabled={!condition}
                className="w-full py-4 bg-nesma-primary hover:bg-nesma-primary/80 disabled:opacity-50 text-white font-semibold rounded-xl transition-all text-lg"
              >
                Next: Quantity
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Quantity & Submit */}
        {step === 'quantity' && (
          <div className="space-y-4">
            <button
              onClick={() => setStep('details')}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={16} /> Back
            </button>

            <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-4">
              <h2 className="text-lg font-semibold text-white">Return Quantity</h2>

              {scannedItem && (
                <div>
                  <div className="text-xs text-gray-400 mb-1">Item</div>
                  <div className="text-white">{scannedItem.itemDescription}</div>
                </div>
              )}

              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="text-xs text-gray-400 mb-1">Condition</div>
                  <div className="text-white text-sm capitalize">{condition}</div>
                </div>
                {reason && (
                  <div className="flex-1">
                    <div className="text-xs text-gray-400 mb-1">Reason</div>
                    <div className="text-white text-sm truncate">{reason}</div>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="mr-quantity" className="text-xs text-gray-400 block mb-1">
                  Quantity to Return
                </label>
                <input
                  id="mr-quantity"
                  type="number"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  placeholder="Enter quantity"
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:border-nesma-secondary/50"
                  autoFocus
                />
              </div>
            </div>

            {submitError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                <AlertCircle size={16} />
                Failed to submit return. Please try again.
              </div>
            )}

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-nesma-dark/95 backdrop-blur-xl border-t border-white/10">
              <button
                onClick={handleSubmit}
                disabled={!quantity}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all text-lg flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={20} />
                Submit Return
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
              {queuedOffline ? 'Queued for Sync' : 'Return Submitted!'}
            </h2>
            <p className="text-sm text-gray-400 mb-6">
              {queuedOffline
                ? 'Return saved offline. It will sync automatically when you reconnect.'
                : 'The material return has been submitted successfully.'}
            </p>
            <button
              onClick={resetFlow}
              className="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-xl transition-all"
            >
              Return Another Item
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
