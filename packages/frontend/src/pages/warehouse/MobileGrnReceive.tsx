import { useState, useCallback, useMemo } from 'react';
import { Package, CheckCircle2, ScanLine, ArrowLeft, Loader2, AlertCircle, MapPin } from 'lucide-react';
import BarcodeScanner from '@/components/BarcodeScanner';
import { useGrnList, useReceiveGrn } from '@/api/hooks';
import { useBarcodeLookup } from '@/api/hooks/useBarcodes';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { OfflineQueueBanner } from '@/components/OfflineQueueBanner';
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator';
import { SwipeableSteps } from '@/components/SwipeableSteps';

type Step = 'scan' | 'select-grn' | 'confirm' | 'done';

interface ScannedItem {
  id: string;
  itemCode: string;
  itemDescription: string;
  barcode?: string;
}

export function MobileGrnReceive() {
  const [step, setStep] = useState<Step>('scan');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedCode, setScannedCode] = useState('');
  const [scannedItem, setScannedItem] = useState<ScannedItem | null>(null);
  const [selectedGrnId, setSelectedGrnId] = useState<string | null>(null);
  const [receivedQty, setReceivedQty] = useState('');
  const [queuedOffline, setQueuedOffline] = useState(false);

  const { enqueueTransaction, isOnline } = useOfflineQueue();

  const STEPS: Step[] = ['scan', 'select-grn', 'confirm', 'done'];
  const stepIndex = useMemo(() => STEPS.indexOf(step), [step]);
  const handleStepChange = useCallback((index: number) => {
    if (index >= 0 && index < STEPS.length) setStep(STEPS[index]);
  }, []);

  // Fetch pending GRNs that can be received
  const grnListQuery = useGrnList({ status: 'approved', page: 1, pageSize: 50 } as Record<string, unknown>);
  const grnList = (grnListQuery.data as unknown as { data?: Array<Record<string, unknown>> })?.data ?? [];

  const receiveMutation = useReceiveGrn();

  const handleScan = useCallback((code: string) => {
    setScannedCode(code);
    setScannerOpen(false);
  }, []);

  const handleItemFound = useCallback((item: Record<string, unknown>) => {
    setScannedItem({
      id: item.id as string,
      itemCode: item.itemCode as string,
      itemDescription: item.itemDescription as string,
      barcode: item.barcode as string | undefined,
    });
    setScannerOpen(false);
    setStep('select-grn');
  }, []);

  const handleReceive = async () => {
    if (!selectedGrnId) return;

    if (!isOnline) {
      await enqueueTransaction('grn-receive', {
        grnId: selectedGrnId,
        itemId: scannedItem?.id,
        quantity: receivedQty ? Number(receivedQty) : undefined,
      });
      setQueuedOffline(true);
      setStep('done');
      return;
    }

    try {
      await receiveMutation.mutateAsync(selectedGrnId);
      setQueuedOffline(false);
      setStep('done');
    } catch {
      // Error handled by mutation state
    }
  };

  const resetFlow = () => {
    setStep('scan');
    setScannedCode('');
    setScannedItem(null);
    setSelectedGrnId(null);
    setReceivedQty('');
    setQueuedOffline(false);
  };

  return (
    <div className="min-h-screen bg-[#0a1929] p-4 pb-24">
      {/* Offline Queue Banner */}
      <OfflineQueueBanner />

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 rounded-xl bg-blue-600/20">
          <Package size={22} className="text-blue-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">GRN Receive</h1>
          <p className="text-xs text-gray-400">Scan barcode to receive goods</p>
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
              <ScanLine size={48} className="text-nesma-secondary mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-white mb-2">Scan Item Barcode</h2>
              <p className="text-sm text-gray-400 mb-6">Scan the barcode on the received item to identify it</p>
              <button
                onClick={() => setScannerOpen(true)}
                className="w-full py-4 bg-nesma-primary hover:bg-nesma-accent text-white font-semibold rounded-xl transition-all text-lg"
              >
                Open Scanner
              </button>
            </div>

            {scannedItem && (
              <div className="glass-card rounded-2xl p-5 border border-emerald-500/20 bg-emerald-500/5">
                <div className="text-sm text-emerald-400 mb-1">Item Found</div>
                <div className="text-white font-semibold">{scannedItem.itemDescription}</div>
                <div className="text-sm text-gray-400 mt-1">Code: {scannedItem.itemCode}</div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Select GRN */}
        {step === 'select-grn' && (
          <div className="space-y-4">
            <button
              onClick={() => setStep('scan')}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={16} /> Back to scan
            </button>

            {scannedItem && (
              <div className="glass-card rounded-2xl p-4 border border-white/10">
                <div className="text-xs text-gray-400">Scanned Item</div>
                <div className="text-white font-semibold">{scannedItem.itemDescription}</div>
                <div className="text-sm text-gray-400">Code: {scannedItem.itemCode}</div>
              </div>
            )}

            <h2 className="text-lg font-semibold text-white">Select GRN to Receive</h2>

            {grnListQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 size={24} className="text-gray-400 animate-spin" />
              </div>
            ) : grnList.length === 0 ? (
              <div className="glass-card rounded-2xl p-6 text-center border border-white/10">
                <AlertCircle size={32} className="text-gray-500 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">No approved GRNs available for receiving</p>
              </div>
            ) : (
              <div className="space-y-3">
                {grnList.map(grn => (
                  <button
                    key={grn.id as string}
                    onClick={() => {
                      setSelectedGrnId(grn.id as string);
                      setStep('confirm');
                    }}
                    className={`w-full text-left glass-card rounded-xl p-4 border transition-all ${
                      selectedGrnId === grn.id ? 'border-nesma-secondary' : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white font-semibold text-sm">
                          {(grn.documentNumber as string) || (grn.id as string)}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {(grn.supplierName as string) || 'Unknown supplier'}
                        </div>
                      </div>
                      <div className="text-xs text-nesma-secondary bg-nesma-secondary/10 px-2 py-1 rounded-lg">
                        {grn.status as string}
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
              onClick={() => setStep('select-grn')}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={16} /> Back
            </button>

            <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-4">
              <h2 className="text-lg font-semibold text-white">Confirm Receipt</h2>

              {scannedItem && (
                <div>
                  <div className="text-xs text-gray-400 mb-1">Item</div>
                  <div className="text-white">{scannedItem.itemDescription}</div>
                  <div className="text-sm text-gray-400">{scannedItem.itemCode}</div>
                </div>
              )}

              <div>
                <label className="text-xs text-gray-400 block mb-1">Received Quantity</label>
                <input
                  type="number"
                  value={receivedQty}
                  onChange={e => setReceivedQty(e.target.value)}
                  placeholder="Enter quantity"
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:border-nesma-secondary/50"
                  autoFocus
                />
              </div>
            </div>

            {receiveMutation.isError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                <AlertCircle size={16} />
                Failed to receive GRN. Please try again.
              </div>
            )}

            {/* Fixed bottom action */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#0a1929]/95 backdrop-blur-xl border-t border-white/10">
              <button
                onClick={handleReceive}
                disabled={receiveMutation.isPending}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all text-lg flex items-center justify-center gap-2"
              >
                {receiveMutation.isPending ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={20} />
                )}
                Confirm Receipt
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
              {queuedOffline ? 'Queued for Sync' : 'Receipt Confirmed!'}
            </h2>
            <p className="text-sm text-gray-400 mb-6">
              {queuedOffline
                ? 'Receipt saved offline. It will sync automatically when you reconnect.'
                : 'The GRN has been successfully received.'}
            </p>
            <button
              onClick={resetFlow}
              className="px-6 py-3 bg-nesma-primary hover:bg-nesma-accent text-white font-semibold rounded-xl transition-all"
            >
              Scan Next Item
            </button>
          </div>
        )}
      </SwipeableSteps>

      {/* Barcode Scanner Modal */}
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
