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
}

export enum JobStatus {
  NEW = 'New',
  ASSIGNING = 'Assigning',
  QUOTE_REQUESTED = 'Quote Requested',
  QUOTE_RECEIVED = 'Quote Received',
  PENDING_APPROVAL = 'Pending Approval',
  APPROVED = 'Approved',
  IN_PROGRESS = 'In Progress',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled',
}

export type DocumentStatus =
  | 'Draft'
  | 'Pending Approval'
  | 'Approved'
  | 'Rejected'
  | 'Issued'
  | 'Completed'
  | 'Cancelled'
  | 'Inspected'
  | 'Pending QC'
  | 'In Transit'
  | 'Stored';

export type ApprovalAction = 'approve' | 'reject' | 'escalate' | 'return';

export type JOType =
  | 'Transport'
  | 'Equipment'
  | 'Generator_Rental'
  | 'Generator_Maintenance'
  | 'Rental_Monthly'
  | 'Rental_Daily'
  | 'Scrap';
