import React, { memo } from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = memo(
  ({ currentPage, totalPages, totalItems, pageSize, onPageChange }) => (
    <div className="p-4 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 bg-white/5">
      <span className="text-xs text-gray-400">
        Showing{' '}
        <span className="text-white font-medium">
          {totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalItems)}
        </span>{' '}
        of <span className="text-white font-medium">{totalItems}</span> records
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="px-3 py-1.5 border border-white/10 rounded-lg bg-black/20 text-gray-400 text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/5 hover:text-white transition-all"
        >
          Previous
        </button>
        <div className="flex gap-1">
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(page => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`w-8 h-8 rounded-lg text-xs flex items-center justify-center transition-all ${
                currentPage === page
                  ? 'bg-nesma-primary text-white shadow-lg shadow-nesma-primary/20'
                  : 'border border-white/10 hover:bg-white/10 text-gray-400'
              }`}
            >
              {page}
            </button>
          ))}
        </div>
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="px-3 py-1.5 border border-white/10 rounded-lg bg-black/20 text-gray-300 text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/5 hover:text-white transition-all"
        >
          Next
        </button>
      </div>
    </div>
  ),
);
