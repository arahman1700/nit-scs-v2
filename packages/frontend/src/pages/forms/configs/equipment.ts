import type { FormConfig, FormConfigOptions } from '../formTypes';
import { Wrench, FileText, Zap } from 'lucide-react';

// ── Tool ─────────────────────────────────────────────────────────────────

export function getToolConfig(options: FormConfigOptions): FormConfig {
  const { warehouseOptions, isEditMode } = options;

  return {
    title: isEditMode ? 'Edit Tool' : 'Register Tool',
    titleEn: 'Tool Registration',
    code: 'TOOL',
    subtitle: 'N-MS-NIT-WH-FRM-0601',
    icon: Wrench,
    sections: [
      {
        title: 'Tool Details',
        fields: [
          { key: 'toolCode', label: 'Tool Code', type: 'text', required: true, placeholder: 'e.g. TL-001' },
          { key: 'toolName', label: 'Tool Name', type: 'text', required: true, placeholder: 'e.g. Power Drill' },
          { key: 'category', label: 'Category', type: 'text', placeholder: 'e.g. Power Tools, Hand Tools' },
          { key: 'serialNumber', label: 'Serial Number', type: 'text', placeholder: 'Optional' },
          {
            key: 'condition',
            label: 'Condition',
            type: 'select',
            options: ['good', 'under_maintenance', 'damaged', 'decommissioned'],
            defaultValue: 'good',
          },
          { key: 'warehouse', label: 'Warehouse', type: 'select', options: warehouseOptions },
        ],
      },
      {
        title: 'Dates & Warranty',
        fields: [
          { key: 'purchaseDate', label: 'Purchase Date', type: 'date' },
          { key: 'warrantyExpiry', label: 'Warranty Expiry', type: 'date' },
        ],
      },
    ],
  };
}

// ── Rental Contract ──────────────────────────────────────────────────────

export function getRentalContractConfig(options: FormConfigOptions): FormConfig {
  const { supplierOptions, isEditMode } = options;

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
}

// ── Generator ────────────────────────────────────────────────────────────

export function getGeneratorConfig(options: FormConfigOptions): FormConfig {
  const { warehouseOptions, projectOptions, isEditMode } = options;

  return {
    title: isEditMode ? 'Edit Generator' : 'Register Generator',
    titleEn: 'Generator Registration',
    code: 'GEN',
    subtitle: 'N-MS-NIT-EQ-FRM-0701',
    icon: Zap,
    sections: [
      {
        title: 'Generator Details',
        fields: [
          {
            key: 'generatorCode',
            label: 'Generator Code',
            type: 'text',
            required: true,
            placeholder: 'e.g. GEN-001',
          },
          {
            key: 'generatorName',
            label: 'Generator Name',
            type: 'text',
            required: true,
            placeholder: 'e.g. CAT 250KVA',
          },
          { key: 'capacityKva', label: 'Capacity (KVA)', type: 'number', required: true },
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: ['available', 'assigned', 'maintenance', 'decommissioned'],
            defaultValue: 'available',
          },
          { key: 'warehouse', label: 'Current Warehouse', type: 'select', options: warehouseOptions },
          { key: 'project', label: 'Current Project', type: 'select', options: projectOptions },
        ],
      },
      {
        title: 'Financial & Depreciation',
        fields: [
          { key: 'purchaseDate', label: 'Purchase Date', type: 'date' },
          { key: 'purchaseValue', label: 'Purchase Value (SAR)', type: 'number' },
          { key: 'salvageValue', label: 'Salvage Value (SAR)', type: 'number' },
          { key: 'usefulLifeMonths', label: 'Useful Life (Months)', type: 'number' },
          {
            key: 'depreciationMethod',
            label: 'Depreciation Method',
            type: 'select',
            options: ['straight_line', 'usage_based'],
          },
          { key: 'inServiceDate', label: 'In Service Date', type: 'date' },
        ],
      },
    ],
  };
}
