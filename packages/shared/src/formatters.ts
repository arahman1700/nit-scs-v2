// ── Currency ─────────────────────────────────────────────────────────────

export function formatCurrency(amount: number, currency = 'SAR'): string {
  return `${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`;
}

export function formatCurrencyShort(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M SAR`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K SAR`;
  return `${amount} SAR`;
}

// ── Date ─────────────────────────────────────────────────────────────────

export function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
}

// ── Numbers ──────────────────────────────────────────────────────────────

export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

// ── Text ─────────────────────────────────────────────────────────────────

export function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '...';
}

// ── Status Colors ────────────────────────────────────────────────────────

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    'Approved': 'text-emerald-400', 'Completed': 'text-emerald-400', 'Active': 'text-emerald-400',
    'Delivered': 'text-emerald-400', 'In Stock': 'text-emerald-400', 'Pass': 'text-emerald-400',
    'Resolved': 'text-emerald-400', 'Cleared': 'text-emerald-400', 'Released': 'text-emerald-400',
    'Stored': 'text-emerald-400', 'Received': 'text-emerald-400',
    'Pending': 'text-amber-400', 'Pending Approval': 'text-amber-400', 'In Progress': 'text-amber-400',
    'In Transit': 'text-amber-400', 'At Risk': 'text-amber-400', 'Low Stock': 'text-amber-400',
    'Conditional': 'text-amber-400', 'Open': 'text-amber-400', 'Assigning': 'text-amber-400',
    'Under Review': 'text-amber-400', 'Pending QC': 'text-amber-400',
    'Rejected': 'text-red-400', 'Cancelled': 'text-red-400', 'Out of Stock': 'text-red-400',
    'Overdue': 'text-red-400', 'Fail': 'text-red-400', 'Held': 'text-red-400',
    'Issued': 'text-blue-400', 'Inspected': 'text-blue-400', 'Customs Clearance': 'text-blue-400',
    'In Clearance': 'text-blue-400', 'Booked': 'text-blue-400',
    'Draft': 'text-gray-400', 'New': 'text-gray-400', 'Available': 'text-gray-400',
  };
  return colors[status] || 'text-gray-400';
}

export function getStatusBgColor(status: string): string {
  const colors: Record<string, string> = {
    'Approved': 'bg-emerald-500/20 border-emerald-500/30', 'Completed': 'bg-emerald-500/20 border-emerald-500/30',
    'Active': 'bg-emerald-500/20 border-emerald-500/30', 'Pass': 'bg-emerald-500/20 border-emerald-500/30',
    'Pending': 'bg-amber-500/20 border-amber-500/30', 'Pending Approval': 'bg-amber-500/20 border-amber-500/30',
    'In Progress': 'bg-amber-500/20 border-amber-500/30', 'In Transit': 'bg-amber-500/20 border-amber-500/30',
    'Rejected': 'bg-red-500/20 border-red-500/30', 'Cancelled': 'bg-red-500/20 border-red-500/30',
    'Fail': 'bg-red-500/20 border-red-500/30', 'Overdue': 'bg-red-500/20 border-red-500/30',
    'Draft': 'bg-gray-500/20 border-gray-500/30', 'New': 'bg-gray-500/20 border-gray-500/30',
    'Issued': 'bg-blue-500/20 border-blue-500/30', 'Inspected': 'bg-blue-500/20 border-blue-500/30',
  };
  return colors[status] || 'bg-gray-500/20 border-gray-500/30';
}
