import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { ApiResponse } from '../api/types';

interface BarcodeLabelPrintProps {
  itemIds: string[];
  onClose: () => void;
}

interface ItemLabel {
  id: string;
  itemCode: string;
  itemDescription: string;
  barcode: string | null;
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function BarcodeLabelPrint({ itemIds, onClose }: BarcodeLabelPrintProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['barcode-labels', itemIds],
    queryFn: async () => {
      // Fetch items individually or use a batch endpoint
      const results: ItemLabel[] = [];
      for (const id of itemIds) {
        const { data: resp } = await apiClient.get<ApiResponse<ItemLabel>>(`/items/${id}`);
        if (resp.data) results.push(resp.data);
      }
      return results;
    },
    enabled: itemIds.length > 0,
  });

  const items = data ?? [];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 print:static print:bg-white">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-white/10 bg-[#0a1929] p-6 print:max-h-none print:border-none print:bg-white print:p-0">
        {/* Header — hidden in print */}
        <div className="mb-4 flex items-center justify-between print:hidden">
          <h3 className="text-lg font-semibold text-white">Print Barcode Labels</h3>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              disabled={items.length === 0}
              className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
            >
              Print
            </button>
            <button
              onClick={onClose}
              className="rounded px-3 py-1.5 text-sm text-white/70 hover:bg-white/10 hover:text-white"
            >
              Close
            </button>
          </div>
        </div>

        {isLoading && <p className="text-center text-white/60 print:text-black">Loading items...</p>}

        {error && <p className="text-center text-red-400 print:text-red-600">Failed to load items.</p>}

        {/* Labels Grid */}
        <div className="flex flex-wrap justify-center gap-4 print:gap-2">
          {items.map(item => {
            const barcodeData = item.barcode || item.itemCode;
            const barcodeUrl = `${API_BASE}/barcodes/generate?type=code128&data=${encodeURIComponent(barcodeData)}`;

            return (
              <div
                key={item.id}
                className="w-72 rounded border border-white/10 bg-[#0d2137] p-4 text-center print:border-black print:bg-white"
                style={{ pageBreakInside: 'avoid' }}
              >
                <img src={barcodeUrl} alt={`Barcode: ${barcodeData}`} className="mx-auto mb-2 max-w-[260px]" />
                <p className="text-sm font-semibold text-white print:text-black">{item.itemDescription}</p>
                <p className="mt-1 text-xs text-white/60 print:text-gray-600">Code: {item.itemCode}</p>
                <p className="text-xs text-white/60 print:text-gray-600">Barcode: {barcodeData}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
