import type { NavItem } from '@nit-scs/shared/types';
import { UserRole } from '@nit-scs/shared/types';

export const NAVIGATION_LINKS: Record<string, NavItem[]> = {
  [UserRole.ADMIN]: [
    // 1. Dashboard (Home)
    { label: 'Dashboard', path: '/admin' },

    // 2. Inventory & Warehouses
    {
      label: 'Inventory & Warehouses',
      path: '/admin/inventory',
      children: [
        { label: 'Overview', path: '/admin/inventory' },
        { label: 'Stock Levels', path: '/admin/inventory?tab=stock-levels' },
        { label: 'Warehouses', path: '/admin/inventory?tab=warehouses' },
        { label: 'Movements', path: '/admin/inventory?tab=movements' },
        { label: '---', type: 'divider' },
        { label: 'Inventory Dashboard', path: '/admin/inventory?tab=dashboard' },
        { label: 'Shifting Materials', path: '/admin/inventory?tab=shifting' },
        { label: 'Non-Moving Materials', path: '/admin/inventory?tab=non-moving' },
      ],
    },

    // 3. Receiving & Inbound
    {
      label: 'Receiving & Inbound',
      path: '/admin/receiving',
      children: [
        { label: 'Overview', path: '/admin/receiving' },
        { label: 'Receipt Vouchers (MRRV)', path: '/admin/receiving?tab=mrrv' },
        { label: 'Shipments', path: '/admin/receiving?tab=shipments' },
        { label: 'Customs Clearance', path: '/admin/receiving?tab=customs' },
        { label: 'Gate Passes', path: '/admin/receiving?tab=gate-passes' },
      ],
    },

    // 4. Issuing & Outbound
    {
      label: 'Issuing & Outbound',
      path: '/admin/issuing',
      children: [
        { label: 'Overview', path: '/admin/issuing' },
        { label: 'Issue Vouchers (MIRV)', path: '/admin/issuing?tab=mirv' },
        { label: 'Approvals', path: '/admin/issuing?tab=approvals' },
        { label: 'Material Requisitions', path: '/admin/issuing?tab=mrf' },
        { label: '---', type: 'divider' },
        { label: 'Gate Passes', path: '/admin/issuing?tab=gate-passes' },
        { label: 'Stock Transfers', path: '/admin/issuing?tab=stock-transfers' },
      ],
    },

    // 5. Returns & Quality
    {
      label: 'Returns & Quality',
      path: '/admin/quality',
      children: [
        { label: 'Overview', path: '/admin/quality' },
        { label: 'Return Vouchers (MRV)', path: '/admin/quality?tab=mrv' },
        { label: 'Inspections (RFIM)', path: '/admin/quality?tab=rfim' },
        { label: 'OSD Reports', path: '/admin/quality?tab=osd' },
      ],
    },

    // 6. Logistics & Jobs
    {
      label: 'Logistics & Jobs',
      path: '/admin/logistics',
      children: [
        { label: 'Overview', path: '/admin/logistics' },
        { label: 'Job Orders Board', path: '/admin/logistics?tab=kanban' },
        { label: 'All Job Orders', path: '/admin/logistics?tab=all-jobs' },
        { label: '---', type: 'divider' },
        { label: 'Fleet Management', path: '/admin/logistics?tab=fleet' },
        { label: 'SLA Dashboard', path: '/admin/logistics?tab=sla' },
        { label: 'Payments', path: '/admin/logistics?tab=payments' },
        { label: 'Live Map', path: '/admin/logistics?tab=map' },
      ],
    },

    // 7. Master Data
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
        { label: 'Equipment', path: '/admin/master?tab=equipment' },
      ],
    },

    // 8. Admin & Settings
    {
      label: 'Admin & Settings',
      path: '/admin/system',
      children: [
        { label: 'Roles & Permissions', path: '/admin/system?tab=roles' },
        { label: 'Audit Log', path: '/admin/system?tab=audit' },
        { label: 'Settings', path: '/admin/system?tab=settings' },
        { label: 'Reports', path: '/admin/system?tab=reports' },
        { label: '---', type: 'divider' },
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
    { label: 'Receive (MRRV)', path: '/warehouse/receive' },
    { label: 'Issue (MIRV)', path: '/warehouse/issue' },
    { label: 'Inventory', path: '/warehouse/inventory' },
    { label: 'Return', path: '/warehouse/return' },
  ],
  [UserRole.WAREHOUSE_STAFF]: [
    { label: 'Dashboard', path: '/warehouse' },
    { label: 'Receive (MRRV)', path: '/warehouse/receive' },
    { label: 'Issue (MIRV)', path: '/warehouse/issue' },
    { label: 'Inventory', path: '/warehouse/inventory' },
    { label: 'Return', path: '/warehouse/return' },
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
    { label: 'Inspections', path: '/qc/inspections' },
    { label: 'OSD Reports', path: '/qc/osd' },
    { label: 'Incoming', path: '/qc/incoming' },
    { label: 'Tasks', path: '/qc/tasks' },
  ],
  [UserRole.LOGISTICS_COORDINATOR]: [
    { label: 'Dashboard', path: '/logistics' },
    { label: 'Job Orders', path: '/logistics/jobs' },
    { label: 'Shipments', path: '/logistics/shipments' },
    { label: 'Gate Passes', path: '/logistics/gate-passes' },
    { label: 'Receiving', path: '/logistics/receiving' },
    { label: 'Tasks', path: '/logistics/tasks' },
  ],
  [UserRole.SITE_ENGINEER]: [
    { label: 'Dashboard', path: '/site-engineer' },
    { label: 'New Request', path: '/site-engineer/new' },
    { label: 'My Requests', path: '/site-engineer/my-requests' },
    { label: 'My Project', path: '/site-engineer/project' },
    { label: 'Site Inventory', path: '/site-engineer/inventory' },
    { label: 'Tasks', path: '/site-engineer/tasks' },
  ],
};
