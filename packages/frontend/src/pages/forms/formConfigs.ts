import {
  Package,
  Truck,
  Shield,
  AlertTriangle,
  RefreshCw,
  FileText,
  ArrowRightLeft,
  Clipboard,
  Ship,
  Users,
} from 'lucide-react';
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
} from '@nit-scs-v2/shared/validators';

// ── Types ──────────────────────────────────────────────────────────────────

export interface FormFieldDef {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  defaultValue?: string;
  readOnly?: boolean;
  placeholder?: string;
  onChange?: string;
}

export interface FormSectionConfig {
  title: string;
  fields: FormFieldDef[];
}

export interface FormConfig {
  title: string;
  titleEn: string;
  code: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  sections: FormSectionConfig[];
}

// ── Constants ──────────────────────────────────────────────────────────────

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
};

// ── Helpers ────────────────────────────────────────────────────────────────

export const getApprovalInfo = (value: number): { level: string; color: string } => {
  if (value < 10000) return { level: 'Level 1 - Storekeeper', color: 'text-green-400' };
  if (value < 50000) return { level: 'Level 2 - Logistics Manager', color: 'text-blue-400' };
  if (value < 100000) return { level: 'Level 3 - Department Head', color: 'text-yellow-400' };
  if (value < 500000) return { level: 'Level 4 - Operations Director', color: 'text-orange-400' };
  return { level: 'Level 5 - CEO', color: 'text-red-400' };
};

// ── Form Config Builder ────────────────────────────────────────────────────

export interface FormConfigOptions {
  projectOptions: string[];
  warehouseOptions: string[];
  supplierOptions: string[];
  mrrvOptions: string[];
  inspectorOptions: string[];
  isEditMode: boolean;
  currentUserName: string;
}

