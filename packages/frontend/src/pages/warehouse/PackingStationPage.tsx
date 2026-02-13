import React, { useState, Suspense } from 'react';
import {
  Package,
  PackageCheck,
  Plus,
  CheckCircle2,
  XCircle,
  Loader2,
  ScanLine,
  Box,
  Scale,
  Ruler,
  Hash,
} from 'lucide-react';
import {
  usePackingQueue,
  usePackingSession,
  useCreatePackingSession,
  useAddPackingLine,
  useCompletePackingSession,
  useCancelPackingSession,
} from '@/api/hooks/usePacking';
import type { PackingQueueItem, PackingLine } from '@/api/hooks/usePacking';
import { useWarehouses } from '@/api/hooks/useMasterData';

const BarcodeScanner = React.lazy(() => import('@/components/BarcodeScanner'));

// ── Status Config ───────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  in_progress: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'In Progress' },
  completed: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Completed' },
  cancelled: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Cancelled' },
};

const CONTAINER_TYPES = [
  { value: 'carton', label: 'Carton' },
  { value: 'pallet', label: 'Pallet' },
  { value: 'crate', label: 'Crate' },
  { value: 'loose', label: 'Loose' },
];

// ── Component ───────────────────────────────────────────────────────────

export function PackingStationPage() {
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Line form state
  const [lineForm, setLineForm] = useState({
    itemId: '',
    itemLabel: '',
    qtyPacked: 1,
    containerType: 'carton',
    containerLabel: '',
    weight: '',
    volume: '',
    scannedBarcode: '',
  });

  // Queries
  const { data: warehousesRes } = useWarehouses();
  const warehouses =
    (warehousesRes as unknown as { data?: Array<{ id: string; warehouseName: string; warehouseCode: string }> })
      ?.data ?? [];

  const { data: queueRes, isLoading: queueLoading } = usePackingQueue(selectedWarehouse || undefined);
  const queue = (queueRes as unknown as { data?: PackingQueueItem[] })?.data ?? [];

  const { data: sessionRes, isLoading: sessionLoading } = usePackingSession(activeSessionId ?? undefined);
  const session = (sessionRes as unknown as { data?: Record<string, unknown> })?.data as
    | (Record<string, unknown> & {
        sessionNumber: string;
        status: string;
        mirv: { mirvNumber: string; project: { projectName: string } };
        lines: PackingLine[];
        cartonCount: number;
        palletCount: number;
      })
    | undefined;

  // Mutations
  const createSession = useCreatePackingSession();
  const addLine = useAddPackingLine();
  const completeSession = useCompletePackingSession();
  const cancelSession = useCancelPackingSession();

  const handleStartSession = (mirvId: string) => {
    if (!selectedWarehouse) return;
    createSession.mutate(
      { mirvId, packedById: 'current-user', warehouseId: selectedWarehouse },
      {
        onSuccess: res => {
          const data = (res as unknown as { data?: { id: string } })?.data;
          if (data?.id) setActiveSessionId(data.id);
        },
      },
    );
  };

  const handleAddLine = () => {
    if (!activeSessionId || !lineForm.itemId) return;
    addLine.mutate(
      {
        sessionId: activeSessionId,
        itemId: lineForm.itemId,
        qtyPacked: lineForm.qtyPacked,
        containerType: lineForm.containerType,
        containerLabel: lineForm.containerLabel || undefined,
        weight: lineForm.weight ? Number(lineForm.weight) : undefined,
        volume: lineForm.volume ? Number(lineForm.volume) : undefined,
        scannedBarcode: lineForm.scannedBarcode || undefined,
      },
      {
        onSuccess: () => {
          setLineForm({
            itemId: '',
            itemLabel: '',
            qtyPacked: 1,
            containerType: 'carton',
            containerLabel: '',
            weight: '',
            volume: '',
            scannedBarcode: '',
          });
        },
      },
    );
  };

  const handleComplete = () => {
    if (!activeSessionId) return;
    completeSession.mutate(activeSessionId, {
      onSuccess: () => setActiveSessionId(null),
    });
  };

  const handleCancel = () => {
    if (!activeSessionId) return;
    cancelSession.mutate(activeSessionId, {
      onSuccess: () => setActiveSessionId(null),
    });
  };

  const handleBarcodeScan = (code: string) => {
    setLineForm(f => ({ ...f, scannedBarcode: code }));
    setScannerOpen(false);
  };

  const handleItemFound = (item: Record<string, unknown>) => {
    setLineForm(f => ({
      ...f,
      itemId: (item.id as string) || '',
      itemLabel: `${item.itemCode || ''} - ${item.itemDescription || ''}`,
    }));
    setScannerOpen(false);
  };

  const statusCfg = session ? STATUS_CONFIG[session.status] || STATUS_CONFIG.in_progress : STATUS_CONFIG.in_progress;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <PackageCheck size={28} className="text-nesma-secondary" />
            Packing Station
          </h1>
          <p className="text-sm text-gray-400 mt-1">Pack approved material issuances for dispatch</p>
        </div>
        <select
          className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white min-w-[240px]"
          value={selectedWarehouse}
          onChange={e => {
            setSelectedWarehouse(e.target.value);
            setActiveSessionId(null);
          }}
        >
          <option value="" className="bg-nesma-dark">
            Select Warehouse
          </option>
          {warehouses.map(w => (
            <option key={w.id} value={w.id} className="bg-nesma-dark">
              {w.warehouseCode} - {w.warehouseName}
            </option>
          ))}
        </select>
      </div>

      {!selectedWarehouse ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <Package size={48} className="text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">Select a warehouse to view the packing queue</p>
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Left Panel — Queue */}
          <div className="w-1/3 space-y-4">
            <div className="glass-card rounded-2xl p-4">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Package size={20} className="text-nesma-secondary" />
                Packing Queue
                {queue.length > 0 && (
                  <span className="ml-auto text-xs bg-nesma-primary/30 text-nesma-secondary px-2 py-0.5 rounded-full">
                    {queue.length}
                  </span>
                )}
              </h2>

              {queueLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="text-nesma-secondary animate-spin" />
                </div>
              ) : queue.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 size={32} className="text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">All MIs packed</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
                  {queue.map(mi => (
                    <button
                      key={mi.id}
                      onClick={() => handleStartSession(mi.id)}
                      disabled={createSession.isPending}
                      className="w-full text-left glass-card rounded-xl p-3 hover:bg-white/10 transition-all duration-300 border border-white/5 hover:border-nesma-secondary/30"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-white">{mi.mirvNumber}</span>
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Approved</span>
                      </div>
                      <p className="text-xs text-gray-400">{mi.project?.projectName}</p>
                      <p className="text-xs text-gray-500 mt-1">{mi.mirvLines?.length ?? 0} items</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Main Area — Active Session */}
          <div className="w-2/3">
            {!activeSessionId ? (
              <div className="glass-card rounded-2xl p-12 text-center">
                <ScanLine size={48} className="text-gray-500 mx-auto mb-4" />
                <p className="text-lg text-gray-400">Select an MI from the queue to start packing</p>
                <p className="text-sm text-gray-500 mt-2">
                  Click on any approved MI in the queue to create a new packing session
                </p>
              </div>
            ) : sessionLoading ? (
              <div className="glass-card rounded-2xl p-12 flex items-center justify-center">
                <Loader2 size={32} className="text-nesma-secondary animate-spin" />
              </div>
            ) : session ? (
              <div className="space-y-4">
                {/* Session Header */}
                <div className="glass-card rounded-2xl p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-lg font-semibold text-white">{session.sessionNumber}</h2>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.text}`}
                        >
                          {statusCfg.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">
                        MI: {session.mirv?.mirvNumber} | Project: {session.mirv?.project?.projectName}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-400">
                      <div className="flex items-center gap-1">
                        <Box size={16} className="text-nesma-secondary" />
                        <span>{session.cartonCount} cartons</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Package size={16} className="text-nesma-secondary" />
                        <span>{session.palletCount} pallets</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Add Line Form */}
                {session.status === 'in_progress' && (
                  <div className="glass-card rounded-2xl p-6">
                    <h3 className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
                      <Plus size={16} />
                      Add Packing Line
                    </h3>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Item + Barcode */}
                      <div className="col-span-2">
                        <label className="text-xs text-gray-500 mb-1 block">Item</label>
                        <div className="flex gap-2">
                          <input
                            className="input-field w-full"
                            placeholder="Scan or select item..."
                            value={lineForm.itemLabel}
                            readOnly
                          />
                          <button
                            onClick={() => setScannerOpen(true)}
                            className="btn-primary px-3 flex items-center gap-1 shrink-0"
                            aria-label="Scan barcode"
                          >
                            <ScanLine size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Qty */}
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Qty Packed</label>
                        <div className="relative">
                          <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                          <input
                            type="number"
                            min={1}
                            className="input-field w-full pl-8"
                            value={lineForm.qtyPacked}
                            onChange={e => setLineForm(f => ({ ...f, qtyPacked: Number(e.target.value) }))}
                          />
                        </div>
                      </div>

                      {/* Container Type */}
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Container</label>
                        <select
                          className="input-field w-full"
                          value={lineForm.containerType}
                          onChange={e => setLineForm(f => ({ ...f, containerType: e.target.value }))}
                        >
                          {CONTAINER_TYPES.map(ct => (
                            <option key={ct.value} value={ct.value} className="bg-nesma-dark">
                              {ct.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Container Label */}
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Container Label</label>
                        <input
                          className="input-field w-full"
                          placeholder="e.g. CTN-001"
                          value={lineForm.containerLabel}
                          onChange={e => setLineForm(f => ({ ...f, containerLabel: e.target.value }))}
                        />
                      </div>

                      {/* Weight */}
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Weight (kg)</label>
                        <div className="relative">
                          <Scale size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                          <input
                            type="number"
                            step="0.01"
                            className="input-field w-full pl-8"
                            placeholder="0.00"
                            value={lineForm.weight}
                            onChange={e => setLineForm(f => ({ ...f, weight: e.target.value }))}
                          />
                        </div>
                      </div>

                      {/* Volume */}
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Volume (m3)</label>
                        <div className="relative">
                          <Ruler size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                          <input
                            type="number"
                            step="0.001"
                            className="input-field w-full pl-8"
                            placeholder="0.000"
                            value={lineForm.volume}
                            onChange={e => setLineForm(f => ({ ...f, volume: e.target.value }))}
                          />
                        </div>
                      </div>

                      {/* Add button */}
                      <div className="flex items-end">
                        <button
                          onClick={handleAddLine}
                          disabled={!lineForm.itemId || addLine.isPending}
                          className="btn-primary w-full flex items-center justify-center gap-2"
                        >
                          {addLine.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                          Add Line
                        </button>
                      </div>
                    </div>

                    {lineForm.scannedBarcode && (
                      <p className="text-xs text-gray-500 mt-2">
                        Barcode: <span className="text-nesma-secondary">{lineForm.scannedBarcode}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Packed Lines Table */}
                <div className="glass-card rounded-2xl p-6">
                  <h3 className="text-sm font-medium text-gray-400 mb-4">
                    Packed Lines ({session.lines?.length ?? 0})
                  </h3>
                  {!session.lines || session.lines.length === 0 ? (
                    <p className="text-center text-gray-500 py-6 text-sm">No lines packed yet</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-white/10">
                            <th className="text-left py-2 px-3">#</th>
                            <th className="text-left py-2 px-3">Item</th>
                            <th className="text-right py-2 px-3">Qty</th>
                            <th className="text-left py-2 px-3">Container</th>
                            <th className="text-left py-2 px-3">Label</th>
                            <th className="text-right py-2 px-3">Weight</th>
                            <th className="text-right py-2 px-3">Volume</th>
                          </tr>
                        </thead>
                        <tbody>
                          {session.lines.map((line, idx) => (
                            <tr key={line.id} className="border-b border-white/5 hover:bg-white/5 transition-all">
                              <td className="py-2 px-3 text-gray-500">{idx + 1}</td>
                              <td className="py-2 px-3 text-white">
                                <div className="text-white">{line.item?.itemCode}</div>
                                <div className="text-xs text-gray-500">{line.item?.itemDescription}</div>
                              </td>
                              <td className="py-2 px-3 text-right text-white">{line.qtyPacked}</td>
                              <td className="py-2 px-3">
                                <span className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-gray-300 capitalize">
                                  {line.containerType}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-gray-300">{line.containerLabel || '-'}</td>
                              <td className="py-2 px-3 text-right text-gray-300">
                                {line.weight ? `${line.weight} kg` : '-'}
                              </td>
                              <td className="py-2 px-3 text-right text-gray-300">
                                {line.volume ? `${line.volume} m3` : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                {session.status === 'in_progress' && (
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={handleCancel}
                      disabled={cancelSession.isPending}
                      className="flex items-center gap-2 px-5 py-2.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all duration-300"
                    >
                      {cancelSession.isPending ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                      Cancel Session
                    </button>
                    <button
                      onClick={handleComplete}
                      disabled={completeSession.isPending || !session.lines?.length}
                      className="btn-primary flex items-center gap-2"
                    >
                      {completeSession.isPending ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={16} />
                      )}
                      Complete Session
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      <Suspense fallback={null}>
        <BarcodeScanner
          isOpen={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onScan={handleBarcodeScan}
          onItemFound={handleItemFound}
        />
      </Suspense>
    </div>
  );
}
