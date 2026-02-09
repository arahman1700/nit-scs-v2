import React from 'react';
import { Package, MapPin, Calendar } from 'lucide-react';

interface BinCardWidgetProps {
  binNumber: string; // format: zone-aisle-shelf e.g. "A-03-12"
  itemName: string;
  currentQty: number;
  uom?: string;
  lastVerifiedAt?: string | null;
  lastVerifiedBy?: string | null;
}

export const BinCardWidget: React.FC<BinCardWidgetProps> = ({
  binNumber,
  itemName,
  currentQty,
  uom = 'pcs',
  lastVerifiedAt,
  lastVerifiedBy,
}) => {
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="glass-card rounded-xl p-4 border border-white/10">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-500/20 rounded-lg">
            <MapPin className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <span className="font-mono text-sm font-bold text-white">{binNumber}</span>
        </div>
        <div className="flex items-center gap-1">
          <Package className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-sm font-bold text-white">{currentQty.toLocaleString()}</span>
          <span className="text-xs text-gray-500">{uom}</span>
        </div>
      </div>
      <p className="text-xs text-gray-400 truncate mb-2">{itemName}</p>
      {lastVerifiedAt && (
        <div className="flex items-center gap-1 text-[10px] text-gray-500">
          <Calendar className="w-3 h-3" />
          <span>Verified {formatDate(lastVerifiedAt)}</span>
          {lastVerifiedBy && <span>by {lastVerifiedBy}</span>}
        </div>
      )}
    </div>
  );
};
