import type { NavItem } from '@nit-scs-v2/shared/types';
import { UserRole } from '@nit-scs-v2/shared/types';

export const NAVIGATION_LINKS: Record<string, NavItem[]> = {
  [UserRole.ADMIN]: [
    // Dashboard
    { label: 'Dashboard', path: '/admin' },

    // ── Section 1: Material Management ──
    {
      label: 'Material Management',
      path: '/admin/material',
      children: [
        { label: 'Overview', path: '/admin/material' },
        { label: 'GRN - Goods Receipt', path: '/admin/material?tab=grn' },
        { label: 'QCI - Quality Inspection', path: '/admin/material?tab=qci' },
        { label: 'DR - Discrepancy Report', path: '/admin/material?tab=dr' },
        { label: 'MI - Material Issuance', path: '/admin/material?tab=mi' },
        { label: 'MRN - Material Return', path: '/admin/material?tab=mrn' },
        { label: 'MR - Material Request', path: '/admin/material?tab=mr' },
        { label: '---', type: 'divider' },
        { label: 'Inventory', path: '/admin/material?tab=inventory' },
        { label: 'Bin Cards', path: '/admin/material?tab=bin-cards' },
        { label: 'Non-Moving Materials', path: '/admin/material?tab=non-moving' },
        { label: 'Item Master', path: '/admin/material?tab=items' },
        { label: '---', type: 'divider' },
        { label: 'IMSF - Material Shifting', path: '/admin/material?tab=imsf' },
        { label: 'WT - Warehouse Transfer', path: '/admin/material?tab=wt' },
        { label: 'Scrap Management', path: '/admin/material?tab=scrap' },
      ],
    },

    // ── Section 2: Logistics & Fleet ──
    {
      label: 'Logistics & Fleet',
      path: '/admin/logistics',
      children: [
        { label: 'Overview', path: '/admin/logistics' },
        { label: 'Job Orders Board', path: '/admin/logistics?tab=kanban' },
        { label: 'All Job Orders', path: '/admin/logistics?tab=all-jobs' },
        { label: '---', type: 'divider' },
        { label: 'Gate Passes', path: '/admin/logistics?tab=gate-passes' },
        { label: '---', type: 'divider' },
        { label: 'Fleet Management', path: '/admin/logistics?tab=fleet' },
        { label: 'Rental Contracts', path: '/admin/logistics?tab=rental-contracts' },
        { label: 'Generators', path: '/admin/logistics?tab=generators' },
        { label: '---', type: 'divider' },
        { label: 'Shipments', path: '/admin/logistics?tab=shipments' },
        { label: 'SLA Dashboard', path: '/admin/logistics?tab=sla' },
      ],
    },

    // ── Section 3: Asset Lifecycle ──
    {
      label: 'Asset Lifecycle',
      path: '/admin/assets',
      children: [
        { label: 'Overview', path: '/admin/assets' },
        { label: 'Surplus Management', path: '/admin/assets?tab=surplus' },
        { label: 'SSC Dashboard', path: '/admin/assets?tab=ssc' },
        { label: '---', type: 'divider' },
        { label: 'Tools Management', path: '/admin/assets?tab=tools' },
        { label: 'Fixed Assets', path: '/admin/assets?tab=fixed-assets' },
        { label: 'Depreciation', path: '/admin/assets?tab=depreciation' },
      ],
    },

    // ── Master Data ──
    {
      label: 'Master Data',
      path: '/admin/master',
      children: [
        { label: 'Overview', path: '/admin/master' },
        { label: 'Suppliers', path: '/admin/master?tab=suppliers' },
        { label: 'Items', path: '/admin/master?tab=items' },
        { label: 'Projects', path: '/admin/master?tab=projects' },
        { label: 'Employees', path: '/admin/master?tab=employees' },
        { label: '---', type: 'divider' },
        { label: 'Warehouses', path: '/admin/master?tab=warehouses' },
        { label: 'Warehouse Zones', path: '/admin/master?tab=warehouse-zones' },
        { label: 'Equipment', path: '/admin/master?tab=equipment' },
      ],
    },

    // ── System ──
    {
      label: 'Admin & Settings',
      path: '/admin/system',
      children: [
        { label: 'Roles & Permissions', path: '/admin/system?tab=roles' },
        { label: 'Audit Log', path: '/admin/system?tab=audit' },
        { label: 'Settings', path: '/admin/system?tab=settings' },
        { label: 'Reports', path: '/admin/system?tab=reports' },
        { label: '---', type: 'divider' },
        { label: 'Approval Levels', path: '/admin/system?tab=approval-levels' },
        { label: 'Workflows', path: '/admin/system?tab=workflows' },
        { label: 'Email Templates', path: '/admin/system?tab=email-templates' },
        { label: 'Email Logs', path: '/admin/system?tab=email-logs' },
        { label: '---', type: 'divider' },
        { label: 'Dashboard Builder', path: '/admin/system/dashboards' },
        { label: 'Report Builder', path: '/admin/system/reports' },
      ],
    },
  ],
  [UserRole.WAREHOUSE_SUPERVISOR]: [
    { label: 'Dashboard', path: '/warehouse' },
    { label: 'Receive (GRN)', path: '/warehouse/receive' },
    { label: 'Issue (MI)', path: '/warehouse/issue' },
    { label: 'Inventory', path: '/warehouse/inventory' },
    { label: 'Returns (MRN)', path: '/warehouse/return' },
  ],
  [UserRole.WAREHOUSE_STAFF]: [
    { label: 'Dashboard', path: '/warehouse' },
    { label: 'Receive (GRN)', path: '/warehouse/receive' },
    { label: 'Issue (MI)', path: '/warehouse/issue' },
    { label: 'Inventory', path: '/warehouse/inventory' },
    { label: 'Returns (MRN)', path: '/warehouse/return' },
  ],
  [UserRole.FREIGHT_FORWARDER]: [
    { label: 'Dashboard', path: '/transport' },
    { label: 'Shipments', path: '/transport/shipments' },
    { label: 'Gate Passes', path: '/transport/gate-passes' },
  ],
  [UserRole.MANAGER]: [
    { label: 'Dashboard', path: '/manager' },
    { label: 'Approval Queue', path: '/manager/approvals' },
    { label: 'Documents', path: '/manager/documents' },
    { label: 'Projects', path: '/manager/projects' },
    { label: 'Tasks', path: '/manager/tasks' },
  ],
  [UserRole.QC_OFFICER]: [
    { label: 'Dashboard', path: '/qc' },
    { label: 'Inspections (QCI)', path: '/qc/inspections' },
    { label: 'Discrepancy Reports (DR)', path: '/qc/dr' },
    { label: 'Incoming', path: '/qc/incoming' },
    { label: 'Tasks', path: '/qc/tasks' },
  ],
  [UserRole.LOGISTICS_COORDINATOR]: [
    { label: 'Dashboard', path: '/logistics' },
    { label: 'Job Orders', path: '/logistics/jobs' },
    { label: 'IMSF', path: '/logistics/imsf' },
    { label: 'Warehouse Transfers', path: '/logistics/wt' },
    { label: 'Shipments', path: '/logistics/shipments' },
    { label: 'Gate Passes', path: '/logistics/gate-passes' },
    { label: 'Tasks', path: '/logistics/tasks' },
  ],
  [UserRole.SITE_ENGINEER]: [
    { label: 'Dashboard', path: '/site-engineer' },
    { label: 'New Request (MR)', path: '/site-engineer/new' },
    { label: 'My Requests', path: '/site-engineer/my-requests' },
    { label: 'My Project', path: '/site-engineer/project' },
    { label: 'Site Inventory', path: '/site-engineer/inventory' },
    { label: 'Tasks', path: '/site-engineer/tasks' },
  ],
  [UserRole.TRANSPORT_SUPERVISOR]: [
    { label: 'Dashboard', path: '/transport-supervisor' },
    { label: 'Job Orders', path: '/transport-supervisor/jobs' },
    { label: 'Fleet', path: '/transport-supervisor/fleet' },
    { label: 'Rental Contracts', path: '/transport-supervisor/rental-contracts' },
    { label: 'Tasks', path: '/transport-supervisor/tasks' },
  ],
  [UserRole.SCRAP_COMMITTEE_MEMBER]: [
    { label: 'Dashboard', path: '/scrap-committee' },
    { label: 'SSC Dashboard', path: '/scrap-committee/ssc' },
    { label: 'Scrap Items', path: '/scrap-committee/scrap' },
    { label: 'Tasks', path: '/scrap-committee/tasks' },
  ],
};
