import { useState, useCallback, useMemo } from 'react';
import { ArrowLeftRight, CheckCircle2, ScanLine, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import BarcodeScanner from '@/components/BarcodeScanner';
import { useWtList, useShipWt } from '@/api/hooks';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { OfflineQueueBanner } from '@/components/OfflineQueueBanner';
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator';
import { SwipeableSteps } from '@/components/SwipeableSteps';

type Step = 'scan' | 'select-wt' | 'confirm' | 'done';

interface ScannedItem {
  id: string;
  itemCode: string;
  itemDescription: string;
}

export function MobileWtTransfer() {
  const [step, setStep] = useState<Step>('scan');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedItem, setScannedItem] = useState<ScannedItem | null>(null);
  const [selectedWtId, setSelectedWtId] = useState<string | null>(null);
  const [transferQty, setTransferQty] = useState('');
  const [queuedOffline, setQueuedOffline] = useState(false);

  const { enqueueTransaction, isOnline } = useOfflineQueue();

  const STEPS: Step[] = ['scan', 'select-wt', 'confirm', 'done'];
  const stepIndex = useMemo(() => STEPS.indexOf(step), [step]);
  const handleStepChange = useCallback((index: number) => {
    if (index >= 0 && index < STEPS.length) setStep(STEPS[index]);
  }, []);

  // Fetch approved WTs ready for shipping
  const wtListQuery = useWtList({ status: 'approved', page: 1, pageSize: 50 } as Record<string, unknown>);
  const wtList = (wtListQuery.data as unknown as { data?: Array<Record<string, unknown>> })?.data ?? [];

  const shipMutation = useShipWt();

  const handleItemFound = useCallback((item: Record<string, unknown>) => {
    setScannedItem({
      id: item.id as string,
      itemCode: item.itemCode as string,
      itemDescription: item.itemDescription as string,
    });
    setScannerOpen(false);
    setStep('select-wt');
  }, []);

  const handleTransfer = async () => {
    if (!selectedWtId) return;

    if (!isOnline) {
      await enqueueTransaction('wt-transfer', {
        wtId: selectedWtId,
        itemId: scannedItem?.id,
        quantity: transferQty ? Number(transferQty) : undefined,
      });
      setQueuedOffline(true);
      setStep('done');
      return;
    }

    try {
      await shipMutation.mutateAsync(selectedWtId);
      setQueuedOffline(false);
      setStep('done');
    } catch {
      // Error handled by mutation state
    }
  };

  const resetFlow = () => {
    setStep('scan');
    setScannedItem(null);
    setSelectedWtId(null);
    setTransferQty('');
    setQueuedOffline(false);
  };

  return (
    <div className="min-h-screen bg-nesma-dark p-4 pb-24">
      {/* Offline Queue Banner */}
      <OfflineQueueBanner />

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 rounded-xl bg-amber-600/20">
          <ArrowLeftRight size={22} className="text-amber-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">Warehouse Transfer</h1>
          <p className="text-xs text-gray-400">Scan barcode to transfer items between warehouses</p>
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
                    : 'bg-white/10 text-gray-500'
              }`}
            >
              {i < stepIndex ? <CheckCircle2 size={16} /> : i + 1}
            </div>
            {i < 3 && <div className="w-6 h-px bg-white/10" />}
          </div>
        ))}
      </div>

      <SwipeableSteps currentStep={stepIndex} onStepChange={handleStepChange} totalSteps={STEPS.length}>
        {/* Step 1: Scan */}
        {step === 'scan' && (
          <div className="space-y-4">
            <div className="glass-card rounded-2xl p-6 border border-white/10 text-center">
              <ScanLine size={48} className="text-amber-400 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-white mb-2">Scan Item to Transfer</h2>
              <p className="text-sm text-gray-400 mb-6">Scan the item barcode to find matching Warehouse Transfers</p>
              <button
                onClick={() => setScannerOpen(true)}
                className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl transition-all text-lg"
              >
                Open Scanner
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Select WT */}
        {step === 'select-wt' && (
          <div className="space-y-4">
            <button
              onClick={() => setStep('scan')}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={16} /> Back
            </button>

            {scannedItem && (
              <div className="glass-card rounded-2xl p-4 border border-amber-500/20 bg-amber-500/5">
                <div className="text-xs text-amber-400 mb-1">Scanned Item</div>
                <div className="text-white font-semibold">{scannedItem.itemDescription}</div>
                <div className="text-sm text-gray-400">{scannedItem.itemCode}</div>
              </div>
            )}

            <h2 className="text-lg font-semibold text-white">Select Transfer</h2>

            {wtListQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 size={24} className="text-gray-400 animate-spin" />
              </div>
            ) : wtList.length === 0 ? (
              <div className="glass-card rounded-2xl p-6 text-center border border-white/10">
                <AlertCircle size={32} className="text-gray-500 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">No approved transfers available</p>
              </div>
            ) : (
              <div className="space-y-3">
                {wtList.map(wt => (
                  <button
                    key={wt.id as string}
                    onClick={() => {
                      setSelectedWtId(wt.id as string);
                      setStep('confirm');
                    }}
                    className="w-full text-left glass-card rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white font-semibold text-sm">
                          {(wt.documentNumber as string) || (wt.id as string)}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {(wt.fromWarehouseName as string) || '?'} → {(wt.toWarehouseName as string) || '?'}
                        </div>
                      </div>
                      <div className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg">
                        {wt.status as string}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <button
              onClick={() => setStep('select-wt')}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={16} /> Back
            </button>

            <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-4">
              <h2 className="text-lg font-semibold text-white">Confirm Transfer</h2>
              {scannedItem && (
                <div>
                  <div className="text-xs text-gray-400 mb-1">Item</div>
                  <div className="text-white">{scannedItem.itemDescription}</div>
                </div>
              )}
              <div>
                <label className="text-xs text-gray-400 block mb-1">Transfer Quantity</label>
                <input
                  type="number"
                  value={transferQty}
                  onChange={e => setTransferQty(e.target.value)}
                  placeholder="Enter quantity"
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:border-nesma-secondary/50"
                  autoFocus
                />
              </div>
            </div>

            {shipMutation.isError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                <AlertCircle size={16} />
                Failed to ship transfer. Please try again.
              </div>
            )}

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-nesma-dark/95 backdrop-blur-xl border-t border-white/10">
              <button
                onClick={handleTransfer}
                disabled={shipMutation.isPending}
                className="w-full py-4 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all text-lg flex items-center justify-center gap-2"
              >
                {shipMutation.isPending ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
                Confirm Transfer
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Done */}
        {step === 'done' && (
          <div
            className={`glass-card rounded-2xl p-8 border text-center ${
              queuedOffline ? 'border-amber-500/20 bg-amber-500/5' : 'border-amber-500/20 bg-amber-500/5'
            }`}
          >
            <CheckCircle2
              size={64}
              className={queuedOffline ? 'text-amber-400 mx-auto mb-4' : 'text-amber-400 mx-auto mb-4'}
            />
            <h2 className="text-xl font-bold text-white mb-2">
              {queuedOffline ? 'Queued for Sync' : 'Transfer Shipped!'}
            </h2>
            <p className="text-sm text-gray-400 mb-6">
              {queuedOffline
                ? 'Transfer saved offline. It will sync automatically when you reconnect.'
                : 'The warehouse transfer has been shipped.'}
            </p>
            <button
              onClick={resetFlow}
              className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl transition-all"
            >
              Transfer Next Item
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
