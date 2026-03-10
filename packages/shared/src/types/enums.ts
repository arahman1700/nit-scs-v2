// ── Enums ─────────────────────────────────────────────────────────────────

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  WAREHOUSE_SUPERVISOR = 'warehouse_supervisor',
  WAREHOUSE_STAFF = 'warehouse_staff',
  LOGISTICS_COORDINATOR = 'logistics_coordinator',
  SITE_ENGINEER = 'site_engineer',
  QC_OFFICER = 'qc_officer',
  FREIGHT_FORWARDER = 'freight_forwarder',
  TRANSPORT_SUPERVISOR = 'transport_supervisor',
  SCRAP_COMMITTEE_MEMBER = 'scrap_committee_member',
  // SOW Section 13.1 — additional roles for full 14-role coverage
  TECHNICAL_MANAGER = 'technical_manager',
  GATE_OFFICER = 'gate_officer',
  INVENTORY_SPECIALIST = 'inventory_specialist',
  SHIPPING_OFFICER = 'shipping_officer',
  FINANCE_USER = 'finance_user',
  CUSTOMS_SPECIALIST = 'customs_specialist',
  COMPLIANCE_OFFICER = 'compliance_officer',
}

/**
 * Job order statuses — values match the database (snake_case).
 * Display labels should be derived via a lookup map, not from enum values.
 */
export enum JobStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  QUOTED = 'quoted',
  APPROVED = 'approved',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  ON_HOLD = 'on_hold',
  COMPLETED = 'completed',
  INVOICED = 'invoiced',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

/**
 * Display labels for JobStatus.
 */
export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  [JobStatus.DRAFT]: 'Draft',
  [JobStatus.PENDING_APPROVAL]: 'Pending Approval',
  [JobStatus.QUOTED]: 'Quoted',
  [JobStatus.APPROVED]: 'Approved',
  [JobStatus.ASSIGNED]: 'Assigned',
  [JobStatus.IN_PROGRESS]: 'In Progress',
  [JobStatus.ON_HOLD]: 'On Hold',
  [JobStatus.COMPLETED]: 'Completed',
  [JobStatus.INVOICED]: 'Invoiced',
  [JobStatus.REJECTED]: 'Rejected',
  [JobStatus.CANCELLED]: 'Cancelled',
};

/**
 * Document statuses — values match the database (snake_case).
 */
export type DocumentStatus =
  | 'draft'
  | 'pending_approval'
  | 'pending_qc'
  | 'qc_approved'
  | 'approved'
  | 'rejected'
  | 'issued'
  | 'partially_issued'
  | 'completed'
  | 'cancelled'
  | 'received'
  | 'stored'
  | 'in_transit';

/**
 * Display labels for document statuses.
 */
export const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  pending_qc: 'Pending QC',
  qc_approved: 'QC Approved',
  approved: 'Approved',
  rejected: 'Rejected',
  issued: 'Issued',
  partially_issued: 'Partially Issued',
  completed: 'Completed',
  cancelled: 'Cancelled',
  received: 'Received',
  stored: 'Stored',
  in_transit: 'In Transit',
};

export type ApprovalAction = 'approve' | 'reject' | 'escalate' | 'return';

export type JOType =
  | 'transport'
  | 'equipment'
  | 'rental_monthly'
  | 'rental_daily'
  | 'scrap'
  | 'generator_rental'
  | 'generator_maintenance';

// ── Per-Document Status Types ────────────────────────────────────────────
// Narrowed subsets of DocumentStatus for each document type.
// These match the STATUS_FLOWS in formConfigs.ts (display labels map to these db values).

export type GrnStatus = 'draft' | 'pending_qc' | 'qc_approved' | 'received' | 'stored';
export type MiStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'partially_issued'
  | 'issued'
  | 'completed'
  | 'rejected'
  | 'cancelled';
export type MrnStatus = 'draft' | 'pending_approval' | 'received' | 'completed' | 'rejected';
export type QciStatus = 'pending_qc' | 'in_progress' | 'completed';
export type DrStatus =
  | 'draft'
  | 'under_review'
  | 'claim_sent'
  | 'awaiting_response'
  | 'negotiating'
  | 'resolved'
  | 'closed';
export type MrStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'checking_stock'
  | 'from_stock'
  | 'needs_purchase'
  | 'partially_fulfilled'
  | 'fulfilled'
  | 'rejected'
  | 'cancelled';
