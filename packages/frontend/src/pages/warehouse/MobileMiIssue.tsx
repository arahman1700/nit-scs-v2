import { useState, useCallback } from 'react';
import { ArrowUpFromLine, CheckCircle2, ScanLine, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import BarcodeScanner from '@/components/BarcodeScanner';
import { useMiList, useIssueMi } from '@/api/hooks';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { OfflineQueueBanner } from '@/components/OfflineQueueBanner';

type Step = 'scan' | 'select-mi' | 'confirm' | 'done';

interface ScannedItem {
  id: string;
  itemCode: string;
  itemDescription: string;
}

export function MobileMiIssue() {
  const [step, setStep] = useState<Step>('scan');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedItem, setScannedItem] = useState<ScannedItem | null>(null);
  const [selectedMiId, setSelectedMiId] = useState<string | null>(null);
  const [issueQty, setIssueQty] = useState('');
  const [queuedOffline, setQueuedOffline] = useState(false);

  const { enqueueTransaction, isOnline } = useOfflineQueue();

  // Fetch approved MIs ready for issuance
  const miListQuery = useMiList({ status: 'approved', page: 1, pageSize: 50 } as Record<string, unknown>);
  const miList = (miListQuery.data as unknown as { data?: Array<Record<string, unknown>> })?.data ?? [];

  const issueMutation = useIssueMi();

  const handleItemFound = useCallback((item: Record<string, unknown>) => {
    setScannedItem({
      id: item.id as string,
      itemCode: item.itemCode as string,
      itemDescription: item.itemDescription as string,
    });
    setScannerOpen(false);
    setStep('select-mi');
  }, []);

  const handleIssue = async () => {
    if (!selectedMiId) return;

    if (!isOnline) {
      await enqueueTransaction('mi-issue', {
        miId: selectedMiId,
        itemId: scannedItem?.id,
        quantity: issueQty ? Number(issueQty) : undefined,
      });
      setQueuedOffline(true);
      setStep('done');
      return;
    }

    try {
      await issueMutation.mutateAsync(selectedMiId);
      setQueuedOffline(false);
      setStep('done');
    } catch {
      // Error handled by mutation state
    }
  };

  const resetFlow = () => {
    setStep('scan');
    setScannedItem(null);
    setSelectedMiId(null);
    setIssueQty('');
    setQueuedOffline(false);
  };

  return (
    <div className="min-h-screen bg-[#0a1929] p-4 pb-24">
      {/* Offline Queue Banner */}
      <OfflineQueueBanner />

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-emerald-600/20">
          <ArrowUpFromLine size={22} className="text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Material Issue</h1>
          <p className="text-xs text-gray-400">Scan barcode to issue materials</p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-6">
        {(['scan', 'select-mi', 'confirm', 'done'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                step === s
                  ? 'bg-nesma-secondary text-white'
                  : i < ['scan', 'select-mi', 'confirm', 'done'].indexOf(step)
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white/10 text-gray-500'
              }`}
            >
              {i < ['scan', 'select-mi', 'confirm', 'done'].indexOf(step) ? <CheckCircle2 size={16} /> : i + 1}
            </div>
            {i < 3 && <div className="w-6 h-px bg-white/10" />}
          </div>
        ))}
      </div>

      {/* Step 1: Scan */}
      {step === 'scan' && (
        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-6 border border-white/10 text-center">
            <ScanLine size={48} className="text-emerald-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">Scan Item to Issue</h2>
            <p className="text-sm text-gray-400 mb-6">Scan the item barcode to find matching Material Issuances</p>
            <button
              onClick={() => setScannerOpen(true)}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all text-lg"
            >
              Open Scanner
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Select MI */}
      {step === 'select-mi' && (
        <div className="space-y-4">
          <button
            onClick={() => setStep('scan')}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} /> Back
          </button>

          {scannedItem && (
            <div className="glass-card rounded-2xl p-4 border border-emerald-500/20 bg-emerald-500/5">
              <div className="text-xs text-emerald-400 mb-1">Scanned Item</div>
              <div className="text-white font-semibold">{scannedItem.itemDescription}</div>
              <div className="text-sm text-gray-400">{scannedItem.itemCode}</div>
            </div>
          )}

          <h2 className="text-lg font-semibold text-white">Select MI to Issue</h2>

          {miListQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={24} className="text-gray-400 animate-spin" />
            </div>
          ) : miList.length === 0 ? (
            <div className="glass-card rounded-2xl p-6 text-center border border-white/10">
              <AlertCircle size={32} className="text-gray-500 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No approved Material Issuances available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {miList.map(mi => (
                <button
                  key={mi.id as string}
                  onClick={() => {
                    setSelectedMiId(mi.id as string);
                    setStep('confirm');
                  }}
                  className="w-full text-left glass-card rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-semibold text-sm">
                        {(mi.documentNumber as string) || (mi.id as string)}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{(mi.projectName as string) || 'No project'}</div>
                    </div>
                    <div className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">
                      {mi.status as string}
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
            onClick={() => setStep('select-mi')}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} /> Back
          </button>

          <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-4">
            <h2 className="text-lg font-semibold text-white">Confirm Issuance</h2>
            {scannedItem && (
              <div>
                <div className="text-xs text-gray-400 mb-1">Item</div>
                <div className="text-white">{scannedItem.itemDescription}</div>
              </div>
            )}
            <div>
              <label className="text-xs text-gray-400 block mb-1">Issue Quantity</label>
              <input
                type="number"
                value={issueQty}
                onChange={e => setIssueQty(e.target.value)}
                placeholder="Enter quantity"
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:border-nesma-secondary/50"
                autoFocus
              />
            </div>
          </div>

          {issueMutation.isError && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
              <AlertCircle size={16} />
              Failed to issue material. Please try again.
            </div>
          )}

          <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#0a1929]/95 backdrop-blur-xl border-t border-white/10">
            <button
              onClick={handleIssue}
              disabled={issueMutation.isPending}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all text-lg flex items-center justify-center gap-2"
            >
              {issueMutation.isPending ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
              Confirm Issue
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
            {queuedOffline ? 'Queued for Sync' : 'Material Issued!'}
          </h2>
          <p className="text-sm text-gray-400 mb-6">
            {queuedOffline
              ? 'Issuance saved offline. It will sync automatically when you reconnect.'
              : 'The material has been successfully issued.'}
          </p>
          <button
            onClick={resetFlow}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all"
          >
            Issue Next Item
          </button>
        </div>
      )}

      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onItemFound={handleItemFound}
        showLookup
      />
    </div>
  );
}
