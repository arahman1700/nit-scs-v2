import type { StatusHistoryEntry, EmployeeRef, WarehouseRef } from './common.js';
import type { VoucherLineItem } from './materials.js';
import type { ApprovalChain } from './approval.js';

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
}

// ── IMSF (Internal Material Shifting Form) ─────────────────────────────

export interface ImsfLine {
  id: string;
  imsfId: string;
  itemId: string;
  description: string;
  qty: number;
  uomId?: string;
  poNumber?: string;
  mrfNumber?: string;
}

export interface Imsf {
  id: string;
  imsfNumber: string;
  senderProjectId: string;
  receiverProjectId: string;
  materialType: 'normal' | 'hazardous';
  status: 'created' | 'sent' | 'confirmed' | 'in_transit' | 'delivered' | 'completed' | 'rejected';
  originMrId?: string;
  requiredDate?: string;
  notes?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  lines?: ImsfLine[];
  statusHistory?: StatusHistoryEntry[];
}

// ── Storekeeper Handover ────────────────────────────────────────────────

export interface StorekeeperHandover {
  id: string;
  warehouseId: string;
  outgoingEmployeeId: string;
  incomingEmployeeId: string;
  handoverDate: string;
  status: 'initiated' | 'in_progress' | 'completed';
  inventoryVerified?: boolean;
  discrepanciesFound?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
