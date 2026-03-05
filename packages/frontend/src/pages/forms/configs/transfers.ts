import type { FormConfig, FormConfigOptions } from '../formTypes';
import { ArrowRightLeft, Users } from 'lucide-react';

// ── IMSF ─────────────────────────────────────────────────────────────────

export function getImsfConfig(options: FormConfigOptions): FormConfig {
  const { projectOptions, isEditMode } = options;

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
}

// ── WT (V1: stock_transfer) ──────────────────────────────────────────────

export function getWtConfig(options: FormConfigOptions): FormConfig {
  const { warehouseOptions, currentUserName, isEditMode } = options;

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
            options: ['Warehouse to Warehouse', 'Project to Project', 'Warehouse to Project', 'Project to Warehouse'],
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
}

// ── Handover ─────────────────────────────────────────────────────────────

export function getHandoverConfig(options: FormConfigOptions): FormConfig {
  const { inspectorOptions, warehouseOptions, currentUserName, isEditMode } = options;

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
}
