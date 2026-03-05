import type { ApprovalLevel } from '../types/approval.js';

// Re-export V1↔V2 naming registry
export { CANONICAL_NAMES, type CanonicalDocType, v1ModelToDisplayName, v1PathToV2Path } from './naming.js';

// Re-export event catalog
export {
  ALL_EVENTS,
  DOCUMENT_EVENTS,
  APPROVAL_EVENTS,
  INVENTORY_EVENTS,
  SLA_EVENTS,
  JO_EVENTS,
  USER_EVENTS,
  NOTIFICATION_EVENTS,
  EVENT_DESCRIPTIONS,
  type SystemEventType,
} from './events.js';

// ── Document Prefixes ────────────────────────────────────────────────────

export const DOC_PREFIXES: Record<string, string> = {
  // V2 document types
  grn: 'GRN',
  qci: 'QCI',
  dr: 'DR',
  mi: 'MI',
  mrn: 'MRN',
  mr: 'MR',
  wt: 'WT',
  imsf: 'IMSF',
  scrap: 'SCR',
  surplus: 'SUR',
  // V1 backward-compatible docTypes (used by V1 routes)
  mrrv: 'MRRV',
  rfim: 'RFIM',
  osd: 'OSD',
  mirv: 'MIRV',
  mrv: 'MRV',
  mrf: 'MRF',
  // Logistics & modules — keys must match route docType values
  jo: 'JO',
  'job-orders': 'JO',
  gatepass: 'GP',
  'gate-passes': 'GP',
  shipment: 'SH',
  shipments: 'SH',
  'stock-transfers': 'ST',
  rc: 'RC',
  rental_contract: 'RC',
  tool_issue: 'TI',
  generator_maintenance: 'GM',
  vm: 'VM',
  vehicle_maintenance: 'VM',
  lot: 'LOT',
  leftover: 'LO',
  cycle_count: 'CC',
  asn: 'ASN',
  ssc: 'SSC',
  transport: 'TO',
  transport_order: 'TO',
  'transport-orders': 'TO',
  delivery_note: 'DN',
  return_note: 'RN',
  equipment_delivery_note: 'DN',
  equipment_return_note: 'RN',
};

// ── Approval Levels ──────────────────────────────────────────────────────

// SOW Section 7.3 — Two-tier approval: WH Manager ≤ SAR 200K, SC Manager > SAR 200K
export const MI_APPROVAL_LEVELS: ApprovalLevel[] = [
  {
    level: 1,
    label: 'Level 1 - Warehouse Manager',
    roleName: 'warehouse_supervisor',
    minAmount: 0,
    maxAmount: 200_000,
    slaHours: 8,
  },
  {
    level: 2,
    label: 'Level 2 - Supply Chain Manager',
    roleName: 'manager',
    minAmount: 200_000,
    maxAmount: Infinity,
    slaHours: 24,
  },
];

// SOW Section 7.3 — Two-tier JO approval aligned with MI thresholds
export const JO_APPROVAL_LEVELS: ApprovalLevel[] = [
  {
    level: 1,
    label: 'Level 1 - Logistics Coordinator',
    roleName: 'logistics_coordinator',
    minAmount: 0,
    maxAmount: 200_000,
    slaHours: 8,
  },
  {
    level: 2,
    label: 'Level 2 - Operations Manager',
    roleName: 'manager',
    minAmount: 200_000,
    maxAmount: Infinity,
    slaHours: 24,
  },
];

// ── Status Flows ─────────────────────────────────────────────────────────

