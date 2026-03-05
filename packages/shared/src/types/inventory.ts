export interface InventoryItem {
  id: string;
  code: string;
  name: string;
  warehouse: string;
  warehouseId?: string;
  quantity: number;
  reserved: number;
  onOrder: number;
  stockStatus: 'In Stock' | 'Low Stock' | 'Out of Stock';
  minLevel: number;
  reorderPoint?: number;
  category: string;
  location: string;
  lastMovement?: string;
  unitPrice?: number;
  totalValue?: number;
}

export interface InventoryLot {
  id: string;
  itemId: string;
  warehouseId: string;
  lotNumber: string;
  mrrvLineId?: string;
  receiptDate: string;
  initialQty: number;
  availableQty: number;
  reservedQty?: number;
  unitCost?: number;
  supplierId?: string;
  binLocation?: string;
  expiryDate?: string;
  status: 'active' | 'depleted' | 'expired' | 'blocked';
  version: number;
  /** @deprecated Use mrrvLineId */
  mrrvId?: string;
  /** @deprecated Use initialQty */
  quantity?: number;
  /** @deprecated Use availableQty */
  remainingQty?: number;
  /** @deprecated Use binLocation */
  location?: string;
}

export interface InventoryLevel {
  itemId: string;
  itemCode: string;
  itemName: string;
  warehouseId: string;
  warehouseName: string;
  qtyOnHand: number;
  qtyReserved: number;
  qtyAvailable: number;
  qtyOnOrder: number;
  minStock: number;
  reorderPoint: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Overstocked';
}

export interface StockReservation {
  id: string;
  itemId: string;
  warehouseId: string;
  mirvId: string;
  quantity: number;
  status: 'active' | 'released' | 'consumed';
  createdAt: string;
}

// ── Surplus Management ──────────────────────────────────────────────────

import type { StatusHistoryEntry } from './common.js';

export interface SurplusItem {
  id: string;
  surplusNumber: string;
  itemId: string;
  warehouseId: string;
  projectId?: string;
  qty: number;
  condition: string;
  estimatedValue?: number;
  disposition: 'transfer' | 'return' | 'retain' | 'sell';
  status: 'identified' | 'evaluated' | 'approved' | 'actioned' | 'closed' | 'rejected';
  ouHeadApprovalDate?: string;
  scmApprovalDate?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  item?: { id: string; itemCode: string; itemDescription: string };
  warehouse?: { id: string; warehouseName: string };
  statusHistory?: StatusHistoryEntry[];
}

// ── Scrap Management ────────────────────────────────────────────────────

export interface ScrapItem {
  id: string;
  scrapNumber: string;
  projectId?: string;
  warehouseId: string;
  materialType: 'cable' | 'mv_cable' | 'hv_cable' | 'aluminum' | 'copper' | 'steel' | 'cable_tray' | 'wood' | 'other';
  description?: string;
  qty: number;
  packaging?: string;
  condition?: string;
  estimatedValue?: number;
  actualSaleValue?: number;
  status: 'identified' | 'reported' | 'approved' | 'in_ssc' | 'sold' | 'disposed' | 'closed' | 'rejected';
  photos?: string[];
  siteManagerApproval?: boolean;
  qcApproval?: boolean;
  storekeeperApproval?: boolean;
  buyerName?: string;
  buyerPickupDeadline?: string;
  smartContainerId?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  statusHistory?: StatusHistoryEntry[];
}

export interface SscBid {
  id: string;
  scrapBatchId: string;
  bidderName: string;
  bidderContact?: string;
  bidAmount: number;
  bidDate: string;
  status: 'submitted' | 'under_review' | 'accepted' | 'rejected';
  sscMemoSigned?: boolean;
  financeCopyDate?: string;
  createdAt: string;
}
