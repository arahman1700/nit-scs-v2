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
  /** @deprecated Use joType — still used in pdfExport + dashboards */
  type?: JOType;
  /** @deprecated Use description — still used in dashboards */
  title?: string;
  /** @deprecated Use requestedById — still used in pdfExport */
  requester?: string;
  /** @deprecated Use requestDate — still used in dashboards */
  date?: string;
  /** @deprecated Use vehiclePlate — still used in pdfExport */
  vehicle?: string;
  /** @deprecated Use driverName — still used in pdfExport */
  driver?: string;
  /** @deprecated Computed server-side — still used in pdfExport */
  slaStatus?: string;
}

// ── Discriminated JO subtypes ─────────────────────────────────────────
// Use these in new code that handles a specific JO type.
// JobOrder (above) remains the full union for backward compatibility.

/** Common fields shared by all JO subtypes. */
export interface BaseJobOrder {
  id: string;
  joNumber?: string;
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
  quoteAmount?: number;
  quoteApproved?: boolean;
  approvalChain?: ApprovalChain;
  completedById?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TransportJO extends BaseJobOrder {
  joType: 'transport';
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
}

export interface RentalJO extends BaseJobOrder {
  joType: 'rental_monthly' | 'rental_daily';
  rentalStartDate?: string;
  rentalEndDate?: string;
  monthlyRate?: number;
  dailyRate?: number;
  withOperator?: boolean;
  overtimeApproval?: boolean;
  overtimeHours?: number;
}

export interface EquipmentJO extends BaseJobOrder {
  joType: 'equipment';
}

export interface ScrapJO extends BaseJobOrder {
  joType: 'scrap';
  scrapType?: string;
  scrapWeightTons?: number;
  scrapDestination?: string;
  scrapDescription?: string;
}

export interface GeneratorJO extends BaseJobOrder {
  joType: 'generator_rental' | 'generator_maintenance';
  generatorCapacityKva?: number;
  generatorMaintenanceType?: string;
  generatorIssueDescription?: string;
}

/** Discriminated union of all JO subtypes. Use for type-safe switching on joType. */
export type TypedJobOrder = TransportJO | RentalJO | EquipmentJO | ScrapJO | GeneratorJO;
