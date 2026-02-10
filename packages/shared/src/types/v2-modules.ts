import type { StatusHistoryEntry } from './common.js';

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

// ── Bin Card ────────────────────────────────────────────────────────────

export interface BinCard {
  id: string;
  itemId: string;
  warehouseId: string;
  binNumber: string; // zone-aisle-shelf format: A-03-12
  currentQty: number;
  lastVerifiedAt?: string;
  lastVerifiedById?: string;
  item?: { id: string; itemCode: string; itemDescription: string };
  warehouse?: { id: string; warehouseName: string };
}

export interface BinCardTransaction {
  id: string;
  binCardId: string;
  transactionType: 'receipt' | 'issue' | 'adjustment' | 'transfer';
  referenceType: 'grn' | 'mi' | 'wt' | 'adjustment';
  referenceId: string;
  referenceNumber?: string;
  qtyIn: number;
  qtyOut: number;
  runningBalance: number;
  performedById: string;
  performedAt: string;
}

// ── Rental Contract ─────────────────────────────────────────────────────

export interface RentalContractLine {
  id: string;
  contractId: string;
  equipmentDescription: string;
  qty: number;
  unitRate: number;
  totalRate: number;
}

export interface RentalContract {
  id: string;
  contractNumber: string;
  supplierId: string;
  equipmentType: string;
  startDate: string;
  endDate: string;
  monthlyRate?: number;
  dailyRate?: number;
  status: 'draft' | 'pending_approval' | 'active' | 'extended' | 'terminated' | 'rejected';
  chamberOfCommerceStamped?: boolean;
  insuranceValue?: number;
  insuranceExpiry?: string;
  createdAt: string;
  updatedAt: string;
  lines?: RentalContractLine[];
  supplier?: { id: string; supplierName: string };
  statusHistory?: StatusHistoryEntry[];
}

// ── Generator Fuel & Maintenance ────────────────────────────────────────

export interface GeneratorFuelLog {
  id: string;
  generatorId: string;
  fuelDate: string;
  fuelQtyLiters: number;
  meterReading?: number;
  fuelSupplier?: string;
  costPerLiter?: number;
  totalCost?: number;
  loggedById: string;
  createdAt: string;
  generator?: { id: string; generatorCode: string; generatorName: string };
}

export interface GeneratorMaintenance {
  id: string;
  generatorId: string;
  maintenanceType: 'daily' | 'weekly' | 'monthly' | 'annual';
  scheduledDate: string;
  completedDate?: string;
  performedById?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'overdue';
  findings?: string;
  partsReplaced?: string;
  cost?: number;
  createdAt: string;
  generator?: { id: string; generatorCode: string; generatorName: string };
}

// ── Surplus Management ──────────────────────────────────────────────────

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

// ── Tools Management ────────────────────────────────────────────────────

export interface Tool {
  id: string;
  toolCode: string;
  toolName: string;
  category?: string;
  serialNumber?: string;
  condition: 'good' | 'under_maintenance' | 'damaged' | 'decommissioned';
  ownerId?: string;
  warehouseId?: string;
  purchaseDate?: string;
  warrantyExpiry?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ToolIssue {
  id: string;
  toolId: string;
  issuedToId: string;
  issuedById: string;
  issuedDate: string;
  expectedReturnDate?: string;
  actualReturnDate?: string;
  returnCondition?: string;
  returnVerifiedById?: string;
  status: 'issued' | 'overdue' | 'returned';
  tool?: Tool;
  createdAt: string;
}

// ── Warehouse Zone ──────────────────────────────────────────────────────

export interface WarehouseZone {
  id: string;
  warehouseId: string;
  zoneName: string;
  zoneCode: string;
  zoneType: 'civil' | 'mechanical' | 'electrical' | 'scrap' | 'container' | 'open_yard' | 'hazardous';
  capacity?: number;
  currentOccupancy?: number;
  warehouse?: { id: string; warehouseName: string };
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
