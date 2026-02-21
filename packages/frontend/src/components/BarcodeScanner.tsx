import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Search, Package, Warehouse, Loader2, AlertCircle, ScanLine, Keyboard, Camera, X } from 'lucide-react';
import { useBarcodeLookup } from '@/api/hooks/useBarcodes';

interface BarcodeScannerProps {
  /** Legacy: called with raw scanned code */
  onScan?: (code: string) => void;
  onError?: (error: string) => void;
  isOpen: boolean;
  onClose: () => void;
  /** Called when item is found and user clicks "Select" */
  onItemFound?: (item: Record<string, unknown>) => void;
  /** Show item lookup results (default true) */
  showLookup?: boolean;
}

const SCANNER_ELEMENT_ID = 'barcode-scanner-region';

export default function BarcodeScanner({
  onScan,
  onError,
  isOpen,
  onClose,
  onItemFound,
  showLookup = true,
}: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const [manualCode, setManualCode] = useState('');
  const [scannedCode, setScannedCode] = useState<string | undefined>(undefined);

  const lookupQuery = useBarcodeLookup(showLookup ? scannedCode : undefined);
  const lookupData = (lookupQuery.data as { data?: Record<string, unknown> })?.data;

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2 /* SCANNING */ || state === 3 /* PAUSED */) {
          await scannerRef.current.stop();
        }
      } catch {
        // Ignore stop errors during cleanup
      }
      scannerRef.current.clear();
      scannerRef.current = null;
    }
  }, []);

  const handleDetection = useCallback(
    (code: string) => {
      setScannedCode(code);
      setManualCode(code);
      onScan?.(code);

      // If no lookup mode, just close
      if (!showLookup) {
        stopScanner();
        onClose();
      }
    },
    [onScan, showLookup, stopScanner, onClose],
  );

  useEffect(() => {
    if (!isOpen || mode !== 'camera') return;

    let cancelled = false;

    const startScanner = async () => {
      setIsStarting(true);
      try {
        const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
        scannerRef.current = scanner;

        if (cancelled) return;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          decodedText => {
            stopScanner();
            handleDetection(decodedText);
          },
          () => {
            // QR code not found in frame — ignore
          },
        );
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to start camera';
          onError?.(message);
        }
      } finally {
        if (!cancelled) setIsStarting(false);
      }
    };

    startScanner();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [isOpen, mode, handleDetection, onError, stopScanner]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setScannedCode(undefined);
      setManualCode('');
      setMode('camera');
    }
  }, [isOpen]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleDetection(manualCode.trim());
    }
  };

  const handleSelectItem = () => {
    if (lookupData && onItemFound) {
      onItemFound(lookupData);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 rounded-2xl border border-white/10 bg-nesma-dark/95 backdrop-blur-xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <ScanLine size={20} className="text-nesma-secondary" />
            <h3 className="text-lg font-bold text-white">Barcode Scanner</h3>
          </div>
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="p-2 rounded-xl bg-white/5 text-gray-400 hover:text-white transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-white/10">
          <button
            type="button"
            onClick={() => {
              stopScanner();
              setMode('camera');
            }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all ${
              mode === 'camera'
                ? 'text-nesma-secondary border-b-2 border-nesma-secondary'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Camera size={16} /> Camera
          </button>
          <button
            type="button"
            onClick={() => {
              stopScanner();
              setMode('manual');
            }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all ${
              mode === 'manual'
                ? 'text-nesma-secondary border-b-2 border-nesma-secondary'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Keyboard size={16} /> Manual
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Camera mode */}
          {mode === 'camera' && (
            <>
              <div
                id={SCANNER_ELEMENT_ID}
                className="overflow-hidden rounded-xl bg-black border border-white/10"
                style={{ minHeight: 250 }}
              />
              {isStarting && (
                <p className="text-center text-sm text-gray-400 flex items-center justify-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> Starting camera...
                </p>
              )}
              {!isStarting && !scannedCode && (
                <p className="text-center text-xs text-gray-500">Point the camera at a barcode or QR code</p>
              )}
            </>
          )}

          {/* Manual mode */}
          {mode === 'manual' && (
            <form onSubmit={handleManualSubmit} className="flex gap-3">
              <input
                type="text"
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                placeholder="Enter barcode or item code..."
                autoFocus
                className="flex-1 bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-nesma-secondary/50"
              />
              <button
                type="submit"
                disabled={!manualCode.trim() || lookupQuery.isLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-nesma-primary hover:bg-nesma-accent text-white text-sm font-medium rounded-lg disabled:opacity-40 transition-all"
              >
                {lookupQuery.isLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                Lookup
              </button>
            </form>
          )}

          {/* Scanned code display */}
          {scannedCode && (
            <div className="flex items-center gap-2 px-4 py-2 bg-nesma-secondary/10 border border-nesma-secondary/20 rounded-lg">
              <ScanLine size={14} className="text-nesma-secondary" />
              <span className="text-sm text-nesma-secondary font-mono">{scannedCode}</span>
            </div>
          )}

          {/* Lookup result */}
          {showLookup && scannedCode && (
            <>
              {lookupQuery.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="text-gray-400 animate-spin" />
                </div>
              ) : lookupQuery.isError ? (
                <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                  <AlertCircle size={16} />
                  No item found for code: {scannedCode}
                </div>
              ) : lookupData ? (
                <div className="glass-card rounded-xl p-5 border border-nesma-secondary/20 space-y-3">
                  <div className="flex items-center gap-3">
                    <Package size={20} className="text-nesma-secondary" />
                    <div>
                      <h4 className="text-white font-medium">
                        {String(lookupData.itemDescription || lookupData.itemCode || '')}
                      </h4>
                      <p className="text-xs text-gray-400 font-mono">{String(lookupData.itemCode || '')}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {Boolean(lookupData.barcode) && (
                      <div>
                        <span className="text-xs text-gray-500">Barcode</span>
                        <p className="text-white font-mono">{String(lookupData.barcode)}</p>
                      </div>
                    )}
                    {Boolean(lookupData.itemCategory) && (
                      <div>
                        <span className="text-xs text-gray-500">Category</span>
                        <p className="text-white">{String(lookupData.itemCategory)}</p>
                      </div>
                    )}
                    {Boolean(lookupData.unitPrice) && (
                      <div>
                        <span className="text-xs text-gray-500">Unit Price</span>
                        <p className="text-white">{Number(lookupData.unitPrice).toLocaleString()} SAR</p>
                      </div>
                    )}
                  </div>

                  {/* Inventory levels */}
                  {Array.isArray(lookupData.inventoryLevels) &&
                    (lookupData.inventoryLevels as Record<string, unknown>[]).length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1">
                          <Warehouse size={12} /> Stock Levels
                        </h4>
                        <div className="space-y-1">
                          {(lookupData.inventoryLevels as Record<string, unknown>[]).map((inv, idx) => {
                            const wh = inv.warehouse as Record<string, unknown> | undefined;
                            return (
                              <div
                                key={idx}
                                className="flex items-center justify-between px-3 py-2 bg-white/[0.02] rounded-lg text-xs"
                              >
                                <span className="text-gray-300">
                                  {String(wh?.warehouseName || wh?.warehouseCode || 'Unknown')}
                                </span>
                                <span className="text-white font-medium">{Number(inv.quantityOnHand || 0)} units</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                </div>
              ) : null}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-3">
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-white/10 rounded-lg hover:bg-white/5 transition-all"
          >
            Close
          </button>
          {lookupData && onItemFound && (
            <button
              onClick={handleSelectItem}
              className="flex items-center gap-2 px-5 py-2 bg-nesma-primary hover:bg-nesma-accent text-white text-sm font-medium rounded-lg transition-all"
            >
              <Package size={14} />
              Select Item
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
