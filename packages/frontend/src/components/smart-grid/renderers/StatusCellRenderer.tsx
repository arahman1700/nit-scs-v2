import React from 'react';
import type { ICellRendererParams } from 'ag-grid-community';
import { StatusBadge } from '@/components/StatusBadge';

export const StatusCellRenderer: React.FC<ICellRendererParams> = ({ value }) => {
  if (!value) return <span className="text-gray-400">-</span>;
  return <StatusBadge status={value as string} />;
};
