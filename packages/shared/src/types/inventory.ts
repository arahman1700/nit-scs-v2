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
