import type { ApprovalLevel } from '../types/approval.js';

// Re-export event catalog
export {
  ALL_EVENTS,
  DOCUMENT_EVENTS,
  APPROVAL_EVENTS,
  INVENTORY_EVENTS,
  SLA_EVENTS,
  JO_EVENTS,
  USER_EVENTS,
  EVENT_DESCRIPTIONS,
  type SystemEventType,
} from './events.js';

// ── Document Prefixes ────────────────────────────────────────────────────

export const DOC_PREFIXES: Record<string, string> = {
  mrrv: 'MRRV',
  mirv: 'MIRV',
  mrv: 'MRV',
  rfim: 'RFIM',
  osd: 'OSD',
  jo: 'JO',
  gatepass: 'GP',
  mrf: 'MRF',
  stock_transfer: 'ST',
  shipment: 'SH',
  lot: 'LOT',
  leftover: 'LO',
};

// ── Approval Levels ──────────────────────────────────────────────────────

export const MIRV_APPROVAL_LEVELS: ApprovalLevel[] = [
  {
    level: 1,
    label: 'Level 1 - Storekeeper',
    roleName: 'warehouse_staff',
    minAmount: 0,
    maxAmount: 10_000,
    slaHours: 4,
  },
  {
    level: 2,
    label: 'Level 2 - Logistics Manager',
    roleName: 'logistics_coordinator',
    minAmount: 10_000,
    maxAmount: 50_000,
    slaHours: 8,
  },
  {
    level: 3,
    label: 'Level 3 - Department Head',
    roleName: 'manager',
    minAmount: 50_000,
    maxAmount: 100_000,
    slaHours: 24,
  },
  {
    level: 4,
    label: 'Level 4 - Operations Director',
    roleName: 'manager',
    minAmount: 100_000,
    maxAmount: 500_000,
    slaHours: 48,
  },
  { level: 5, label: 'Level 5 - CEO', roleName: 'admin', minAmount: 500_000, maxAmount: Infinity, slaHours: 72 },
];

export const JO_APPROVAL_LEVELS: ApprovalLevel[] = [
  {
    level: 1,
    label: 'Level 1 - Logistics Coordinator',
    roleName: 'logistics_coordinator',
    minAmount: 0,
    maxAmount: 5_000,
    slaHours: 4,
  },
  {
    level: 2,
    label: 'Level 2 - Logistics Manager',
    roleName: 'manager',
    minAmount: 5_000,
    maxAmount: 20_000,
    slaHours: 8,
  },
  {
    level: 3,
    label: 'Level 3 - Operations Director',
    roleName: 'manager',
    minAmount: 20_000,
    maxAmount: 100_000,
    slaHours: 24,
  },
  { level: 4, label: 'Level 4 - CEO', roleName: 'admin', minAmount: 100_000, maxAmount: Infinity, slaHours: 48 },
];

// ── Status Flows ─────────────────────────────────────────────────────────

export const STATUS_FLOWS: Record<string, string[]> = {
  mrrv: ['draft', 'pending_qc', 'qc_approved', 'received', 'stored', 'rejected'],
  mirv: ['draft', 'pending_approval', 'approved', 'partially_issued', 'issued', 'completed', 'rejected', 'cancelled'],
  mrv: ['draft', 'pending', 'received', 'completed', 'rejected'],
  rfim: ['pending', 'in_progress', 'completed'],
  osd: ['draft', 'under_review', 'claim_sent', 'awaiting_response', 'negotiating', 'resolved', 'closed'],
  jo: [
    'draft',
    'pending_approval',
    'quoted',
    'approved',
    'assigned',
    'in_progress',
    'on_hold',
    'completed',
    'invoiced',
    'rejected',
    'cancelled',
  ],
  gate_pass: ['draft', 'pending', 'approved', 'released', 'returned', 'expired', 'cancelled'],
  stock_transfer: ['draft', 'pending', 'approved', 'shipped', 'received', 'completed', 'cancelled'],
  mrf: [
    'draft',
    'submitted',
    'under_review',
    'approved',
    'checking_stock',
    'from_stock',
    'needs_purchase',
    'partially_fulfilled',
    'fulfilled',
    'rejected',
    'cancelled',
  ],
  shipment: [
    'draft',
    'po_issued',
    'in_production',
    'ready_to_ship',
    'in_transit',
    'at_port',
    'customs_clearing',
    'cleared',
    'in_delivery',
    'delivered',
    'cancelled',
  ],
};

// ── Item Categories ──────────────────────────────────────────────────────

export const ITEM_CATEGORIES = [
  'construction',
  'electrical',
  'mechanical',
  'safety',
  'tools',
  'consumables',
  'spare_parts',
] as const;

// ── Departments ──────────────────────────────────────────────────────────

export const DEPARTMENTS = ['logistics', 'warehouse', 'transport', 'projects', 'quality', 'finance', 'admin'] as const;

// ── System Roles (DB level) ──────────────────────────────────────────────

export const SYSTEM_ROLES = [
  'admin',
  'manager',
  'warehouse_supervisor',
  'warehouse_staff',
  'logistics_coordinator',
  'site_engineer',
  'qc_officer',
  'freight_forwarder',
] as const;

// ── JO Types ─────────────────────────────────────────────────────────────

export const JO_TYPES = [
  'transport',
  'equipment',
  'rental_monthly',
  'rental_daily',
  'scrap',
  'generator_rental',
  'generator_maintenance',
] as const;
