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
  WARNING: 'sla:warning',
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

// ── SOW Notifications (N-01 through N-14) ───────────────────────────────
export const NOTIFICATION_EVENTS = {
  /** N-01: MI submitted for approval → notify approver role */
  MIRV_APPROVAL_NEEDED: 'notification:mirv_approval',
  /** N-02: Stock below minimum level → notify warehouse_supervisor */
  LOW_STOCK_ALERT: 'notification:low_stock',
  /** N-03: Equipment return date approaching → notify logistics_coordinator */
  EQUIPMENT_RETURN_DUE: 'notification:equipment_return_due',
  /** N-04: Shipment status change → notify shipping_officer, logistics_coordinator */
  SHIPMENT_STATUS_CHANGE: 'notification:shipment_status',
  /** N-05: Shipment delayed → notify manager, logistics_coordinator */
  SHIPMENT_DELAYED: 'notification:shipment_delayed',
  /** N-06: QC inspection required → notify qc_officer */
  QC_INSPECTION_REQUIRED: 'notification:qc_inspection',
  /** N-07: Approval SLA exceeded → notify manager */
  APPROVAL_SLA_EXCEEDED: 'notification:approval_sla',
  /** N-08: Cycle count scheduled → notify inventory_specialist, warehouse_staff */
  CYCLE_COUNT_SCHEDULED: 'notification:cycle_count',
  /** N-09: Rate card expiring → notify finance_user, manager */
  RATE_CARD_EXPIRING: 'notification:rate_card_expiry',
  /** N-10: Vehicle maintenance due → notify transport_supervisor */
  VEHICLE_MAINTENANCE_DUE: 'notification:vehicle_maintenance',
  /** N-11: Unauthorized gate exit attempt → notify gate_officer, warehouse_supervisor */
  UNAUTHORIZED_GATE_EXIT: 'notification:unauthorized_exit',
  /** N-12: NCR/DR deadline approaching → notify qc_officer */
  NCR_DEADLINE_APPROACHING: 'notification:ncr_deadline',
  /** N-13: Contract/insurance renewal due → notify manager, finance_user */
  CONTRACT_RENEWAL_DUE: 'notification:contract_renewal',
  /** N-14: Overdue tool return → notify warehouse_supervisor */
  OVERDUE_TOOL_RETURN: 'notification:overdue_tool',
} as const;

// ── Aggregate catalog (for dropdowns and validation) ────────────────────
export const ALL_EVENTS = {
  ...DOCUMENT_EVENTS,
  ...APPROVAL_EVENTS,
  ...INVENTORY_EVENTS,
  ...SLA_EVENTS,
  ...JO_EVENTS,
  ...USER_EVENTS,
  ...NOTIFICATION_EVENTS,
} as const;

export type SystemEventType =
  | (typeof DOCUMENT_EVENTS)[keyof typeof DOCUMENT_EVENTS]
  | (typeof APPROVAL_EVENTS)[keyof typeof APPROVAL_EVENTS]
  | (typeof INVENTORY_EVENTS)[keyof typeof INVENTORY_EVENTS]
  | (typeof SLA_EVENTS)[keyof typeof SLA_EVENTS]
  | (typeof JO_EVENTS)[keyof typeof JO_EVENTS]
  | (typeof USER_EVENTS)[keyof typeof USER_EVENTS]
  | (typeof NOTIFICATION_EVENTS)[keyof typeof NOTIFICATION_EVENTS];

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
  'sla:warning': 'When a document SLA deadline is within the next hour',
  'jo:assigned': 'When a job order is assigned to a supplier/team',
  'jo:completed': 'When a job order is marked completed',
  'user:login': 'When a user logs in',
  'user:password_reset': 'When a password reset is requested',
  // SOW Notification Events (N-01 through N-14)
  'notification:mirv_approval': 'N-01: MI submitted for approval — notify approver',
  'notification:low_stock': 'N-02: Stock below minimum level — notify warehouse supervisor',
  'notification:equipment_return_due': 'N-03: Equipment return date approaching — notify logistics',
  'notification:shipment_status': 'N-04: Shipment status changed — notify shipping/logistics',
  'notification:shipment_delayed': 'N-05: Shipment delayed — notify manager/logistics',
  'notification:qc_inspection': 'N-06: QC inspection required — notify QC officer',
  'notification:approval_sla': 'N-07: Approval SLA exceeded — notify manager',
  'notification:cycle_count': 'N-08: Cycle count scheduled — notify inventory/warehouse staff',
  'notification:rate_card_expiry': 'N-09: Rate card expiring — notify finance/manager',
  'notification:vehicle_maintenance': 'N-10: Vehicle maintenance due — notify transport supervisor',
  'notification:unauthorized_exit': 'N-11: Unauthorized gate exit attempt — notify gate/warehouse',
  'notification:ncr_deadline': 'N-12: NCR/DR deadline approaching — notify QC officer',
  'notification:contract_renewal': 'N-13: Contract/insurance renewal due — notify manager/finance',
  'notification:overdue_tool': 'N-14: Overdue tool return — notify warehouse supervisor',
};
