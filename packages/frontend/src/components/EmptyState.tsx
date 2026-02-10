import React, { memo } from 'react';
import { Search } from 'lucide-react';

export const EmptyState: React.FC<{ message?: string }> = memo(({ message = 'No records found' }) => (
  <div className="flex flex-col items-center gap-3 py-12 text-gray-500">
    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
      <Search size={24} className="text-gray-600" />
    </div>
    <p>{message}</p>
  </div>
));
