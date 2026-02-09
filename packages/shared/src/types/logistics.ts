import type { StatusHistoryEntry } from './common.js';
import type { VoucherLineItem } from './materials.js';
import type { ApprovalChain } from './approval.js';

// ── Gate Pass ────────────────────────────────────────────────────────────

export interface GatePass {
  id: string;
  type: 'Inbound' | 'Outbound' | 'Transfer';
  date: string;
  warehouse: string;
  linkedDocument?: string;
  linkedDocumentType?: 'MRRV' | 'MIRV' | 'ST';
  vehiclePlate?: string;
  driverName?: string;
  driverIdNumber?: string;
  status: 'Draft' | 'Active' | 'Completed' | 'Cancelled';
  items?: VoucherLineItem[];
  guardCheckIn?: string;
  guardCheckOut?: string;
  notes?: string;
  statusHistory?: StatusHistoryEntry[];
}

// ── Stock Transfer ───────────────────────────────────────────────────────

export interface StockTransfer {
  id: string;
  date: string;
  fromWarehouse: string;
  toWarehouse: string;
  fromProject?: string;
  toProject?: string;
  status: 'Draft' | 'Pending Approval' | 'Approved' | 'In Transit' | 'Received' | 'Completed' | 'Cancelled';
  lineItems?: VoucherLineItem[];
  totalValue?: number;
  transferType: 'inter_warehouse' | 'inter_project';
  approvalRequired?: boolean;
  approvalChain?: ApprovalChain;
  notes?: string;
  statusHistory?: StatusHistoryEntry[];
}

// ── Material Requisition (MRF) ───────────────────────────────────────────

export interface MaterialRequisition {
  id: string;
  date: string;
  project: string;
  requester: string;
  warehouse?: string;
  suggestedWarehouse?: string;
  status: 'Draft' | 'Pending Approval' | 'Approved' | 'Converted to MIRV' | 'Rejected' | 'Cancelled';
  lineItems?: VoucherLineItem[];
  totalValue?: number;
  mirvId?: string;
  approvalChain?: ApprovalChain;
  budgetAvailable?: number;
  budgetImpact?: number;
  urgency?: 'Normal' | 'Urgent' | 'Critical';
  notes?: string;
  statusHistory?: StatusHistoryEntry[];
}

// ── Shipment ─────────────────────────────────────────────────────────────

export interface ShipmentLine {
  id: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  unit: string;
  weight?: number;
  hsCode?: string;
}

export interface ShipmentDocument {
  id: string;
  type: 'BOL' | 'Invoice' | 'Packing List' | 'COO' | 'Insurance' | 'Other';
  name: string;
  uploaded: boolean;
  url?: string;
}

export interface Shipment {
  id: string;
  supplier: string;
  description?: string;
  etd: string;
  eta: string;
  port: string;
  status: 'New' | 'Booked' | 'In Transit' | 'Arrived' | 'Customs Clearance' | 'In Clearance' | 'Delivered';
  agent?: string;
  value?: number;
  containerNumber?: string;
  awbNumber?: string;
  bolNumber?: string;
  shipmentType?: 'Sea' | 'Air' | 'Land';
  lineItems?: ShipmentLine[];
  documents?: ShipmentDocument[];
  statusHistory?: StatusHistoryEntry[];
}

// ── Customs ──────────────────────────────────────────────────────────────

export interface CustomsTracking {
  id: string;
  shipmentId: string;
  declarationNumber?: string;
  hsCode?: string;
  customsFees?: number;
  vatAmount?: number;
  brokerName?: string;
  brokerContact?: string;
  status: 'Submitted' | 'Under Review' | 'Additional Docs Required' | 'Cleared' | 'Released' | 'Held';
  submissionDate?: string;
  clearanceDate?: string;
  documents?: string[];
  notes?: string;
  statusHistory?: StatusHistoryEntry[];
}
