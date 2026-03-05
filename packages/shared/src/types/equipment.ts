import type { StatusHistoryEntry } from './common.js';

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
