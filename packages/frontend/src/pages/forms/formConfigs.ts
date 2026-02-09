import { Package, Truck, Shield, AlertTriangle, RefreshCw, FileText } from 'lucide-react';
import type { VoucherLineItem } from '@nit-scs-v2/shared/types';
import {
  validateGRN,
  validateMI,
  validateMRN,
  validateJO,
  validateQCI,
  validateDR,
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
  mrrv: ['Draft', 'Pending QC', 'Received', 'Stored'],
  mirv: ['Draft', 'Pending Approval', 'Approved', 'Issued'],
  mrv: ['Draft', 'Inspected', 'Accepted', 'Stored'],
  jo: ['New', 'Quote', 'Approved', 'Assigned', 'In Progress', 'Completed'],
  rfim: ['Pending', 'In Progress', 'Completed'],
  osd: ['Open', 'Under Review', 'Resolved'],
};

export const EDITABLE_STATUSES: Record<string, string[]> = {
  mrrv: ['Draft'],
  mirv: ['Draft'],
  mrv: ['Draft'],
  jo: ['New', 'Draft'],
  rfim: ['Pending'],
  osd: ['Open'],
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
        title: isEditMode ? 'Edit Material Issue Request' : 'Material Issue Request',
        titleEn: 'Material Issue Request',
        code: 'MIRV',
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
                key: 'purpose',
                label: 'Purpose of Issue',
                type: 'textarea',
                required: true,
                placeholder: 'Electrical cables for installation work...',
              },
              { key: 'notes', label: 'Notes', type: 'textarea' },
            ],
          },
        ],
      };
    case 'mrrv':
      return {
        title: isEditMode ? 'Edit Material Receiving Report' : 'Material Receiving Report',
        titleEn: 'Material Receiving Report',
        code: 'MRRV',
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
              { key: 'rfimRequired', label: 'Requires Inspection (RFIM)?', type: 'checkbox' },
              { key: 'attachments', label: 'Attachments', type: 'file' },
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
            ],
          },
        ],
      };
    case 'rfim':
      return {
        title: isEditMode ? 'Edit Inspection Request' : 'Request for Inspection of Materials',
        titleEn: 'Request for Inspection of Materials',
        code: 'RFIM',
        subtitle: 'N-MS-NIT-QC-FRM-0101',
        icon: Shield,
        sections: [
          {
            title: 'Voucher Reference',
            fields: [
              { key: 'mrrvId', label: 'MRRV Reference', type: 'select', options: mrrvOptions, required: true },
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
        title: isEditMode ? 'Edit OSD Report' : 'Over/Short/Damage Report',
        titleEn: 'Over/Short/Damage Report',
        code: 'OSD',
        subtitle: 'N-MS-NIT-QC-FRM-0102',
        icon: AlertTriangle,
        sections: [
          {
            title: 'Voucher Reference',
            fields: [
              { key: 'mrrvId', label: 'MRRV Reference', type: 'select', options: mrrvOptions, required: true },
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
                key: 'reportType',
                label: 'Issue Type',
                type: 'select',
                options: ['Shortage', 'Overage', 'Damage'],
                required: true,
              },
              { key: 'qtyAffected', label: 'Quantity Affected', type: 'number', required: true },
              {
                key: 'description',
                label: 'Description',
                type: 'textarea',
                required: true,
                placeholder: 'Damage to outer packaging...',
              },
            ],
          },
          {
            title: 'Action Required',
            fields: [
              {
                key: 'actionRequired',
                label: 'Action',
                type: 'select',
                options: ['Contact Supplier', 'Replace', 'Accept As-Is', 'Return', 'Claim Insurance'],
                required: true,
              },
              { key: 'notes', label: 'Notes', type: 'textarea' },
              { key: 'attachments', label: 'Photos/Documents', type: 'file' },
            ],
          },
        ],
      };
    case 'mrv':
      return {
        title: isEditMode ? 'Edit Material Return Voucher' : 'Material Return Voucher',
        titleEn: 'Material Return Voucher',
        code: 'MRV',
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
                options: ['Surplus', 'Damaged', 'Wrong Item', 'Project Completion'],
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
              { key: 'attachments', label: 'Attachments', type: 'file' },
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
