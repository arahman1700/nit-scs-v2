import type { FormConfig, FormConfigOptions } from '../formTypes';
import { Package, RefreshCw, Clipboard } from 'lucide-react';

// ── MI (V1: mirv) ────────────────────────────────────────────────────────

export function getMiConfig(options: FormConfigOptions): FormConfig {
  const { projectOptions, warehouseOptions, currentUserName, isEditMode } = options;

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
            options: ['normal', 'urgent', 'emergency'],
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
}

// ── MRN (V1: mrv) ────────────────────────────────────────────────────────

export function getMrnConfig(options: FormConfigOptions): FormConfig {
  const { projectOptions, warehouseOptions, currentUserName, isEditMode } = options;

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
}

// ── MR (V1: mrf) ─────────────────────────────────────────────────────────

export function getMrConfig(options: FormConfigOptions): FormConfig {
  const { projectOptions, currentUserName, isEditMode } = options;

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
}