export function getFormConfig(formType: string | undefined, options: FormConfigOptions): FormConfig {
  const {
    projectOptions,
    warehouseOptions,
    supplierOptions,
    mrrvOptions,
    inspectorOptions,
    isEditMode,
    currentUserName,
  } = options;

  switch (formType) {
    case 'mirv':
      return {
        title: isEditMode ? 'Edit Material Issuance' : 'Material Issuance',
        titleEn: 'Material Issuance',
        code: 'MI',
        subtitle: 'N-MS-NIT-LSS-FRM-0102',
        icon: Package,
        sections: [
          {
            title: 'Basic Information',
            fields: [
              {
                key: 'requestDate',
                label: 'Request Date',
                type: 'date',
                required: true,
                defaultValue: new Date().toISOString().split('T')[0],
              },
              { key: 'project', label: 'Project', type: 'select', options: projectOptions, required: true },
              { key: 'warehouse', label: 'Warehouse', type: 'select', options: warehouseOptions, required: true },
              { key: 'requester', label: 'Requester', type: 'text', defaultValue: currentUserName, readOnly: true },
            ],
          },
          {
            title: 'Request Details',
            fields: [
              {
                key: 'priority',
                label: 'Priority',
                type: 'select',
                options: ['low', 'normal', 'high', 'urgent'],
              },
              { key: 'locationOfWork', label: 'Location of Work', type: 'text', placeholder: 'Building 3, Floor 2' },
              {
                key: 'notes',
                label: 'Purpose / Notes',
                type: 'textarea',
                required: true,
                placeholder: 'Electrical cables for installation work...',
              },
            ],
          },
        ],
      };
    case 'mrrv':
      return {
        title: isEditMode ? 'Edit Goods Receipt Note' : 'Goods Receipt Note',
        titleEn: 'Goods Receipt Note',
        code: 'GRN',
        subtitle: 'N-MS-NIT-LSS-FRM-0101',
        icon: Package,
        sections: [
          {
            title: 'Receipt Details',
            fields: [
              {
                key: 'date',
                label: 'Receipt Date',
                type: 'date',
                required: true,
                defaultValue: new Date().toISOString().split('T')[0],
              },
              { key: 'supplier', label: 'Supplier', type: 'select', options: supplierOptions, required: true },
              { key: 'project', label: 'Project', type: 'select', options: projectOptions, required: true },
              { key: 'warehouse', label: 'Warehouse', type: 'select', options: warehouseOptions, required: true },
            ],
          },
          {
            title: 'Documents',
            fields: [
              { key: 'poNumber', label: 'PO Number', type: 'text', required: true, placeholder: 'PO-2026-00XXX' },
              {
                key: 'deliveryNote',
                label: 'Delivery Note (DN)',
                type: 'text',
                required: true,
                placeholder: 'DN-XXXXX',
              },
              {
                key: 'receivedBy',
                label: 'Received By',
                type: 'text',
                defaultValue: currentUserName,
                readOnly: true,
              },
              { key: 'rfimRequired', label: 'Requires Inspection (QCI)?', type: 'checkbox' },
            ],
          },
        ],
      };
    case 'jo':
      return {
        title: isEditMode ? 'Edit Job Order' : 'New Job Order',
        titleEn: 'Job Order',
        code: 'JO',
        subtitle: 'N-MS-NIT-LSS-FRM-0201',
        icon: Truck,
        sections: [
          {
            title: 'Request Information',
            fields: [
              {
                key: 'requestDate',
                label: 'Request Date',
                type: 'date',
                required: true,
                defaultValue: new Date().toISOString().split('T')[0],
              },
              { key: 'project', label: 'Project', type: 'select', options: projectOptions, required: true },
              { key: 'requester', label: 'Requester', type: 'text', defaultValue: currentUserName, readOnly: true },
              {
                key: 'priority',
                label: 'Priority',
                type: 'select',
                options: ['Normal', 'High', 'Critical'],
                required: true,
              },
            ],
          },
          {
            title: 'Service Type',
            fields: [
              {
                key: 'joType',
                label: 'Job Order Type',
                type: 'select',
                options: [
                  'Transport',
                  'Equipment',
                  'Generator_Rental',
                  'Generator_Maintenance',
                  'Rental_Daily',
                  'Rental_Monthly',
                  'Scrap',
                ],
                required: true,
                onChange: 'joType',
              },
              {
                key: 'description',
                label: 'Description',
                type: 'textarea',
                required: true,
                placeholder: 'Describe the job order requirements...',
              },
            ],
          },
        ],
      };
    case 'rfim':
      return {
        title: isEditMode ? 'Edit Quality Control Inspection' : 'Quality Control Inspection',
        titleEn: 'Quality Control Inspection',
        code: 'QCI',
        subtitle: 'N-MS-NIT-QC-FRM-0101',
        icon: Shield,
        sections: [
          {
            title: 'Voucher Reference',
            fields: [
              { key: 'mrrvId', label: 'GRN Reference', type: 'select', options: mrrvOptions, required: true },
              {
                key: 'inspectionDate',
                label: 'Required Inspection Date',
                type: 'date',
                required: true,
                defaultValue: new Date().toISOString().split('T')[0],
              },
            ],
          },
          {
            title: 'Inspection Details',
            fields: [
              {
                key: 'inspectionType',
                label: 'Inspection Type',
                type: 'select',
                options: ['Visual', 'Functional', 'Dimensional', 'Lab Test'],
                required: true,
              },
              {
                key: 'priority',
                label: 'Priority',
                type: 'select',
                options: ['Normal', 'Urgent', 'Critical'],
                required: true,
              },
              { key: 'inspector', label: 'Inspector', type: 'select', options: inspectorOptions },
            ],
          },
          {
            title: 'Items to Inspect',
            fields: [
              {
                key: 'itemsDescription',
                label: 'Items Description',
                type: 'textarea',
                required: true,
                placeholder: 'Electrical cables 50mm - 500 meters\nCircuit breakers - 20 pieces',
              },
              {
                key: 'specifications',
                label: 'Required Specifications',
                type: 'textarea',
                placeholder: 'Compliant with SASO standards...',
              },
              { key: 'notes', label: 'Notes', type: 'textarea' },
            ],
          },
        ],
      };
    case 'osd':
      return {
        title: isEditMode ? 'Edit Discrepancy Report' : 'Discrepancy Report',
        titleEn: 'Discrepancy Report',
        code: 'DR',
        subtitle: 'N-MS-NIT-QC-FRM-0102',
        icon: AlertTriangle,
        sections: [
          {
            title: 'Voucher Reference',
            fields: [
              { key: 'mrrvId', label: 'GRN Reference', type: 'select', options: mrrvOptions, required: true },
              {
                key: 'reportDate',
                label: 'Report Date',
                type: 'date',
                required: true,
                defaultValue: new Date().toISOString().split('T')[0],
              },
            ],
          },
          {
            title: 'Issue Details',
            fields: [
              {
                key: 'reportTypes',
                label: 'Issue Types',
                type: 'select',
                options: ['shortage', 'overage', 'damage'],
                required: true,
              },
              { key: 'supplier', label: 'Supplier', type: 'select', options: supplierOptions },
              { key: 'warehouse', label: 'Warehouse', type: 'select', options: warehouseOptions },
              { key: 'poNumber', label: 'PO Number', type: 'text', placeholder: 'PO-2026-XXXXX' },
            ],
          },
          {
            title: 'Values & Resolution',
            fields: [
              { key: 'totalOverValue', label: 'Overage Value (SAR)', type: 'number' },
              { key: 'totalShortValue', label: 'Shortage Value (SAR)', type: 'number' },
              { key: 'totalDamageValue', label: 'Damage Value (SAR)', type: 'number' },
              { key: 'claimReference', label: 'Claim Reference', type: 'text', placeholder: 'CLM-XXXXX' },
            ],
          },
        ],
      };
    case 'mrv':
      return {
        title: isEditMode ? 'Edit Material Return Note' : 'Material Return Note',
        titleEn: 'Material Return Note',
        code: 'MRN',
        subtitle: 'N-MS-NIT-LSS-FRM-0103',
        icon: RefreshCw,
        sections: [
          {
            title: 'Return Information',
            fields: [
              {
                key: 'returnDate',
                label: 'Return Date',
                type: 'date',
                required: true,
                defaultValue: new Date().toISOString().split('T')[0],
              },
              { key: 'project', label: 'Project', type: 'select', options: projectOptions, required: true },
              {
                key: 'fromWarehouse',
                label: 'From Warehouse',
                type: 'select',
                options: warehouseOptions,
              },
              {
                key: 'warehouse',
                label: 'Receiving Warehouse',
                type: 'select',
                options: warehouseOptions,
                required: true,
              },
              {
                key: 'returnType',
                label: 'Return Type',
                type: 'select',
                options: ['Return to Warehouse', 'Return to Supplier', 'Scrap', 'Transfer to Project'],
                required: true,
              },
            ],
          },
          {
            title: 'Additional Information',
            fields: [
              {
                key: 'reason',
                label: 'Return Reason',
                type: 'textarea',
                required: true,
                placeholder: 'Surplus quantity after completing phase one...',
              },
              {
                key: 'returnedBy',
                label: 'Returned By',
                type: 'text',
                defaultValue: currentUserName,
                readOnly: true,
              },
              { key: 'notes', label: 'Notes', type: 'textarea' },
            ],
          },
        ],
      };
    case 'mr':
      return {
        title: isEditMode ? 'Edit Material Request' : 'Material Request',
        titleEn: 'Material Request',
        code: 'MR',
        subtitle: 'N-MS-NIT-LSS-FRM-0104',
        icon: Clipboard,
        sections: [
          {
            title: 'Request Information',
            fields: [
              {
                key: 'requestDate',
                label: 'Request Date',
                type: 'date',
                required: true,
                defaultValue: new Date().toISOString().split('T')[0],
              },
              { key: 'project', label: 'Project', type: 'select', options: projectOptions, required: true },
              {
                key: 'priority',
                label: 'Priority',
                type: 'select',
                options: ['low', 'medium', 'high', 'urgent'],
                required: true,
              },
              {
                key: 'requiredDate',
                label: 'Required By Date',
                type: 'date',
                required: true,
              },
              {
                key: 'requestedBy',
                label: 'Requested By',
                type: 'text',
                defaultValue: currentUserName,
                readOnly: true,
              },
            ],
          },
          {
            title: 'Details',
            fields: [
              {
                key: 'purpose',
                label: 'Purpose',
                type: 'textarea',
                required: true,
                placeholder: 'Describe the purpose of this material request...',
              },
              { key: 'notes', label: 'Notes', type: 'textarea' },
            ],
          },
        ],
      };
    case 'imsf':
      return {
        title: isEditMode ? 'Edit Material Shifting Form' : 'Internal Material Shifting',
        titleEn: 'Internal Material Shifting Form',
        code: 'IMSF',
        subtitle: 'N-MS-NIT-LSS-FRM-0201',
        icon: ArrowRightLeft,
        sections: [
          {
            title: 'Transfer Information',
            fields: [
              {
                key: 'senderProject',
                label: 'Sending Project',
                type: 'select',
                options: projectOptions,
                required: true,
              },
              {
                key: 'receiverProject',
                label: 'Receiving Project',
                type: 'select',
                options: projectOptions,
                required: true,
              },
              {
                key: 'materialType',
                label: 'Material Type',
                type: 'select',
                options: ['Normal', 'Hazardous'],
                required: true,
              },
            ],
          },
          {
            title: 'Details',
            fields: [
              {
                key: 'reason',
                label: 'Reason for Transfer',
                type: 'textarea',
                required: true,
                placeholder: 'Project X has surplus cables needed by Project Y...',
              },
              { key: 'notes', label: 'Notes', type: 'textarea' },
            ],
          },
        ],
      };
    case 'wt':
      return {
        title: isEditMode ? 'Edit Warehouse Transfer' : 'Warehouse Transfer',
        titleEn: 'Warehouse Transfer',
        code: 'WT',
        subtitle: 'N-MS-NIT-LSS-FRM-0202',
        icon: ArrowRightLeft,
        sections: [
          {
            title: 'Transfer Details',
            fields: [
              {
                key: 'transferType',
                label: 'Transfer Type',
                type: 'select',
                options: [
                  'Warehouse to Warehouse',
                  'Project to Project',
                  'Warehouse to Project',
                  'Project to Warehouse',
                ],
                required: true,
              },
              {
                key: 'sourceWarehouse',
                label: 'Source Warehouse',
                type: 'select',
                options: warehouseOptions,
                required: true,
              },
              {
                key: 'destinationWarehouse',
                label: 'Destination Warehouse',
                type: 'select',
                options: warehouseOptions,
                required: true,
              },
              {
                key: 'transferDate',
                label: 'Transfer Date',
                type: 'date',
                required: true,
                defaultValue: new Date().toISOString().split('T')[0],
              },
              {
                key: 'requestedBy',
                label: 'Requested By',
                type: 'text',
                defaultValue: currentUserName,
                readOnly: true,
              },
            ],
          },
          {
            title: 'Additional Information',
            fields: [
              {
                key: 'reason',
                label: 'Reason',
                type: 'textarea',
                placeholder: 'Material consolidation, project requirement...',
              },
              { key: 'notes', label: 'Notes', type: 'textarea' },
            ],
          },
        ],
      };
    case 'shipment':
      return {
        title: isEditMode ? 'Edit Shipment' : 'New Shipment',
        titleEn: 'Shipment Tracking',
        code: 'SHIP',
        subtitle: 'N-MS-NIT-LOG-FRM-0301',
        icon: Ship,
        sections: [
          {
            title: 'Shipment Information',
            fields: [
              { key: 'poNumber', label: 'PO Number', type: 'text', required: true, placeholder: 'PO-2026-XXXXX' },
              { key: 'supplier', label: 'Supplier', type: 'select', options: supplierOptions, required: true },
              { key: 'project', label: 'Project', type: 'select', options: projectOptions },
              {
                key: 'modeOfShipment',
                label: 'Mode',
                type: 'select',
                options: ['Sea FCL', 'Sea LCL', 'Air', 'Land', 'Courier'],
                required: true,
              },
            ],
          },
          {
            title: 'Dates & Tracking',
            fields: [
              { key: 'orderDate', label: 'Order Date', type: 'date', required: true },
              { key: 'expectedShipDate', label: 'Expected Ship Date', type: 'date' },
              { key: 'awbBlNumber', label: 'AWB/BL Number', type: 'text', placeholder: 'Tracking number' },
              { key: 'containerNumber', label: 'Container Number', type: 'text' },
            ],
          },
          {
            title: 'Financials',
            fields: [
              { key: 'commercialValue', label: 'Commercial Value (SAR)', type: 'number' },
              { key: 'freightCost', label: 'Freight Cost (SAR)', type: 'number' },
              { key: 'insuranceCost', label: 'Insurance Cost (SAR)', type: 'number' },
              { key: 'notes', label: 'Notes', type: 'textarea' },
            ],
          },
        ],
      };
    case 'scrap':
      return {
        title: isEditMode ? 'Edit Scrap Item' : 'Scrap Identification',
        titleEn: 'Scrap Management',
        code: 'SCRAP',
        subtitle: 'N-MS-NIT-AST-FRM-0401',
        icon: AlertTriangle,
        sections: [
          {
            title: 'Scrap Details',
            fields: [
              { key: 'project', label: 'Project', type: 'select', options: projectOptions, required: true },
              {
                key: 'materialType',
                label: 'Material Type',
                type: 'select',
                options: [
                  'cable',
                  'mv_cable',
                  'hv_cable',
                  'aluminum',
                  'copper',
                  'steel',
                  'cable_tray',
                  'wood',
                  'other',
                ],
                required: true,
              },
              { key: 'warehouse', label: 'Warehouse', type: 'select', options: warehouseOptions },
              { key: 'qty', label: 'Quantity', type: 'number', required: true },
              { key: 'condition', label: 'Condition', type: 'text', placeholder: 'Describe material condition' },
              { key: 'description', label: 'Description', type: 'textarea', required: true },
              { key: 'estimatedValue', label: 'Estimated Value (SAR)', type: 'number' },
              { key: 'photos', label: 'Photos (min. 3)', type: 'file', required: true },
            ],
          },
        ],
      };
    case 'surplus':
      return {
        title: isEditMode ? 'Edit Surplus Item' : 'Surplus Identification',
        titleEn: 'Surplus Management',
        code: 'SURPLUS',
        subtitle: 'N-MS-NIT-AST-FRM-0402',
        icon: Package,
        sections: [
          {
            title: 'Surplus Details',
            fields: [
              { key: 'item', label: 'Item', type: 'text', required: true },
              { key: 'warehouse', label: 'Warehouse', type: 'select', options: warehouseOptions, required: true },
              { key: 'project', label: 'Project', type: 'select', options: projectOptions },
              { key: 'qty', label: 'Quantity', type: 'number', required: true },
              {
                key: 'condition',
                label: 'Condition',
                type: 'select',
                options: ['New', 'Good', 'Fair', 'Damaged'],
                required: true,
              },
              { key: 'estimatedValue', label: 'Estimated Value (SAR)', type: 'number' },
              {
                key: 'disposition',
                label: 'Disposition',
                type: 'select',
                options: ['Transfer', 'Return', 'Retain', 'Sell'],
              },
            ],
          },
        ],
      };
    case 'gatepass':
      return {
        title: isEditMode ? 'Edit Gate Pass' : 'Gate Pass',
        titleEn: 'Gate Pass',
        code: 'GP',
        subtitle: 'N-MS-NIT-LSS-FRM-0105',
        icon: Truck,
        sections: [
          {
            title: 'Pass Details',
            fields: [
              {
                key: 'passType',
                label: 'Pass Type',
                type: 'select',
                options: ['Inbound', 'Outbound', 'Transfer'],
                required: true,
              },
              { key: 'vehicleNumber', label: 'Vehicle Plate', type: 'text', required: true },
              { key: 'driverName', label: 'Driver Name', type: 'text', required: true },
              { key: 'warehouse', label: 'Warehouse', type: 'select', options: warehouseOptions, required: true },
              { key: 'destination', label: 'Destination', type: 'text', required: true },
              { key: 'issueDate', label: 'Issue Date', type: 'datetime-local', required: true },
              { key: 'validUntil', label: 'Valid Until', type: 'datetime-local' },
            ],
          },
          {
            title: 'Reference',
            fields: [
              { key: 'mirvId', label: 'MI Reference', type: 'text', placeholder: 'MI document ID' },
              { key: 'purpose', label: 'Purpose', type: 'text' },
              { key: 'notes', label: 'Notes', type: 'textarea' },
            ],
          },
        ],
      };
    case 'rental_contract':
      return {
        title: isEditMode ? 'Edit Rental Contract' : 'Rental Contract',
        titleEn: 'Rental Contract',
        code: 'RC',
        subtitle: 'N-MS-NIT-LOG-FRM-0302',
        icon: FileText,
        sections: [
          {
            title: 'Contract Information',
            fields: [
              { key: 'supplier', label: 'Supplier', type: 'select', options: supplierOptions, required: true },
              { key: 'startDate', label: 'Start Date', type: 'date', required: true },
              { key: 'endDate', label: 'End Date', type: 'date', required: true },
              { key: 'monthlyRate', label: 'Monthly Rate (SAR)', type: 'number' },
              { key: 'dailyRate', label: 'Daily Rate (SAR)', type: 'number' },
            ],
          },
          {
            title: 'Details',
            fields: [
              {
                key: 'equipmentType',
                label: 'Equipment Type',
                type: 'text',
                required: true,
                placeholder: 'Forklift 5T, Crane 30T...',
              },
              { key: 'notes', label: 'Notes', type: 'textarea' },
            ],
          },
        ],
      };
    case 'handover':
      return {
        title: isEditMode ? 'Edit Storekeeper Handover' : 'Storekeeper Handover',
        titleEn: 'Storekeeper Handover',
        code: 'HO',
        subtitle: 'N-MS-NIT-WH-FRM-0501',
        icon: Users,
        sections: [
          {
            title: 'Handover Details',
            fields: [
              {
                key: 'fromUser',
                label: 'Handing Over (From)',
                type: 'text',
                defaultValue: currentUserName,
                readOnly: true,
              },
              { key: 'toUser', label: 'Receiving (To)', type: 'select', options: inspectorOptions, required: true },
              { key: 'warehouse', label: 'Warehouse', type: 'select', options: warehouseOptions, required: true },
              {
                key: 'handoverDate',
                label: 'Handover Date',
                type: 'date',
                required: true,
                defaultValue: new Date().toISOString().split('T')[0],
              },
            ],
          },
          {
            title: 'Verification',
            fields: [
              { key: 'inventoryVerified', label: 'Inventory Verified?', type: 'checkbox' },
              { key: 'discrepanciesFound', label: 'Discrepancies Found?', type: 'checkbox' },
              { key: 'notes', label: 'Notes / Discrepancy Details', type: 'textarea' },
            ],
          },
        ],
      };
    default:
      return {
        title: 'Generic Form',
        titleEn: 'Generic Form',
        code: 'GEN',
        subtitle: 'Standard Operation Form',
        icon: FileText,
        sections: [
          {
            title: 'Details',
            fields: [{ key: 'description', label: 'Description', type: 'textarea', required: true }],
          },
        ],
      };
  }
}

