import { CheckCircle2, Clock, XCircle } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────

export interface EmailTemplate {
  id: string;
  code: string;
  name: string;
  subject: string;
  bodyHtml: string;
  variables: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { emailLogs: number };
}

export interface EmailLog {
  id: string;
  templateId: string | null;
  toEmail: string;
  subject: string;
  bodyHtml: string | null;
  status: 'queued' | 'sent' | 'delivered' | 'bounced' | 'failed';
  retryCount: number;
  externalId: string | null;
  error: string | null;
  referenceTable: string | null;
  referenceId: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  template?: { code: string; name: string } | null;
}

export interface NotificationPreference {
  eventType: string;
  label: string;
  description: string;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  pushEnabled: boolean;
}

export type Tab = 'templates' | 'preferences' | 'logs';

// ── Constants ──────────────────────────────────────────────────────────────

export const EVENT_TYPES: { value: string; label: string; description: string }[] = [
  {
    value: 'document_submitted',
    label: 'Document Submitted',
    description: 'When a document is submitted for approval',
  },
  { value: 'document_approved', label: 'Document Approved', description: 'When a document is approved by an approver' },
  { value: 'document_rejected', label: 'Document Rejected', description: 'When a document is rejected by an approver' },
  { value: 'sla_breach', label: 'SLA Breach', description: 'When an SLA deadline is exceeded' },
  { value: 'sla_warning', label: 'SLA Warning', description: 'When an SLA deadline is approaching' },
  { value: 'inventory_low', label: 'Low Inventory', description: 'When stock levels fall below reorder point' },
  { value: 'inventory_expired', label: 'Inventory Expired', description: 'When inventory items reach expiration date' },
  { value: 'new_comment', label: 'New Comment', description: 'When a new comment is added to a document' },
  { value: 'status_changed', label: 'Status Changed', description: 'When a document status changes' },
];

export const LOG_STATUSES = ['queued', 'sent', 'delivered', 'bounced', 'failed'] as const;

export const EMPTY_TEMPLATE = {
  code: '',
  name: '',
  subject: '',
  bodyHtml: '',
  variables: [] as string[],
  isActive: true,
};

// ── Helpers ────────────────────────────────────────────────────────────────

export function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getStatusColor(status: string) {
  switch (status) {
    case 'delivered':
    case 'sent':
      return 'text-emerald-400 bg-emerald-500/15';
    case 'queued':
      return 'text-amber-400 bg-amber-500/15';
    case 'bounced':
    case 'failed':
      return 'text-red-400 bg-red-500/15';
    default:
      return 'text-gray-400 bg-white/10';
  }
}

export function getStatusIcon(status: string) {
  switch (status) {
    case 'delivered':
    case 'sent':
      return CheckCircle2;
    case 'queued':
      return Clock;
    case 'bounced':
    case 'failed':
      return XCircle;
    default:
      return Clock;
  }
}

/**
 * Sanitize HTML for preview display.
 * Strips script tags and event handlers as a basic safety measure.
 * The content originates from admin-managed email templates stored in the database.
 */
export function sanitizePreviewHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*\S+/gi, '');
}
