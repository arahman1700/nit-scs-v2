import React from 'react';
import type { VoucherLineItem } from '@nit-scs-v2/shared/types';
import { Trash2, AlertTriangle, Package } from 'lucide-react';
import {
  getConditionBadgeClass,
  getStockBadgeClass,
  getStockStatus,
  type StockStatus,
  type UnitOption,
} from './line-item-utils';

interface MobileLineItemCardProps {
  item: VoucherLineItem;
  index: number;
  readOnly: boolean;
  showCondition: boolean;
  showStockAvailability: boolean;
  unitOptions: UnitOption[];
  getAvailableQty: (code: string) => number;
  onUpdate: (id: string, field: keyof VoucherLineItem, value: string | number) => void;
  onRemove: (id: string) => void;
}

export const MobileLineItemCard: React.FC<MobileLineItemCardProps> = ({
  item,
  index,
  readOnly,
  showCondition,
  showStockAvailability,
  unitOptions,
  getAvailableQty,
  onUpdate,
  onRemove,
}) => {
  const available = showStockAvailability && item.itemCode ? getAvailableQty(item.itemCode) : null;
  const stockStatus: StockStatus | null =
    showStockAvailability && item.itemCode ? getStockStatus(getAvailableQty(item.itemCode)) : null;
  const isInsufficient = available !== null && item.quantity > available;

  return (
    <div className="glass-card rounded-xl p-4 space-y-3">
      {/* Card Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/5 text-gray-400 text-xs font-medium shrink-0">
            {index + 1}
          </div>
          {readOnly ? (
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{item.itemName || 'Unnamed Item'}</p>
              {item.itemCode && <p className="text-[10px] font-mono text-gray-400">{item.itemCode}</p>}
            </div>
          ) : (
            <div className="min-w-0 flex-1 space-y-1">
              <input
                type="text"
                value={item.itemName}
                onChange={e => onUpdate(item.id, 'itemName', e.target.value)}
                className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm font-semibold focus:border-nesma-secondary outline-none"
                placeholder="Item name"
              />
              <input
                type="text"
                value={item.itemCode}
                onChange={e => onUpdate(item.id, 'itemCode', e.target.value)}
                className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-gray-400 text-xs font-mono focus:border-nesma-secondary outline-none"
                placeholder="CODE"
              />
            </div>
          )}
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            aria-label={`Remove ${item.itemName || item.itemCode || 'item'}`}
            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all shrink-0"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* Fields Row */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1 block">Qty</label>
          {readOnly ? (
            <span className="text-sm text-white font-medium">{item.quantity}</span>
          ) : (
            <input
              type="number"
              min="0"
              step="0.01"
              value={item.quantity}
              onChange={e => onUpdate(item.id, 'quantity', Number(e.target.value))}
              className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm text-center focus:border-nesma-secondary outline-none"
            />
          )}
        </div>
        <div>
          <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1 block">Unit</label>
          {readOnly ? (
            <span className="text-sm text-gray-400">{item.unit}</span>
          ) : (
            <select
              value={item.unit}
              onChange={e => onUpdate(item.id, 'unit', e.target.value)}
              className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-xs focus:border-nesma-secondary outline-none"
            >
              {unitOptions.map(u => (
                <option key={u.id} value={u.label}>
                  {u.label}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1 block">Price</label>
          {readOnly ? (
            <span className="text-sm text-gray-300">{item.unitPrice.toLocaleString()}</span>
          ) : (
            <input
              type="number"
              min="0"
              step="0.01"
              value={item.unitPrice}
              onChange={e => onUpdate(item.id, 'unitPrice', Number(e.target.value))}
              className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm text-center focus:border-nesma-secondary outline-none"
            />
          )}
        </div>
      </div>

      {/* Total + badges */}
      <div className="flex items-center justify-between pt-2 border-t border-white/10">
        <div className="flex items-center gap-2">
          {showCondition &&
            (readOnly ? (
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${getConditionBadgeClass(item.condition)}`}>
                {item.condition}
              </span>
            ) : (
              <select
                value={item.condition || 'New'}
                onChange={e => onUpdate(item.id, 'condition', e.target.value)}
                className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-white text-[10px] focus:border-nesma-secondary outline-none"
              >
                <option value="New">New</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Damaged">Damaged</option>
              </select>
            ))}

          {showStockAvailability && available !== null && stockStatus !== null && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${getStockBadgeClass(stockStatus, isInsufficient)}`}
            >
              {isInsufficient && <AlertTriangle size={10} />}
              Avail: {available}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Package size={14} className="text-gray-400" />
          <span className="text-sm text-nesma-secondary font-bold">{item.totalPrice.toLocaleString()} SAR</span>
        </div>
      </div>
    </div>
  );
};
