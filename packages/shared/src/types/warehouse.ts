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
