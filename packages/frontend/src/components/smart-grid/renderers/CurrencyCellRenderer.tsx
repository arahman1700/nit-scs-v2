import React from 'react';
import type { ICellRendererParams } from 'ag-grid-community';

export const CurrencyCellRenderer: React.FC<ICellRendererParams> = ({ value }) => {
  if (value == null) return <span className="text-gray-500">-</span>;
  const formatted = Number(value).toLocaleString();
  return <span>{formatted} SAR</span>;
};
