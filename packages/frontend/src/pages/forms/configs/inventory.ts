import type { FormConfig, FormConfigOptions } from '../formTypes';
import { AlertTriangle, Package } from 'lucide-react';

// ── Scrap ─────────────────────────────────────────────────────────────────

export function getScrapConfig(options: FormConfigOptions): FormConfig {
  const { projectOptions, warehouseOptions, isEditMode } = options;

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
            options: ['cable', 'mv_cable', 'hv_cable', 'aluminum', 'copper', 'steel', 'cable_tray', 'wood', 'other'],
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
}

// ── Surplus ───────────────────────────────────────────────────────────────

export function getSurplusConfig(options: FormConfigOptions): FormConfig {
  const { warehouseOptions, projectOptions, isEditMode } = options;

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
}
