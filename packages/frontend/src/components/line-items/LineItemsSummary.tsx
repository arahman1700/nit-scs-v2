import React from 'react';
import type { VoucherLineItem } from '@nit-scs-v2/shared/types';

interface LineItemsSummaryProps {
  items: VoucherLineItem[];
  totalValue: number;
  variant: 'desktop' | 'mobile';
}

export const LineItemsSummary: React.FC<LineItemsSummaryProps> = ({ items, totalValue, variant }) => {
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);

  if (variant === 'mobile') {
    return (
      <div className="glass-card rounded-xl p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Items</span>
          <span className="text-white font-medium">{items.length}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Total Qty</span>
          <span className="text-white font-medium">{totalQty.toLocaleString()}</span>
        </div>
        <div className="border-t border-white/10 pt-2 flex justify-between">
          <span className="text-sm text-gray-400">Total</span>
          <span className="text-nesma-secondary font-bold text-lg">{totalValue.toLocaleString()} SAR</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-end mt-4 pt-4 border-t border-white/10">
      <div className="glass-card px-6 py-3 rounded-xl flex items-center gap-6">
        <div className="text-sm text-gray-400">
          Items: <span className="text-white font-medium">{items.length}</span>
        </div>
        <div className="h-6 w-px bg-white/10"></div>
        <div className="text-sm text-gray-400">
          Total Qty: <span className="text-white font-medium">{totalQty.toLocaleString()}</span>
        </div>
        <div className="h-6 w-px bg-white/10"></div>
        <div className="text-sm">
          Total: <span className="text-nesma-secondary font-bold text-lg">{totalValue.toLocaleString()} SAR</span>
        </div>
      </div>
    </div>
  );
};