export type WtStatus = 'draft' | 'pending_approval' | 'approved' | 'shipped' | 'received' | 'completed' | 'cancelled';
export type GatePassStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'released'
  | 'returned'
  | 'expired'
  | 'cancelled';
export type ImsfStatus = 'created' | 'sent' | 'confirmed' | 'in_transit' | 'delivered' | 'completed' | 'rejected';
export type ScrapStatus =
  | 'identified'
  | 'reported'
  | 'approved'
  | 'in_ssc'
  | 'sold'
  | 'disposed'
  | 'closed'
  | 'rejected';
export type SurplusStatus = 'identified' | 'evaluated' | 'approved' | 'actioned' | 'closed' | 'rejected';
export type RentalContractStatus = 'draft' | 'pending_approval' | 'active' | 'extended' | 'terminated' | 'rejected';
export type ShipmentStatus =
  | 'draft'
  | 'po_issued'
  | 'in_production'
  | 'ready_to_ship'
  | 'in_transit'
  | 'at_port'
  | 'customs_clearing'
  | 'cleared'
  | 'in_delivery'
  | 'delivered'
  | 'cancelled';
export type HandoverStatus = 'initiated' | 'in_progress' | 'completed';

// ── Job Order Status (union type matching DB CHECK constraint) ────────
export type JobOrderStatus =
  | 'draft'
  | 'pending_approval'
  | 'quoted'
  | 'approved'
  | 'assigned'
  | 'in_progress'
  | 'on_hold'
  | 'completed'
  | 'closure_pending'
  | 'closure_approved'
  | 'invoiced'
  | 'rejected'
  | 'cancelled';

// ── Inventory Lot Status ─────────────────────────────────────────────
export type InventoryLotStatus = 'active' | 'depleted' | 'expired' | 'blocked';

// ── Cycle Counting Statuses ──────────────────────────────────────────
export type CycleCountStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type CycleCountLineStatus = 'pending' | 'counted' | 'verified' | 'adjusted';

// ── Cross-Dock Status ────────────────────────────────────────────────
export type CrossDockStatus = 'identified' | 'approved' | 'in_progress' | 'completed' | 'cancelled';

// ── Tool & Equipment Statuses ────────────────────────────────────────
export type ToolCondition = 'good' | 'under_maintenance' | 'damaged' | 'decommissioned';
export type ToolIssueStatus = 'issued' | 'overdue' | 'returned';

// ── Asset Register Status ────────────────────────────────────────────
export type AssetStatus = 'active' | 'maintenance' | 'retired' | 'disposed' | 'lost';
export type AssetCondition = 'new' | 'good' | 'fair' | 'poor';

// ── Generator Statuses ───────────────────────────────────────────────
export type GeneratorStatus = 'available' | 'assigned' | 'maintenance' | 'decommissioned';
export type GeneratorMaintenanceStatus = 'scheduled' | 'in_progress' | 'completed' | 'overdue';

// ── Customs & Compliance ─────────────────────────────────────────────
export type CustomsTrackingStage =
  | 'docs_submitted'
  | 'declaration_filed'
  | 'under_inspection'
  | 'awaiting_payment'
  | 'duties_paid'
  | 'ready_for_release'
  | 'released'
  | 'on_hold'
  | 'rejected';
export type CustomsDocumentStatus = 'pending' | 'received' | 'verified' | 'rejected';
export type ComplianceAuditStatus = 'draft' | 'in_progress' | 'completed' | 'action_required';

// ── Transport & Visitor ──────────────────────────────────────────────
export type TransportOrderStatus = 'draft' | 'scheduled' | 'in_transit' | 'delivered' | 'cancelled';
export type VisitorPassStatus = 'scheduled' | 'checked_in' | 'checked_out' | 'overstay' | 'cancelled';

// ── SSC Bid Status ───────────────────────────────────────────────────
export type SscBidStatus = 'submitted' | 'under_review' | 'accepted' | 'rejected';

// ── Packing & Staging ────────────────────────────────────────────────
export type PackingSessionStatus = 'in_progress' | 'completed' | 'cancelled';
export type StagingAssignmentStatus = 'staged' | 'moved' | 'expired';

// ── AMC Status ───────────────────────────────────────────────────────
export type AmcStatus = 'draft' | 'active' | 'expired' | 'terminated';
