import type { FormConfig, FormConfigOptions, FormSectionConfig } from '../formTypes';
import { Truck } from 'lucide-react';

// ── Job Order ────────────────────────────────────────────────────────────

export function getJoConfig(options: FormConfigOptions): FormConfig {
  const { projectOptions, currentUserName, isEditMode } = options;

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
            options: ['low', 'normal', 'high', 'urgent'],
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
              'transport',
              'equipment',
              'generator_rental',
              'generator_maintenance',
              'rental_daily',
              'rental_monthly',
              'scrap',
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
}

// ── JO Type Sub-Sections ─────────────────────────────────────────────────

export function getJoTypeSections(joType: string): FormSectionConfig[] {
  if (!joType) return [];

  const typeKey = joType.split(' - ')[0].toLowerCase();
  switch (typeKey) {
    case 'transport':
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
    case 'equipment':
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
    case 'generator_rental':
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
    case 'generator_maintenance':
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
    case 'scrap':
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
    case 'rental_daily':
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
    case 'rental_monthly':
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
