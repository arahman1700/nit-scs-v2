/**
 * System event catalog — all event types that flow through the event bus.
 * Used by: event bus, workflow rules, frontend real-time sync.
 */

// ── Document Lifecycle ──────────────────────────────────────────────────
export const DOCUMENT_EVENTS = {
  CREATED: 'document:created',
  UPDATED: 'document:updated',
  DELETED: 'document:deleted',
  STATUS_CHANGED: 'document:status_changed',
} as const;

// ── Approval ────────────────────────────────────────────────────────────
export const APPROVAL_EVENTS = {
  REQUESTED: 'approval:requested',
  APPROVED: 'approval:approved',
  REJECTED: 'approval:rejected',
} as const;

// ── Inventory ───────────────────────────────────────────────────────────
export const INVENTORY_EVENTS = {
  UPDATED: 'inventory:updated',
  LOW_STOCK: 'inventory:low_stock',
  RESERVED: 'inventory:reserved',
  RELEASED: 'inventory:released',
} as const;

// ── SLA ─────────────────────────────────────────────────────────────────
export const SLA_EVENTS = {
  AT_RISK: 'sla:at_risk',
  BREACHED: 'sla:breached',
} as const;

// ── Job Orders ──────────────────────────────────────────────────────────
export const JO_EVENTS = {
  ASSIGNED: 'jo:assigned',
  COMPLETED: 'jo:completed',
} as const;

// ── User ────────────────────────────────────────────────────────────────
export const USER_EVENTS = {
  LOGIN: 'user:login',
  PASSWORD_RESET: 'user:password_reset',
} as const;

// ── Aggregate catalog (for dropdowns and validation) ────────────────────
export const ALL_EVENTS = {
  ...DOCUMENT_EVENTS,
  ...APPROVAL_EVENTS,
  ...INVENTORY_EVENTS,
  ...SLA_EVENTS,
  ...JO_EVENTS,
  ...USER_EVENTS,
} as const;

export type SystemEventType =
  | (typeof DOCUMENT_EVENTS)[keyof typeof DOCUMENT_EVENTS]
  | (typeof APPROVAL_EVENTS)[keyof typeof APPROVAL_EVENTS]
  | (typeof INVENTORY_EVENTS)[keyof typeof INVENTORY_EVENTS]
  | (typeof SLA_EVENTS)[keyof typeof SLA_EVENTS]
  | (typeof JO_EVENTS)[keyof typeof JO_EVENTS]
  | (typeof USER_EVENTS)[keyof typeof USER_EVENTS];

/** Human-readable descriptions for each event type (used in UI dropdowns) */
export const EVENT_DESCRIPTIONS: Record<SystemEventType, string> = {
  'document:created': 'When a new document is created',
  'document:updated': 'When a document is modified',
  'document:deleted': 'When a document is deleted',
  'document:status_changed': 'When a document status changes (e.g. draft → pending)',
  'approval:requested': 'When a document is submitted for approval',
  'approval:approved': 'When a document is approved',
  'approval:rejected': 'When a document is rejected',
  'inventory:updated': 'When inventory quantities change',
  'inventory:low_stock': 'When an item falls below its reorder point',
  'inventory:reserved': 'When stock is reserved for an issuance',
  'inventory:released': 'When reserved stock is released back',
  'sla:at_risk': 'When an approval or task is approaching its SLA deadline',
  'sla:breached': 'When an SLA deadline has been missed',
  'jo:assigned': 'When a job order is assigned to a supplier/team',
  'jo:completed': 'When a job order is marked completed',
  'user:login': 'When a user logs in',
  'user:password_reset': 'When a password reset is requested',
};