export const STATUS_FLOWS: Record<string, string[]> = {
  grn: ['draft', 'pending_qc', 'qc_approved', 'received', 'stored', 'rejected'],
  qci: ['pending', 'in_progress', 'completed_conditional', 'completed'],
  dr: ['draft', 'under_review', 'claim_sent', 'awaiting_response', 'negotiating', 'resolved', 'closed'],
  mi: ['draft', 'pending_approval', 'approved', 'partially_issued', 'issued', 'completed', 'rejected', 'cancelled'],
  mrn: ['draft', 'pending', 'received', 'completed', 'rejected'],
  mr: [
    'draft',
    'submitted',
    'under_review',
    'approved',
    'checking_stock',
    'from_stock',
    'needs_purchase',
    'not_available_locally',
    'partially_fulfilled',
    'fulfilled',
    'rejected',
    'cancelled',
  ],
  wt: ['draft', 'pending', 'approved', 'shipped', 'received', 'completed', 'cancelled'],
  imsf: ['created', 'sent', 'confirmed', 'in_transit', 'delivered', 'completed', 'rejected'],
  jo: [
    'draft',
    'pending_approval',
    'quoted',
    'approved',
    'assigned',
    'in_progress',
    'on_hold',
    'completed',
    'closure_pending',
    'closure_approved',
    'invoiced',
    'rejected',
    'cancelled',
  ],
  gate_pass: ['draft', 'pending', 'approved', 'released', 'returned', 'expired', 'cancelled'],
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
  surplus: ['identified', 'evaluated', 'approved', 'actioned', 'closed', 'rejected'],
  scrap: ['identified', 'reported', 'approved', 'in_ssc', 'sold', 'disposed', 'closed', 'rejected'],
  rental_contract: ['draft', 'pending_approval', 'active', 'extended', 'terminated', 'rejected'],
  tool_issue: ['issued', 'overdue', 'returned'],
  generator_maintenance: ['scheduled', 'in_progress', 'completed', 'overdue'],
  vehicle_maintenance: ['scheduled', 'in_progress', 'completed', 'cancelled'],
  storekeeper_handover: ['initiated', 'in_progress', 'completed'],
  equipment_delivery_note: ['draft', 'confirmed', 'cancelled'],
  equipment_return_note: ['draft', 'inspected', 'confirmed', 'disputed'],
  transport_order: ['draft', 'scheduled', 'in_transit', 'delivered', 'cancelled'],

  // V1 backward-compatibility aliases
  mrrv: ['draft', 'pending_qc', 'qc_approved', 'received', 'stored', 'rejected'],
  rfim: ['pending', 'in_progress', 'completed_conditional', 'completed'],
  osd: ['draft', 'under_review', 'claim_sent', 'awaiting_response', 'negotiating', 'resolved', 'closed'],
  mirv: ['draft', 'pending_approval', 'approved', 'partially_issued', 'issued', 'completed', 'rejected', 'cancelled'],
  mrv: ['draft', 'pending', 'received', 'completed', 'rejected'],
  mrf: [
    'draft',
    'submitted',
    'under_review',
    'approved',
    'checking_stock',
    'from_stock',
    'needs_purchase',
    'not_available_locally',
    'partially_fulfilled',
    'fulfilled',
    'rejected',
    'cancelled',
  ],
  stock_transfer: ['draft', 'pending', 'approved', 'shipped', 'received', 'completed', 'cancelled'],
};

// ── SLA Configuration ────────────────────────────────────────────────────

export const SLA_HOURS: Record<string, number> = {
  stock_verification: 4, // MR → warehouse response
  jo_execution: 48, // After quotation
  qc_inspection: 336, // 14 days
  gate_pass: 24,
  post_install_check: 48,
  scrap_buyer_pickup: 240, // 10 days
  surplus_timeout: 336, // 14 days (2 weeks)
};

// ── Insurance Threshold ──────────────────────────────────────────────────

export const INSURANCE_THRESHOLD_SAR = 7_000_000;

// ── Warehouse Zones ──────────────────────────────────────────────────────

export const WAREHOUSE_ZONES = ['A', 'B', 'C', 'D', 'CONTAINER', 'OPEN_YARD', 'HAZARDOUS'] as const;

export const ZONE_TYPES: Record<string, string> = {
  A: 'Civil',
  B: 'Mechanical / Scrap',
  C: 'Electrical',
  D: 'General',
  CONTAINER: 'Container Storage',
  OPEN_YARD: 'Open Yard',
  HAZARDOUS: 'Hazardous Materials',
};

// ── Scrap Material Types ─────────────────────────────────────────────────

export const SCRAP_MATERIAL_TYPES = [
  'cable',
  'mv_cable',
  'hv_cable',
  'aluminum',
  'copper',
  'steel',
  'cable_tray',
  'wood',
  'other',
] as const;

// ── Item Main Categories ─────────────────────────────────────────────────

export const ITEM_MAIN_CATEGORIES = ['MECHANICAL', 'ELECTRICAL', 'CIVIL', 'INSTRUMENTATION', 'PMV'] as const;

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
  'transport_supervisor',
  'scrap_committee_member',
  // SOW Section 13.1 — additional roles for full 14-role coverage
  'technical_manager',
  'gate_officer',
  'inventory_specialist',
  'shipping_officer',
  'finance_user',
  'customs_specialist',
  'compliance_officer',
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

// ── Shipping Milestone Types ─────────────────────────────────────────────

export const SHIPPING_MILESTONE_TYPES = [
  'booking_confirmed',
  'cargo_loaded',
  'vessel_departed',
  'in_transit',
  'arrived_at_port',
  'customs_clearance',
  'saber_registration',
  'fasah_customs',
  'sadad_payment',
  'delivered_to_warehouse',
  'advance_shipment_notification',
] as const;
