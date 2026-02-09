import type { JOType, JobStatus } from './enums.js';
import type { ApprovalChain } from './approval.js';

export interface JobOrder {
  id: string;
  type: JOType;
  title: string;
  requester: string;
  date: string;
  status: JobStatus;
  priority: 'High' | 'Medium' | 'Low' | 'Normal';
  project?: string;
  slaStatus?: 'On Track' | 'At Risk' | 'Overdue';
  vehicle?: string;
  driver?: string;
  approvalChain?: ApprovalChain;
  estimatedCost?: number;
  actualCost?: number;
  // Transport
  pickupLocationUrl?: string;
  deliveryLocationUrl?: string;
  pickupContactName?: string;
  pickupContactPhone?: string;
  deliveryContactName?: string;
  deliveryContactPhone?: string;
  materialPriceSar?: number;
  insuranceRequired?: boolean;
  numberOfTrailers?: number;
  includeLoadingEquipment?: boolean;
  loadingEquipmentType?: string;
  cargoType?: string;
  cargoWeightTons?: number;
  numberOfTrips?: number;
  // Rental
  rentalStartDate?: string;
  rentalEndDate?: string;
  monthlyRate?: number;
  dailyRate?: number;
  withOperator?: boolean;
  overtimeApproval?: boolean;
  overtimeHours?: number;
  // Scrap
  scrapType?: string;
  scrapWeightTons?: number;
  scrapDestination?: string;
  scrapDescription?: string;
  // Generator
  generatorCapacityKva?: number;
  generatorMaintenanceType?: string;
  generatorIssueDescription?: string;
  shiftStartTime?: string;
  // Approval
  quoteAmount?: number;
  quoteApproved?: boolean;
}
