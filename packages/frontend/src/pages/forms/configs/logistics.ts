import type { FormConfig, FormConfigOptions } from '../formTypes';
import { Ship, Truck } from 'lucide-react';

// ── Shipment ─────────────────────────────────────────────────────────────

export function getShipmentConfig(options: FormConfigOptions): FormConfig {
  const { supplierOptions, projectOptions, isEditMode } = options;

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
            options: ['sea_fcl', 'sea_lcl', 'air', 'land', 'courier'],
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
}

// ── Gate Pass ─────────────────────────────────────────────────────────────

export function getGatePassConfig(options: FormConfigOptions): FormConfig {
  const { warehouseOptions, isEditMode } = options;

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
}
