import type { GrnStatus, MiStatus, MrnStatus } from './enums.js';
import type { StatusHistoryEntry, ProjectRef, SupplierRef, WarehouseRef, EmployeeRef } from './common.js';
import type { ApprovalChain } from './approval.js';

// ── Shared Line Item ─────────────────────────────────────────────────────

/** Base fields common to all document line items. */
export interface BaseLineItem {
  id: string;
  itemId?: string;
  itemCode: string;
  itemName: string;
  uomId?: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  condition?: 'New' | 'Good' | 'Fair' | 'Damaged';
  notes?: string;
}

/** GRN-specific line item with receiving quantities. */
export interface GrnLineItem extends BaseLineItem {
  qtyExpected?: number;
  qtyReceived?: number;
  overDeliveryPct?: number;
  storageLocation?: string;
  lotNumber?: string;
}

/** MI-specific line item with issuance quantities. */
export interface MiLineItem extends BaseLineItem {
  qtyApproved?: number;
  qtyIssued?: number;
  qtyAvailable?: number;
  reservationId?: string;
}

/**
 * Union line item type — backward compatible.
 * Prefer using GrnLineItem / MiLineItem / BaseLineItem in new code.
 */
export interface VoucherLineItem extends BaseLineItem {
  // GRN specifics
  qtyExpected?: number;
  qtyReceived?: number;
  overDeliveryPct?: number;
  storageLocation?: string;
  lotNumber?: string;
  // MI specifics
  qtyApproved?: number;
  qtyIssued?: number;
  qtyAvailable?: number;
  reservationId?: string;
}

export interface MaterialCatalogItem {
  code: string;
  name: string;
  category: string;
  unit: string;
  unitPrice: number;
}

// ── MRRV ─────────────────────────────────────────────────────────────────

export interface MRRV {
  id: string;
  mrrvNumber?: string;
  supplierId: string;
  supplier?: SupplierRef;
  warehouseId: string;
  warehouse?: WarehouseRef;
  projectId?: string;
  project?: ProjectRef;
  receivedById: string;
  receivedBy?: EmployeeRef;
  receiveDate: string;
  totalValue: number;
  status: GrnStatus;
  poNumber?: string;
  invoiceNumber?: string;
  deliveryNote?: string;
  rfimRequired?: boolean;
  hasOsd?: boolean;
  notes?: string;
  binLocation?: string;
  receivingDock?: string;
  qcInspectorId?: string;
  qcApprovedDate?: string;
  lineItems?: VoucherLineItem[];
  attachments?: string[];
  statusHistory?: StatusHistoryEntry[];
  createdAt?: string;
  updatedAt?: string;
}

// ── MIRV ─────────────────────────────────────────────────────────────────

export interface MIRV {
  id: string;
  mirvNumber?: string;
  projectId: string;
  project?: ProjectRef;
  requestedById: string;
  requestedBy?: EmployeeRef;
  warehouseId: string;
  warehouse?: WarehouseRef;
  requestDate: string;
  requiredDate?: string;
  estimatedValue: number;
  status: MiStatus;
  priority?: 'normal' | 'urgent' | 'emergency';
  approvedById?: string;
  approvedDate?: string;
  issuedById?: string;
  issuedDate?: string;
  rejectionReason?: string;
  reservationStatus?: 'none' | 'reserved' | 'released';
  mrfId?: string;
  slaDueDate?: string;
  gatePassAutoCreated?: boolean;
  notes?: string;
  locationOfWork?: string;
  lineItems?: VoucherLineItem[];
  approvalChain?: ApprovalChain;
  statusHistory?: StatusHistoryEntry[];
  createdAt?: string;
  updatedAt?: string;
  /** @deprecated Use requestDate — still used in SiteEngineerDashboard */
  date?: string;
  /** @deprecated Use estimatedValue — still used in pdfExport.ts */
  value?: number;
  /** @deprecated Use requestedById — still used in pdfExport.ts */
  requester?: string;
}

// ── MRV ──────────────────────────────────────────────────────────────────

export interface MRV {
  id: string;
  mrvNumber?: string;
  returnType: 'return_to_warehouse' | 'return_to_supplier' | 'scrap' | 'transfer_to_project';
  returnDate: string;
  projectId: string;
  project?: ProjectRef;
  fromWarehouseId?: string;
  fromWarehouse?: WarehouseRef;
  toWarehouseId: string;
  toWarehouse?: WarehouseRef;
  returnedById: string;
  returnedBy?: EmployeeRef;
  reason: string;
  status: MrnStatus;
  receivedById?: string;
  receivedDate?: string;
  originalMirvId?: string;
  notes?: string;
  lineItems?: VoucherLineItem[];
  statusHistory?: StatusHistoryEntry[];
  createdAt?: string;
  updatedAt?: string;
  /** @deprecated Use toWarehouseId — still used in pdfExport.ts */
  warehouse?: string;
}

// ── RFIM ─────────────────────────────────────────────────────────────────

export interface InspectionChecklistItem {
  id: string;
  name: string;
  required: boolean;
  result?: 'Pass' | 'Fail' | 'Conditional';
  notes?: string;
}

export interface RFIM {
  id: string;
  formNumber?: string;
  mrrvId: string;
  inspectionType: 'Visual' | 'Dimensional' | 'Functional' | 'Documentation' | 'Lab Test';
  priority: 'Normal' | 'Urgent' | 'Critical';
  status: 'Pending' | 'In Progress' | 'Pass' | 'Fail' | 'Conditional';
  inspector?: string;
  inspectionDate?: string;
  notes?: string;
  checklistItems?: InspectionChecklistItem[];
  photos?: string[];
  result?: {
    overall: 'Pass' | 'Fail' | 'Conditional';
    items: { name: string; result: 'Pass' | 'Fail' | 'Conditional'; notes?: string }[];
  };
  statusHistory?: StatusHistoryEntry[];
}

// ── OSD ──────────────────────────────────────────────────────────────────

export interface OSDLineItem {
  id: string;
  itemCode: string;
  itemName: string;
  qtyExpected: number;
  qtyReceived: number;
  qtyOver: number;
  qtyShort: number;
  qtyDamaged: number;
  disposition: 'accept' | 'reject' | 'return' | 'claim';
}

export interface OSDReport {
  id: string;
  osdNumber?: string;
  mrrvId: string;
  supplierId?: string;
  supplier?: SupplierRef;
  warehouseId?: string;
  warehouse?: WarehouseRef;
  reportDate: string;
  reportTypes: string[];
  status: 'draft' | 'under_review' | 'claim_sent' | 'awaiting_response' | 'negotiating' | 'resolved' | 'closed';
  totalOverValue?: number;
  totalShortValue?: number;
  totalDamageValue?: number;
  claimSentDate?: string;
  claimReference?: string;
  supplierResponse?: string;
  responseDate?: string;
  resolutionType?: 'credit_note' | 'replacement' | 'price_adjustment' | 'insurance_claim' | 'write_off' | 'returned';
  resolutionAmount?: number;
  resolutionDate?: string;
  resolvedById?: string;
  lineItems?: OSDLineItem[];
  statusHistory?: StatusHistoryEntry[];
  createdAt?: string;
  updatedAt?: string;
}
