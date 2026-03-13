import { useState, useCallback, useMemo } from 'react';
import { Trash2, CheckCircle2, ScanLine, ArrowLeft, AlertCircle } from 'lucide-react';
import BarcodeScanner from '@/components/BarcodeScanner';
import { FileUploadZone } from '@/components/FileUploadZone';
import type { UploadedFile } from '@/components/FileUploadZone';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { OfflineQueueBanner } from '@/components/OfflineQueueBanner';
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator';
import { SwipeableSteps } from '@/components/SwipeableSteps';

type Step = 'scan' | 'condition' | 'quantity' | 'done';
type ScrapCondition = 'obsolete' | 'damaged-beyond-repair' | 'expired' | 'contaminated' | 'worn-out';

interface ScannedItem {
  id: string;
  itemCode: string;
  itemDescription: string;
}

export function MobileScrapDispose() {
  const [step, setStep] = useState<Step>('scan');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedItem, setScannedItem] = useState<ScannedItem | null>(null);
  const [condition, setCondition] = useState<ScrapCondition | null>(null);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);
  const [queuedOffline, setQueuedOffline] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const { enqueueTransaction, isOnline } = useOfflineQueue();

  const STEPS: Step[] = ['scan', 'condition', 'quantity', 'done'];
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
    setStep('condition');
  }, []);

  const conditionOptions: { value: ScrapCondition; label: string; desc: string }[] = [
    { value: 'obsolete', label: 'Obsolete', desc: 'No longer needed or superseded' },
    { value: 'damaged-beyond-repair', label: 'Damaged Beyond Repair', desc: 'Cannot be restored to usable state' },
    { value: 'expired', label: 'Expired', desc: 'Past shelf life or expiry date' },
    { value: 'contaminated', label: 'Contaminated', desc: 'Contaminated or hazardous' },
    { value: 'worn-out', label: 'Worn Out', desc: 'Exceeded useful life through normal use' },
  ];

  const handleSubmit = async () => {
    if (!scannedItem || !condition || !quantity) return;
    setSubmitError(false);

    try {
      await enqueueTransaction('scrap-dispose', {
        itemId: scannedItem.id,
        itemCode: scannedItem.itemCode,
        quantity: Number(quantity),
        condition,
        notes,
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
    setScannedItem(null);
    setCondition(null);
    setQuantity('');
    setNotes('');
    setAttachments([]);
    setQueuedOffline(false);
    setSubmitError(false);
  };

  return (
    <div className="min-h-screen bg-nesma-dark p-4 pb-24">
      <OfflineQueueBanner />

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 rounded-xl bg-red-600/20">
          <Trash2 size={22} className="text-red-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">Scrap Disposal</h1>
          <p className="text-xs text-gray-400">Scan item to dispose as scrap</p>
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
              <ScanLine size={48} className="text-red-400 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-white mb-2">Scan Item Barcode</h2>
              <p className="text-sm text-gray-400 mb-6">Scan the item to be disposed as scrap</p>
              <button
                onClick={() => setScannerOpen(true)}
                className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-all text-lg"
              >
                Open Scanner
              </button>
            </div>

            {scannedItem && (
              <div className="glass-card rounded-2xl p-5 border border-red-500/20 bg-red-500/5">
                <div className="text-sm text-red-400 mb-1">Item Found</div>
                <div className="text-white font-semibold">{scannedItem.itemDescription}</div>
                <div className="text-sm text-gray-400 mt-1">Code: {scannedItem.itemCode}</div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Condition Select */}
        {step === 'condition' && (
          <div className="space-y-4">
            <button
              onClick={() => setStep('scan')}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={16} /> Back
            </button>

            {scannedItem && (
              <div className="glass-card rounded-2xl p-4 border border-red-500/20 bg-red-500/5">
                <div className="text-xs text-red-400 mb-1">Item for Disposal</div>
                <div className="text-white font-semibold">{scannedItem.itemDescription}</div>
                <div className="text-sm text-gray-400">{scannedItem.itemCode}</div>
              </div>
            )}

            <h2 className="text-lg font-semibold text-white">Select Condition</h2>

            <div className="space-y-3">
              {conditionOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setCondition(opt.value);
                    setStep('quantity');
                  }}
                  className={`w-full text-left glass-card rounded-xl p-4 border transition-all ${
                    condition === opt.value
                      ? 'border-red-500/50 bg-red-500/10'
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

        {/* Step 3: Quantity & Submit */}
        {step === 'quantity' && (
          <div className="space-y-4">
            <button
              onClick={() => setStep('condition')}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={16} /> Back
            </button>

            <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-4">
              <h2 className="text-lg font-semibold text-white">Disposal Details</h2>

              {scannedItem && (
                <div>
                  <div className="text-xs text-gray-400 mb-1">Item</div>
                  <div className="text-white">{scannedItem.itemDescription}</div>
                  <div className="text-sm text-gray-400">{scannedItem.itemCode}</div>
                </div>
              )}

              <div>
                <div className="text-xs text-gray-400 mb-1">Condition</div>
                <div className="text-white text-sm">{conditionOptions.find(o => o.value === condition)?.label}</div>
              </div>

              <div>
                <label htmlFor="scrap-quantity" className="text-xs text-gray-400 block mb-1">
                  Quantity to Dispose
                </label>
                <input
                  id="scrap-quantity"
                  type="number"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  placeholder="Enter quantity"
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:border-nesma-secondary/50"
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="scrap-notes" className="text-xs text-gray-400 block mb-1">
                  Notes (optional)
                </label>
                <textarea
                  id="scrap-notes"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Additional details..."
                  rows={3}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-nesma-secondary/50 resize-none"
                />
              </div>
            </div>

            {/* Condition Photos */}
            <div className="glass-card rounded-2xl p-4 border border-white/10">
              <h3 className="text-sm font-semibold text-white mb-3">Condition Photos</h3>
              <FileUploadZone
                entityType="scrap"
                entityId={scannedItem?.id}
                maxFiles={10}
                acceptedTypes=".jpg,.jpeg,.png,.pdf"
                files={attachments}
                onFilesChange={setAttachments}
              />
            </div>

            {submitError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                <AlertCircle size={16} />
                Failed to submit disposal. Please try again.
              </div>
            )}

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-nesma-dark/95 backdrop-blur-xl border-t border-white/10">
              <button
                onClick={handleSubmit}
                disabled={!quantity}
                className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all text-lg flex items-center justify-center gap-2"
              >
                <Trash2 size={20} />
                Confirm Disposal
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
              {queuedOffline ? 'Queued for Sync' : 'Disposal Recorded!'}
            </h2>
            <p className="text-sm text-gray-400 mb-6">
              {queuedOffline
                ? 'Disposal saved offline. It will sync automatically when you reconnect.'
                : 'The scrap disposal has been recorded successfully.'}
            </p>
            <button
              onClick={resetFlow}
              className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-all"
            >
              Dispose Another Item
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
