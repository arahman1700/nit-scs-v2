import type { StatusHistoryEntry, ProjectRef, SupplierRef, WarehouseRef, EmployeeRef } from './common.js';
import type { VoucherLineItem } from './materials.js';
import type { ApprovalChain } from './approval.js';

// ── Gate Pass ────────────────────────────────────────────────────────────

export interface GatePass {
  id: string;
  gatePassNumber?: string;
  passType: 'inbound' | 'outbound' | 'transfer';
  warehouseId: string;
  warehouse?: WarehouseRef;
  mirvId?: string;
  projectId?: string;
  project?: ProjectRef;
  vehicleNumber: string;
  vehicleType?: string;
  driverName: string;
  driverIdNumber?: string;
  destination: string;
  purpose?: string;
  issueDate: string;
  validUntil?: string;
  status: 'draft' | 'pending' | 'approved' | 'released' | 'returned' | 'expired' | 'cancelled';
  issuedById?: string;
  securityOfficer?: string;
  exitTime?: string;
  returnTime?: string;
  notes?: string;
  gatePassItems?: VoucherLineItem[];
  statusHistory?: StatusHistoryEntry[];
  createdAt?: string;
  updatedAt?: string;
  /** @deprecated Use passType */
  type?: string;
  /** @deprecated Use issueDate */
  date?: string;
  /** @deprecated Use vehicleNumber */
  vehiclePlate?: string;
  /** @deprecated Use gatePassItems */
  items?: VoucherLineItem[];
  /** @deprecated Use exitTime */
  guardCheckOut?: string;
  /** @deprecated Use returnTime */
  guardCheckIn?: string;
}

// ── Stock Transfer ───────────────────────────────────────────────────────

export interface StockTransfer {
  id: string;
  transferNumber?: string;
  transferType: 'warehouse_to_warehouse' | 'project_to_project' | 'warehouse_to_project' | 'project_to_warehouse';
  fromWarehouseId: string;
  fromWarehouse?: WarehouseRef;
  toWarehouseId: string;
  toWarehouse?: WarehouseRef;
  fromProjectId?: string;
  toProjectId?: string;
  requestedById: string;
  requestedBy?: EmployeeRef;
  transferDate: string;
  status: 'draft' | 'pending' | 'approved' | 'shipped' | 'received' | 'completed' | 'cancelled';
  shippedDate?: string;
  receivedDate?: string;
  sourceMrvId?: string;
  destinationMirvId?: string;
  transportJoId?: string;
  gatePassId?: string;
  notes?: string;
  lineItems?: VoucherLineItem[];
  totalValue?: number;
  approvalChain?: ApprovalChain;
  statusHistory?: StatusHistoryEntry[];
  createdAt?: string;
  updatedAt?: string;
  /** @deprecated Use transferDate */
  date?: string;
}

// ── Material Requisition (MRF) ───────────────────────────────────────────

export interface MaterialRequisition {
  id: string;
  mrfNumber?: string;
  requestDate: string;
  requiredDate?: string;
  projectId: string;
  project?: ProjectRef;
  requestedById: string;
  requestedBy?: EmployeeRef;
  department?: 'electrical' | 'mechanical' | 'civil' | 'safety' | 'general';
  deliveryPoint?: string;
  workOrder?: string;
  drawingReference?: string;
  priority?: 'urgent' | 'high' | 'medium' | 'low';
  status:
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
  totalEstimatedValue?: number;
  mirvId?: string;
  reviewedById?: string;
  reviewDate?: string;
  approvedById?: string;
  approvalDate?: string;
  fulfillmentDate?: string;
  convertedToImsfId?: string;
  notes?: string;
  lineItems?: VoucherLineItem[];
  approvalChain?: ApprovalChain;
  statusHistory?: StatusHistoryEntry[];
  createdAt?: string;
  updatedAt?: string;
  /** @deprecated Use requestDate */
  date?: string;
  /** @deprecated Use requestedById */
  requester?: string;
  /** @deprecated Use totalEstimatedValue */
  totalValue?: number;
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
  shipmentNumber?: string;
  supplierId: string;
  supplier?: SupplierRef;
  freightForwarderId?: string;
  projectId?: string;
  project?: ProjectRef;
  originCountry?: string;
  modeOfShipment?: 'sea_fcl' | 'sea_lcl' | 'air' | 'land' | 'courier';
  portOfLoading?: string;
  portOfEntryId?: string;
  destinationWarehouseId?: string;
  orderDate?: string;
  expectedShipDate?: string;
  actualShipDate?: string;
  etaPort?: string;
  actualArrivalDate?: string;
  deliveryDate?: string;
  status:
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
  awbBlNumber?: string;
  containerNumber?: string;
  vesselFlight?: string;
  trackingUrl?: string;
  commercialValue?: number;
  freightCost?: number;
  insuranceCost?: number;
  dutiesEstimated?: number;
  description?: string;
  mrrvId?: string;
  transportJoId?: string;
  notes?: string;
  lineItems?: ShipmentLine[];
  documents?: ShipmentDocument[];
  statusHistory?: StatusHistoryEntry[];
  createdAt?: string;
  updatedAt?: string;
  /** @deprecated Use expectedShipDate */
  etd?: string;
  /** @deprecated Use etaPort */
  eta?: string;
  /** @deprecated Use commercialValue */
  value?: number;
  /** @deprecated Use portOfEntryId */
  port?: string;
  /** @deprecated Use modeOfShipment */
  shipmentType?: string;
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