// ── JO Type Sections ───────────────────────────────────────────────────────

export function getJoTypeSections(joType: string): FormSectionConfig[] {
  if (!joType) return [];

  const typeKey = joType.split(' - ')[0];
  switch (typeKey) {
    case 'Transport':
      return [
        {
          title: 'Transport Details',
          fields: [
            {
              key: 'pickupLocation',
              label: 'Pickup Location',
              type: 'text',
              required: true,
              placeholder: 'Dammam Warehouse',
            },
            {
              key: 'deliveryLocation',
              label: 'Delivery Location',
              type: 'text',
              required: true,
              placeholder: 'Project Site',
            },
            {
              key: 'cargoType',
              label: 'Cargo Type',
              type: 'text',
              required: true,
              placeholder: 'Construction Material',
            },
            { key: 'cargoWeight', label: 'Cargo Weight (Tons)', type: 'number', required: true },
            { key: 'numberOfTrailers', label: 'Number of Trailers', type: 'number' },
            { key: 'materialPrice', label: 'Material Value (SAR)', type: 'number' },
            { key: 'insuranceRequired', label: 'Insurance Required?', type: 'checkbox' },
            { key: 'insuranceValue', label: 'Material Value for Insurance (SAR)', type: 'number' },
            { key: 'entryPermit', label: 'Entry Permit Required?', type: 'checkbox' },
          ],
        },
        {
          title: 'Driver & Vehicle Details',
          fields: [
            { key: 'driverName', label: 'Driver Name', type: 'text', placeholder: 'Full name' },
            { key: 'driverNationality', label: 'Nationality', type: 'text' },
            { key: 'driverIdNumber', label: 'ID/Iqama Number', type: 'text' },
            { key: 'vehicleBrand', label: 'Vehicle Brand', type: 'text', placeholder: 'Toyota, Volvo...' },
            { key: 'vehicleYear', label: 'Vehicle Year', type: 'number' },
            { key: 'vehiclePlate', label: 'Plate Number', type: 'text', required: true },
          ],
        },
        {
          title: 'Logistics Details',
          fields: [
            {
              key: 'googleMapsPickup',
              label: 'Pickup Location (Maps URL)',
              type: 'text',
              placeholder: 'https://maps.google.com/...',
            },
            {
              key: 'googleMapsDelivery',
              label: 'Delivery Location (Maps URL)',
              type: 'text',
              placeholder: 'https://maps.google.com/...',
            },
            { key: 'cnNumber', label: 'CN Number', type: 'text', placeholder: 'Nesma CN#' },
            { key: 'shiftStartTime', label: 'Shift Start Time', type: 'datetime-local' },
          ],
        },
        {
          title: 'Budget & Approval',
          fields: [{ key: 'projectBudgetApproved', label: 'Project Budget Approved?', type: 'checkbox' }],
        },
      ];
    case 'Equipment':
      return [
        {
          title: 'Equipment Details',
          fields: [
            {
              key: 'equipmentType',
              label: 'Equipment Type',
              type: 'select',
              options: [
                'Forklift 3T',
                'Forklift 5T',
                'Forklift 7T',
                'Crane 30T',
                'Crane 50T',
                'Boom Truck 10T',
                'Trailer (Trella)',
                'Diyanna',
              ],
              required: true,
            },
            { key: 'quantity', label: 'Quantity', type: 'number', required: true },
            { key: 'durationDays', label: 'Duration (Days)', type: 'number', required: true },
            { key: 'projectSite', label: 'Project Site', type: 'text', required: true },
            { key: 'withOperator', label: 'With Operator?', type: 'checkbox' },
          ],
        },
        {
          title: 'Budget & Approval',
          fields: [{ key: 'projectBudgetApproved', label: 'Project Budget Approved?', type: 'checkbox' }],
        },
      ];
    case 'Generator_Rental':
      return [
        {
          title: 'Generator Rental Details',
          fields: [
            {
              key: 'capacityKva',
              label: 'Capacity (KVA)',
              type: 'select',
              options: ['100', '250', '500', '750', '1000'],
              required: true,
            },
            { key: 'rentalStart', label: 'Rental Start Date', type: 'date', required: true },
            { key: 'rentalEnd', label: 'Rental End Date', type: 'date', required: true },
            { key: 'siteLocation', label: 'Installation Site', type: 'text', required: true },
            { key: 'fuelIncluded', label: 'Fuel Included?', type: 'checkbox' },
          ],
        },
        {
          title: 'Budget & Approval',
          fields: [{ key: 'projectBudgetApproved', label: 'Project Budget Approved?', type: 'checkbox' }],
        },
      ];
    case 'Generator_Maintenance':
      return [
        {
          title: 'Generator Maintenance Details',
          fields: [
            { key: 'generatorId', label: 'Generator ID', type: 'text', required: true },
            {
              key: 'capacityKva',
              label: 'Capacity (KVA)',
              type: 'select',
              options: ['100', '250', '500', '750', '1000'],
              required: true,
            },
            {
              key: 'maintenanceType',
              label: 'Maintenance Type',
              type: 'select',
              options: ['Preventive', 'Corrective', 'Emergency'],
              required: true,
            },
            { key: 'issueDescription', label: 'Issue Description', type: 'textarea', required: true },
          ],
        },
        {
          title: 'Budget & Approval',
          fields: [{ key: 'projectBudgetApproved', label: 'Project Budget Approved?', type: 'checkbox' }],
        },
      ];
    case 'Scrap':
      return [
        {
          title: 'Scrap Details',
          fields: [
            {
              key: 'scrapType',
              label: 'Scrap Type',
              type: 'select',
              options: ['Metal', 'Cable', 'Wood', 'Mixed', 'Electronic'],
              required: true,
            },
            { key: 'weightTons', label: 'Weight (Tons)', type: 'number', required: true },
            { key: 'destination', label: 'Destination', type: 'text', required: true },
            { key: 'description', label: 'Description', type: 'textarea', required: true },
            { key: 'photos', label: 'Photos (min. 3)', type: 'file' },
          ],
        },
        {
          title: 'Budget & Approval',
          fields: [{ key: 'projectBudgetApproved', label: 'Project Budget Approved?', type: 'checkbox' }],
        },
      ];
    case 'Rental_Daily':
      return [
        {
          title: 'Daily Rental Details',
          fields: [
            {
              key: 'equipmentType',
              label: 'Equipment Type',
              type: 'select',
              options: ['Forklift 3T', 'Forklift 5T', 'Crane 30T', 'Boom Truck', 'Trailer'],
              required: true,
            },
            { key: 'dailyRate', label: 'Daily Rate (SAR)', type: 'number', required: true },
            { key: 'startDate', label: 'Start Date', type: 'date', required: true },
            { key: 'endDate', label: 'End Date', type: 'date', required: true },
            { key: 'withOperator', label: 'With Operator?', type: 'checkbox' },
          ],
        },
        {
          title: 'Budget & Approval',
          fields: [{ key: 'projectBudgetApproved', label: 'Project Budget Approved?', type: 'checkbox' }],
        },
      ];
    case 'Rental_Monthly':
      return [
        {
          title: 'Monthly Rental Details',
          fields: [
            {
              key: 'equipmentType',
              label: 'Equipment Type',
              type: 'select',
              options: ['Forklift 3T', 'Forklift 5T', 'Crane 30T', 'Generator 250KVA', 'Generator 500KVA'],
              required: true,
            },
            { key: 'monthlyRate', label: 'Monthly Rate (SAR)', type: 'number', required: true },
            { key: 'startDate', label: 'Start Date', type: 'date', required: true },
            { key: 'durationMonths', label: 'Duration (Months)', type: 'number', required: true },
            { key: 'withOperator', label: 'With Operator?', type: 'checkbox' },
            { key: 'coaApprovalRequired', label: 'COO Approval Required', type: 'checkbox' },
          ],
        },
        {
          title: 'Budget & Approval',
          fields: [{ key: 'projectBudgetApproved', label: 'Project Budget Approved?', type: 'checkbox' }],
        },
      ];
    default:
      return [];
  }
}
