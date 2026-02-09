import React from 'react';

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  let colorClass = 'bg-gray-500/20 text-gray-300 border-gray-500/50';

  switch (status) {
    case 'Approved':
    case 'Delivered':
    case 'Completed':
    case 'Active':
    case 'Cleared':
    case 'In Stock':
    case 'Pass':
    case 'Resolved':
    case 'On Track':
      colorClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      break;
    case 'Pending':
    case 'Pending Approval':
    case 'In Progress':
    case 'In Transit':
    case 'Assigning':
    case 'Low Stock':
    case 'Conditional':
    case 'Open':
    case 'At Risk':
      colorClass = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      break;
    case 'Rejected':
    case 'Cancelled':
    case 'Out of Stock':
    case 'Overdue':
    case 'Fail':
      colorClass = 'bg-red-500/20 text-red-400 border-red-500/30';
      break;
    case 'Issued':
    case 'Customs Clearance':
    case 'Inspected':
      colorClass = 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      break;
    case 'Draft':
    case 'New':
      colorClass = 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      break;
  }

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${colorClass} backdrop-blur-sm`}>{status}</span>
  );
};
