import type { FormConfig, FormConfigOptions } from '../formTypes';
import { Package, Shield, AlertTriangle } from 'lucide-react';

// ── GRN (V1: mrrv) ──────────────────────────────────────────────────────

export function getGrnConfig(options: FormConfigOptions): FormConfig {
  const { supplierOptions, projectOptions, warehouseOptions, currentUserName, isEditMode } = options;

  return {
    title: isEditMode ? 'Edit Goods Receipt Note' : 'Goods Receipt Note',
    titleEn: 'Goods Receipt Note',
    code: 'GRN',
    subtitle: 'N-MS-NIT-LSS-FRM-0101',
    icon: Package,
    wizardSteps: [
      { id: 'header', label: 'Receipt Details', sectionIndices: [0] },
      { id: 'documents', label: 'Documents & Line Items', sectionIndices: [1] },
      { id: 'review', label: 'Review & Submit', sectionIndices: [] },
    ],
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
}

// ── QCI (V1: rfim) ──────────────────────────────────────────────────────

export function getQciConfig(options: FormConfigOptions): FormConfig {
  const { mrrvOptions, inspectorOptions, isEditMode } = options;

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
}

// ── DR (V1: osd) ─────────────────────────────────────────────────────────

export function getDrConfig(options: FormConfigOptions): FormConfig {
  const { mrrvOptions, supplierOptions, warehouseOptions, isEditMode } = options;

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
}
