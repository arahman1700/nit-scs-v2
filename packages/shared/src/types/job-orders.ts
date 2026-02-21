import type { JOType, JobStatus } from './enums.js';
import type { ApprovalChain } from './approval.js';
import type { ProjectRef, SupplierRef, EmployeeRef } from './common.js';

export interface JobOrder {
  id: string;
  joNumber?: string;
  joType: JOType;
  description: string;
  projectId: string;
  project?: ProjectRef;
  supplierId?: string;
  supplier?: SupplierRef;
  requestedById: string;
  requestedBy?: EmployeeRef;
  requestDate: string;
  requiredDate?: string;
  status: JobStatus;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  notes?: string;
  totalAmount?: number;
  startDate?: string;
  completionDate?: string;
  // Transport
  googleMapsPickup?: string;
  googleMapsDelivery?: string;
  driverName?: string;
  driverNationality?: string;
  driverIdNumber?: string;
  vehicleBrand?: string;
  vehicleYear?: number;
  vehiclePlate?: string;
  insuranceValue?: number;
  insuranceRequired?: boolean;
  cnNumber?: string;
  coaApprovalRequired?: boolean;
  shiftStartTime?: string;
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
  // Approval
  quoteAmount?: number;
  quoteApproved?: boolean;
  approvalChain?: ApprovalChain;
  completedById?: string;
  createdAt?: string;
  updatedAt?: string;
  /** @deprecated Use joType */
  type?: JOType;
  /** @deprecated Use description */
  title?: string;
  /** @deprecated Use requestedById */
  requester?: string;
  /** @deprecated Use requestDate */
  date?: string;
  /** @deprecated Use vehiclePlate */
  vehicle?: string;
  /** @deprecated Use driverName */
  driver?: string;
  /** @deprecated Computed server-side */
  slaStatus?: string;
}
