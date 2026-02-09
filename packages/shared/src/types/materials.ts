import type { DocumentStatus } from './enums.js';
import type { StatusHistoryEntry } from './common.js';
import type { ApprovalChain } from './approval.js';

// ── Shared Line Item ─────────────────────────────────────────────────────

export interface VoucherLineItem {
  id: string;
  itemCode: string;
  itemName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  condition?: 'New' | 'Good' | 'Fair' | 'Damaged';
  notes?: string;
  // MRRV specifics
  qtyExpected?: number;
  qtyReceived?: number;
  overDeliveryPct?: number;
  storageLocation?: string;
  lotNumber?: string;
  // MIRV specifics
  qtyApproved?: number;
  qtyIssued?: number;
  qtyAvailable?: number;
  reservationId?: string;
}

export interface MaterialCatalogItem {
  code: string;
  nameAr: string;
  nameEn: string;
  category: string;
  unit: string;
  unitPrice: number;
}

// ── MRRV ─────────────────────────────────────────────────────────────────

export interface MRRV {
  id: string;
  formNumber?: string;
  supplier: string;
  date: string;
  warehouse: string;
  value: number;
  status: DocumentStatus;
  poNumber?: string;
  deliveryNote?: string;
  receivedBy?: string;
  rfimRequired?: boolean;
  rfimCreated?: boolean;
  osdRequired?: boolean;
  osdCreated?: boolean;
  project?: string;
  lineItems?: VoucherLineItem[];
  attachments?: string[];
  statusHistory?: StatusHistoryEntry[];
  createdAt?: string;
  updatedAt?: string;
}

// ── MIRV ─────────────────────────────────────────────────────────────────

export interface MIRV {
  id: string;
  formNumber?: string;
  project: string;
  requester: string;
  date: string;
  warehouse: string;
  value: number;
  status: DocumentStatus;
  approvalLevel?: string;
  gatePassCreated?: boolean;
  gatePassId?: string;
  purpose?: string;
  lineItems?: VoucherLineItem[];
  approvalChain?: ApprovalChain;
  statusHistory?: StatusHistoryEntry[];
  createdAt?: string;
  updatedAt?: string;
}

// ── MRV ──────────────────────────────────────────────────────────────────

export interface MRV {
  id: string;
  formNumber?: string;
  returnType: 'Surplus' | 'Damaged' | 'Wrong Item' | 'Project_Complete';
  date: string;
  project: string;
  warehouse: string;
  status: DocumentStatus;
  reason?: string;
  originalMirvId?: string;
  lineItems?: VoucherLineItem[];
  statusHistory?: StatusHistoryEntry[];
  createdAt?: string;
  updatedAt?: string;
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
  formNumber?: string;
  mrrvId: string;
  reportType: 'Over' | 'Short' | 'Damage';
  qtyAffected: number;
  description: string;
  actionRequired: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  lineItems?: OSDLineItem[];
  rootCause?: string;
  costImpact?: number;
  responsiblePerson?: string;
  statusHistory?: StatusHistoryEntry[];
}
