import React from 'react';
import { Shield } from 'lucide-react';
import type { VoucherLineItem } from '@nit-scs-v2/shared/types';
import { LineItemsTable } from '@/components/LineItemsTable';

interface LineItemsSectionProps {
  items: VoucherLineItem[];
  onItemsChange: (items: VoucherLineItem[]) => void;
  formType: string;
  totalValue: number;
  approvalInfo: { level: string; color: string };
}

export const LineItemsSection: React.FC<LineItemsSectionProps> = ({
  items,
  onItemsChange,
  formType,
  totalValue,
  approvalInfo,
}) => (
  <>
    <LineItemsTable
      items={items}
      onItemsChange={onItemsChange}
      showCondition={formType === 'mrrv' || formType === 'mrv'}
      showStockAvailability={formType === 'mirv'}
    />

    {totalValue > 0 && (
      <div className="glass-card rounded-xl p-4 border border-white/10 bg-gradient-to-r from-white/5 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
              <Shield size={18} className="text-nesma-secondary" />
            </div>
            <div>
              <span className="text-sm text-gray-400 block">Required Approval Level</span>
              <span className={`text-sm font-medium ${approvalInfo.color}`}>{approvalInfo.level}</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-gray-500 block">Total Value</span>
            <span className="text-nesma-secondary font-bold text-lg">{totalValue.toLocaleString()} SAR</span>
          </div>
        </div>
      </div>
    )}
  </>
);
