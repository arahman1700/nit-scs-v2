import React from 'react';
import { StatusBadge } from '@/components/StatusBadge';

export interface ColumnDef {
  key: string;
  label: string;
  format?: (v: unknown) => string;
  component?: (v: unknown) => React.ReactNode;
}

export interface ResourceConfig {
  title: string;
  code: string;
  columns: ColumnDef[];
}

const sarFormat = (v: unknown) => `${(v as number)?.toLocaleString()} SAR`;
const statusCol = (v: unknown) => <StatusBadge status={v as string} />;
const slaCol = (v: unknown) => {
  const val = v as string;
  return (
    <span
      className={`text-xs font-bold ${val === 'On Track' ? 'text-green-400' : val === 'At Risk' ? 'text-orange-400' : 'text-red-400'}`}
    >
      {val}
    </span>
  );
};

const RESOURCE_COLUMNS: Record<string, ResourceConfig> = {
  mrrv: {
    title: 'Receipt Vouchers',
    code: 'MRRV',
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'supplier', label: 'Supplier' },
      { key: 'date', label: 'Date' },
      { key: 'warehouse', label: 'Warehouse' },
      { key: 'value', label: 'Value', format: sarFormat },
      { key: 'status', label: 'Status', component: statusCol },
      { key: 'poNumber', label: 'PO Number' },
    ],
  },
  mirv: {
    title: 'Issue Vouchers',
    code: 'MIRV',
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'project', label: 'Project' },
      { key: 'requester', label: 'Requester' },
      { key: 'date', label: 'Date' },
      { key: 'warehouse', label: 'Warehouse' },
      { key: 'value', label: 'Value', format: sarFormat },
      { key: 'status', label: 'Status', component: statusCol },
    ],
  },
  mrv: {
    title: 'Return Vouchers',
    code: 'MRV',
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'returnType', label: 'Return Type' },
      { key: 'date', label: 'Date' },
      { key: 'project', label: 'Project' },
      { key: 'warehouse', label: 'Warehouse' },
      { key: 'status', label: 'Status', component: statusCol },
    ],
  },
  shipments: {
    title: 'Shipments',
    code: 'SHP',
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'supplier', label: 'Supplier' },
      { key: 'description', label: 'Description' },
      { key: 'etd', label: 'ETD' },
      { key: 'eta', label: 'ETA' },
      { key: 'port', label: 'Port' },
      { key: 'status', label: 'Status', component: statusCol },
      { key: 'agent', label: 'Agent' },
    ],
  },
  inventory: {
    title: 'Inventory Levels',
    code: 'INV',
    columns: [
      { key: 'code', label: 'Item Code' },
      { key: 'name', label: 'Description' },
      { key: 'warehouse', label: 'Warehouse' },
      { key: 'quantity', label: 'Available Qty' },
      { key: 'reserved', label: 'Reserved' },
      { key: 'onOrder', label: 'On Order' },
      { key: 'stockStatus', label: 'Status', component: statusCol },
    ],
  },
  'job-orders': {
    title: 'Job Orders',
    code: 'JO',
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'type', label: 'Type' },
      { key: 'project', label: 'Project' },
      { key: 'requester', label: 'Requester' },
      { key: 'date', label: 'Date' },
      { key: 'status', label: 'Status', component: statusCol },
      { key: 'slaStatus', label: 'SLA', component: slaCol },
      { key: 'vehicle', label: 'Vehicle' },
      { key: 'driver', label: 'Driver' },
    ],
  },
  rfim: {
    title: 'Inspection Requests',
    code: 'RFIM',
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'mrrvId', label: 'MRRV ID' },
      { key: 'inspectionType', label: 'Inspection Type' },
      { key: 'priority', label: 'Priority' },
      { key: 'status', label: 'Result', component: statusCol },
      { key: 'inspector', label: 'Inspector' },
    ],
  },
  osd: {
    title: 'OSD Reports',
    code: 'OSD',
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'mrrvId', label: 'MRRV ID' },
      { key: 'reportType', label: 'Type' },
      { key: 'qtyAffected', label: 'Qty' },
      { key: 'actionRequired', label: 'Action' },
      { key: 'status', label: 'Status', component: statusCol },
    ],
  },
  projects: {
    title: 'Projects',
    code: 'PROJ',
    columns: [
      { key: 'name', label: 'Project Name' },
      { key: 'client', label: 'Client' },
      { key: 'region', label: 'Region' },
      { key: 'manager', label: 'Project Manager' },
      { key: 'status', label: 'Status', component: statusCol },
    ],
  },
  employees: {
    title: 'Employees',
    code: 'EMP',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'department', label: 'Department' },
      { key: 'title', label: 'Job Title' },
      { key: 'site', label: 'Site' },
    ],
  },
  suppliers: {
    title: 'Suppliers',
    code: 'SUP',
    columns: [
      { key: 'name', label: 'Supplier Name' },
      { key: 'city', label: 'City' },
      { key: 'type', label: 'Type' },
      { key: 'status', label: 'Status', component: statusCol },
    ],
  },
  fleet: {
    title: 'Fleet Management',
    code: 'FLT',
    columns: [
      { key: 'plateNumber', label: 'Plate' },
      { key: 'type', label: 'Type' },
      { key: 'category', label: 'Category' },
      { key: 'projectName', label: 'Project' },
      { key: 'status', label: 'Status', component: statusCol },
      { key: 'driver', label: 'Driver' },
      { key: 'currentJob', label: 'Current Job' },
    ],
  },
  'gate-pass': {
    title: 'Gate Passes',
    code: 'GP',
    columns: [
      { key: 'id', label: 'Pass ID' },
      { key: 'type', label: 'Type' },
      { key: 'linkedDocument', label: 'Linked Doc' },
      { key: 'date', label: 'Date' },
      { key: 'warehouse', label: 'Warehouse' },
      { key: 'vehiclePlate', label: 'Vehicle' },
      { key: 'status', label: 'Status', component: statusCol },
    ],
  },
  'stock-transfer': {
    title: 'Stock Transfers',
    code: 'ST',
    columns: [
      { key: 'id', label: 'Transfer ID' },
      { key: 'date', label: 'Date' },
      { key: 'fromWarehouse', label: 'From' },
      { key: 'toWarehouse', label: 'To' },
      { key: 'status', label: 'Status', component: statusCol },
    ],
  },
  customs: {
    title: 'Customs Clearance',
    code: 'CUS',
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'shipmentId', label: 'Shipment' },
      { key: 'supplier', label: 'Supplier' },
      { key: 'port', label: 'Port' },
      { key: 'status', label: 'Status', component: statusCol },
    ],
  },
  warehouses: {
    title: 'Warehouses',
    code: 'WH',
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Warehouse Name' },
      { key: 'city', label: 'City' },
    ],
  },
  reports: {
    title: 'Shipping Reports',
    code: 'RPT',
    columns: [
      { key: 'id', label: 'Shipment ID' },
      { key: 'supplier', label: 'Supplier' },
      { key: 'description', label: 'Description' },
      { key: 'port', label: 'Port' },
      { key: 'status', label: 'Status', component: statusCol },
      { key: 'value', label: 'Value', format: sarFormat },
    ],
  },
  generators: {
    title: 'Generators',
    code: 'GEN',
    columns: [
      { key: 'assetId', label: 'Asset ID' },
      { key: 'capacityKva', label: 'Capacity (KVA)' },
      { key: 'manufacturer', label: 'Manufacturer' },
      { key: 'project', label: 'Project' },
      { key: 'status', label: 'Status', component: statusCol },
    ],
  },

  // ── V2 Resource Columns ──────────────────────────────────────────────

  grn: {
    title: 'Goods Receipt Notes',
    code: 'GRN',
    columns: [
      { key: 'documentNumber', label: 'GRN #' },
      { key: 'supplierName', label: 'Supplier' },
      { key: 'warehouseName', label: 'Warehouse' },
      { key: 'receivedDate', label: 'Date' },
      { key: 'totalValue', label: 'Value', format: sarFormat },
      { key: 'status', label: 'Status', component: statusCol },
    ],
  },
  qci: {
    title: 'Quality Control Inspections',
    code: 'QCI',
    columns: [
      { key: 'documentNumber', label: 'QCI #' },
      { key: 'grnNumber', label: 'GRN Ref' },
      { key: 'inspectorName', label: 'Inspector' },
      { key: 'inspectionDate', label: 'Date' },
      { key: 'result', label: 'Result' },
      { key: 'status', label: 'Status', component: statusCol },
    ],
  },
  dr: {
    title: 'Discrepancy Reports',
    code: 'DR',
    columns: [
      { key: 'documentNumber', label: 'DR #' },
      { key: 'grnNumber', label: 'GRN Ref' },
      { key: 'discrepancyType', label: 'Type' },
      { key: 'description', label: 'Description' },
      { key: 'status', label: 'Status', component: statusCol },
    ],
  },
  mi: {
    title: 'Material Issuance',
    code: 'MI',
    columns: [
      { key: 'documentNumber', label: 'MI #' },
      { key: 'projectName', label: 'Project' },
      { key: 'requesterName', label: 'Requester' },
      { key: 'issuedDate', label: 'Date' },
      { key: 'warehouseName', label: 'Warehouse' },
      { key: 'totalValue', label: 'Value', format: sarFormat },
      { key: 'status', label: 'Status', component: statusCol },
    ],
  },
  mrn: {
    title: 'Material Return Notes',
    code: 'MRN',
    columns: [
      { key: 'documentNumber', label: 'MRN #' },
      { key: 'returnType', label: 'Return Type' },
      { key: 'projectName', label: 'Project' },
      { key: 'warehouseName', label: 'Warehouse' },
      { key: 'returnDate', label: 'Date' },
      { key: 'status', label: 'Status', component: statusCol },
    ],
  },
  mr: {
    title: 'Material Requests',
    code: 'MR',
    columns: [
      { key: 'documentNumber', label: 'MR #' },
      { key: 'projectName', label: 'Project' },
      { key: 'requesterName', label: 'Requester' },
      { key: 'requestDate', label: 'Date' },
      { key: 'totalValue', label: 'Value', format: sarFormat },
      { key: 'slaStatus', label: 'SLA', component: slaCol },
      { key: 'status', label: 'Status', component: statusCol },
    ],
  },
  imsf: {
    title: 'Internal Material Shifting',
    code: 'IMSF',
    columns: [
      { key: 'documentNumber', label: 'IMSF #' },
      { key: 'senderProjectName', label: 'From Project' },
      { key: 'receiverProjectName', label: 'To Project' },
      { key: 'materialType', label: 'Type' },
      { key: 'requiredDate', label: 'Required' },
      { key: 'status', label: 'Status', component: statusCol },
    ],
  },
  wt: {
    title: 'Warehouse Transfers',
    code: 'WT',
    columns: [
      { key: 'documentNumber', label: 'WT #' },
      { key: 'fromWarehouse', label: 'From' },
      { key: 'toWarehouse', label: 'To' },
      { key: 'transferDate', label: 'Date' },
      { key: 'status', label: 'Status', component: statusCol },
    ],
  },
  surplus: {
    title: 'Surplus Items',
    code: 'SUR',
    columns: [
      { key: 'surplusNumber', label: 'Surplus #' },
      { key: 'itemName', label: 'Item' },
      { key: 'projectName', label: 'Project' },
      { key: 'qty', label: 'Qty' },
      { key: 'disposition', label: 'Disposition' },
      { key: 'estimatedValue', label: 'Value', format: sarFormat },
      { key: 'status', label: 'Status', component: statusCol },
    ],
  },
  scrap: {
    title: 'Scrap Items',
    code: 'SCR',
    columns: [
      { key: 'scrapNumber', label: 'Scrap #' },
      { key: 'materialType', label: 'Material' },
      { key: 'projectName', label: 'Project' },
      { key: 'qty', label: 'Qty' },
      { key: 'estimatedValue', label: 'Est. Value', format: sarFormat },
      { key: 'actualSaleValue', label: 'Sale Value', format: sarFormat },
      { key: 'status', label: 'Status', component: statusCol },
    ],
  },
  tools: {
    title: 'Tool Registry',
    code: 'TOOL',
    columns: [
      { key: 'toolCode', label: 'Code' },
      { key: 'toolName', label: 'Name' },
      { key: 'category', label: 'Category' },
      { key: 'serialNumber', label: 'Serial #' },
      { key: 'condition', label: 'Condition', component: statusCol },
      { key: 'warehouseName', label: 'Warehouse' },
    ],
  },
  'tool-issues': {
    title: 'Tool Issues',
    code: 'TI',
    columns: [
      { key: 'toolName', label: 'Tool' },
      { key: 'issuedToName', label: 'Issued To' },
      { key: 'issuedDate', label: 'Issued' },
      { key: 'expectedReturnDate', label: 'Expected Return' },
      { key: 'actualReturnDate', label: 'Returned' },
      { key: 'status', label: 'Status', component: statusCol },
    ],
  },
  'rental-contracts': {
    title: 'Rental Contracts',
    code: 'RC',
    columns: [
      { key: 'contractNumber', label: 'Contract #' },
      { key: 'supplierName', label: 'Supplier' },
      { key: 'equipmentType', label: 'Equipment' },
      { key: 'startDate', label: 'Start' },
      { key: 'endDate', label: 'End' },
      { key: 'monthlyRate', label: 'Rate/Month', format: sarFormat },
      { key: 'status', label: 'Status', component: statusCol },
    ],
  },
  'gate-passes': {
    title: 'Gate Passes',
    code: 'GP',
    columns: [
      { key: 'documentNumber', label: 'GP #' },
      { key: 'driverName', label: 'Driver' },
      { key: 'vehiclePlateNo', label: 'Plate' },
      { key: 'vehicleType', label: 'Vehicle' },
      { key: 'createdAt', label: 'Date' },
      { key: 'status', label: 'Status', component: statusCol },
    ],
  },
};

const DEFAULT_CONFIG: ResourceConfig = {
  title: 'List',
  code: 'LIST',
  columns: [],
};

export { RESOURCE_COLUMNS };

export function getResourceConfig(resource: string | undefined): ResourceConfig {
  return RESOURCE_COLUMNS[resource || ''] || DEFAULT_CONFIG;
}
