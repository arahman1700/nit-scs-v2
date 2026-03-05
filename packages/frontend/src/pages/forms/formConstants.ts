import type { VoucherLineItem } from '@nit-scs-v2/shared/types';
import {
  validateGRN,
  validateMI,
  validateMRN,
  validateJO,
  validateQCI,
  validateDR,
  validateMR,
  validateIMSF,
  validateScrap,
  validateSurplus,
  validateRentalContract,
  validateWT,
  validateGatePass,
  validateShipment,
  validateHandover,
  validateTool,
  validateGeneratorMaintenance,
} from '@nit-scs-v2/shared/validators';

// ── Status Flows ──────────────────────────────────────────────────────────

export const STATUS_FLOWS: Record<string, string[]> = {
  mrrv: ['Draft', 'Pending QC', 'QC Approved', 'Received', 'Stored'],
  mirv: ['Draft', 'Pending Approval', 'Approved', 'Partially Issued', 'Issued', 'Completed', 'Rejected', 'Cancelled'],
  mrv: ['Draft', 'Pending', 'Received', 'Completed', 'Rejected'],
  jo: [
    'Draft',
    'Pending Approval',
    'Quoted',
    'Approved',
    'Assigned',
    'In Progress',
    'On Hold',
    'Completed',
    'Closure Pending',
    'Closure Approved',
    'Invoiced',
    'Rejected',
    'Cancelled',
  ],
  rfim: ['Pending', 'In Progress', 'Completed'],
  osd: ['Draft', 'Under Review', 'Claim Sent', 'Awaiting Response', 'Negotiating', 'Resolved', 'Closed'],
  mr: [
    'Draft',
    'Submitted',
    'Under Review',
    'Approved',
    'Checking Stock',
    'From Stock',
    'Needs Purchase',
    'Partially Fulfilled',
    'Fulfilled',
    'Rejected',
    'Cancelled',
  ],
  imsf: ['Created', 'Sent', 'Confirmed', 'In Transit', 'Delivered', 'Completed', 'Rejected'],
  scrap: ['Identified', 'Reported', 'Approved', 'In SSC', 'Sold', 'Disposed', 'Closed', 'Rejected'],
  surplus: ['Identified', 'Evaluated', 'Approved', 'Actioned', 'Closed', 'Rejected'],
  wt: ['Draft', 'Pending', 'Approved', 'Shipped', 'Received', 'Completed', 'Cancelled'],
  rental_contract: ['Draft', 'Pending Approval', 'Active', 'Extended', 'Terminated', 'Rejected'],
  gatepass: ['Draft', 'Pending', 'Approved', 'Released', 'Returned', 'Expired', 'Cancelled'],
  shipment: [
    'Draft',
    'PO Issued',
    'In Production',
    'Ready to Ship',
    'In Transit',
    'At Port',
    'Customs Clearing',
    'Cleared',
    'In Delivery',
    'Delivered',
    'Cancelled',
  ],
  handover: ['Initiated', 'In Progress', 'Completed'],
};

// ── Editable Statuses ─────────────────────────────────────────────────────

export const EDITABLE_STATUSES: Record<string, string[]> = {
  mrrv: ['Draft'],
  mirv: ['Draft', 'Rejected'],
  mrv: ['Draft', 'Rejected'],
  jo: ['Draft', 'Rejected'],
  rfim: ['Pending'],
  osd: ['Draft'],
  mr: ['Draft', 'Rejected'],
  imsf: ['Created', 'Rejected'],
  scrap: ['Identified'],
  surplus: ['Identified', 'Rejected'],
  wt: ['Draft', 'Cancelled'],
  rental_contract: ['Draft', 'Rejected'],
  gatepass: ['Draft'],
  shipment: ['Draft'],
  handover: ['Initiated'],
};

// ── Validator Map ─────────────────────────────────────────────────────────

export const VALIDATOR_MAP: Record<
  string,
  (
    data: Record<string, unknown>,
    lineItems: VoucherLineItem[],
  ) => {
    valid: boolean;
    errors: { field: string; rule: string; message: string }[];
    warnings: { field: string; rule: string; message: string }[];
  }
> = {
  mrrv: validateGRN,
  mirv: validateMI,
  mrv: validateMRN,
  jo: validateJO,
  rfim: validateQCI,
  osd: validateDR,
  mr: validateMR,
  imsf: validateIMSF,
  scrap: validateScrap as (
    data: Record<string, unknown>,
    lineItems: VoucherLineItem[],
  ) => {
    valid: boolean;
    errors: { field: string; rule: string; message: string }[];
    warnings: { field: string; rule: string; message: string }[];
  },
  surplus: validateSurplus as (
    data: Record<string, unknown>,
    lineItems: VoucherLineItem[],
  ) => {
    valid: boolean;
    errors: { field: string; rule: string; message: string }[];
    warnings: { field: string; rule: string; message: string }[];
  },
  rental_contract: validateRentalContract as (
    data: Record<string, unknown>,
    lineItems: VoucherLineItem[],
  ) => {
    valid: boolean;
    errors: { field: string; rule: string; message: string }[];
    warnings: { field: string; rule: string; message: string }[];
  },
  wt: validateWT,
  gatepass: validateGatePass as (
    data: Record<string, unknown>,
    lineItems: VoucherLineItem[],
  ) => {
    valid: boolean;
    errors: { field: string; rule: string; message: string }[];
    warnings: { field: string; rule: string; message: string }[];
  },
  shipment: validateShipment as (
    data: Record<string, unknown>,
    lineItems: VoucherLineItem[],
  ) => {
    valid: boolean;
    errors: { field: string; rule: string; message: string }[];
    warnings: { field: string; rule: string; message: string }[];
  },
  handover: validateHandover as (
    data: Record<string, unknown>,
    lineItems: VoucherLineItem[],
  ) => {
    valid: boolean;
    errors: { field: string; rule: string; message: string }[];
    warnings: { field: string; rule: string; message: string }[];
  },
  tool: validateTool as (
    data: Record<string, unknown>,
    lineItems: VoucherLineItem[],
  ) => {
    valid: boolean;
    errors: { field: string; rule: string; message: string }[];
    warnings: { field: string; rule: string; message: string }[];
  },
  generator_maintenance: validateGeneratorMaintenance as (
    data: Record<string, unknown>,
    lineItems: VoucherLineItem[],
  ) => {
    valid: boolean;
    errors: { field: string; rule: string; message: string }[];
    warnings: { field: string; rule: string; message: string }[];
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────

export const getApprovalInfo = (value: number): { level: string; color: string } => {
  if (value < 10000) return { level: 'Level 1 - Storekeeper', color: 'text-green-400' };
  if (value < 50000) return { level: 'Level 2 - Logistics Manager', color: 'text-blue-400' };
  if (value < 100000) return { level: 'Level 3 - Department Head', color: 'text-yellow-400' };
  if (value < 500000) return { level: 'Level 4 - Operations Director', color: 'text-orange-400' };
  return { level: 'Level 5 - CEO', color: 'text-red-400' };
};
