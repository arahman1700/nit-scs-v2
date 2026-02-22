import type { NavItem } from '@nit-scs-v2/shared/types';
import { UserRole } from '@nit-scs-v2/shared/types';

export const NAVIGATION_LINKS: Record<string, NavItem[]> = {
  [UserRole.ADMIN]: [
    // ── 1. Dashboard ──
    { label: 'Dashboard', path: '/admin' },

    // ── 2. Warehouses & Stores ──
    {
      label: 'Warehouses & Stores',
      path: '/admin/warehouses',
      children: [
        { label: 'Overview', path: '/admin/warehouses' },
        { label: '---', type: 'divider' },
        { label: 'GRN - Goods Receipt', path: '/admin/warehouses?tab=grn' },
        { label: 'MI - Material Issuance', path: '/admin/warehouses?tab=mi' },
        { label: 'MRN - Material Return', path: '/admin/warehouses?tab=mrn' },
        { label: 'MR - Material Request', path: '/admin/warehouses?tab=mr' },
        { label: '---', type: 'divider' },
        { label: 'QCI - Quality Inspection', path: '/admin/warehouses?tab=qci' },
        { label: 'DR - Discrepancy Report', path: '/admin/warehouses?tab=dr' },
        { label: '---', type: 'divider' },
        { label: 'Inventory', path: '/admin/warehouses?tab=inventory' },
        { label: 'Bin Cards', path: '/admin/warehouses?tab=bin-cards' },
        { label: 'Non-Moving Materials', path: '/admin/warehouses?tab=non-moving' },
        { label: '---', type: 'divider' },
        { label: 'IMSF - Material Shifting', path: '/admin/warehouses?tab=imsf' },
        { label: 'WT - Warehouse Transfer', path: '/admin/warehouses?tab=wt' },
        { label: '---', type: 'divider' },
        { label: 'Packing Station', path: '/admin/warehouse/packing' },
        { label: 'Staging Areas', path: '/admin/warehouse/staging' },
        { label: 'Yard Management', path: '/admin/warehouse/yard' },
      ],
    },

    // ── 3. Equipment & Transport ──
    {
      label: 'Equipment & Transport',
      path: '/admin/equipment',
      children: [
        { label: 'Overview', path: '/admin/equipment' },
        { label: '---', type: 'divider' },
        { label: 'Job Orders Board', path: '/admin/equipment?tab=kanban' },
        { label: 'All Job Orders', path: '/admin/equipment?tab=all-jobs' },
        { label: '---', type: 'divider' },
        { label: 'Gate Passes', path: '/admin/equipment?tab=gate-passes' },
        { label: '---', type: 'divider' },
        { label: 'Fleet Management', path: '/admin/equipment?tab=fleet' },
        { label: 'Rental Contracts', path: '/admin/equipment?tab=rental-contracts' },
        { label: '---', type: 'divider' },
        { label: 'Generators', path: '/admin/equipment?tab=generators' },
        { label: 'Generator Fuel', path: '/admin/equipment?tab=generator-fuel' },
        { label: 'Generator Maintenance', path: '/admin/equipment?tab=generator-maintenance' },
        { label: '---', type: 'divider' },
        { label: 'Tools Management', path: '/admin/equipment?tab=tools' },
        { label: 'Tool Issues', path: '/admin/equipment?tab=tool-issues' },
      ],
    },

    // ── 4. Scrap & Surplus ──
    {
      label: 'Scrap & Surplus',
      path: '/admin/scrap',
      children: [
        { label: 'Overview', path: '/admin/scrap' },
        { label: 'Scrap Management', path: '/admin/scrap?tab=scrap' },
        { label: 'SSC Dashboard', path: '/admin/scrap?tab=ssc' },
        { label: 'Surplus Items', path: '/admin/scrap?tab=surplus' },
      ],
    },

    // ── 5. Shipping & Customs ──
    {
      label: 'Shipping & Customs',
      path: '/admin/shipping',
      children: [
        { label: 'Overview', path: '/admin/shipping' },
        { label: 'Shipments', path: '/admin/shipping?tab=shipments' },
        { label: 'Customs Clearance', path: '/admin/shipping?tab=customs' },
        { label: 'SLA Performance', path: '/admin/shipping?tab=sla' },
      ],
    },

    // ── 6. Intelligence ──
    { label: 'Intelligence', path: '/admin/intelligence' },

    // ── 7. Interactive Map ──
    { label: 'Interactive Map', path: '/admin/map' },

    // ── 7. Documents ──
    { label: 'Documents', path: '/admin/documents' },

    // ── 8. Master Data ──
    {
      label: 'Master Data',
      path: '/admin/master',
      children: [
        { label: 'Overview', path: '/admin/master' },
        { label: 'Items', path: '/admin/master?tab=items' },
        { label: 'Suppliers', path: '/admin/master?tab=suppliers' },
        { label: 'Projects', path: '/admin/master?tab=projects' },
        { label: 'Warehouses', path: '/admin/master?tab=warehouses' },
        { label: 'Equipment', path: '/admin/master?tab=equipment' },
      ],
    },

    // ── 9. Employees & Org ──
    {
      label: 'Employees & Org',
      path: '/admin/employees',
      children: [
        { label: 'Employees', path: '/admin/employees?tab=employees' },
        { label: 'Departments', path: '/admin/employees?tab=departments' },
        { label: 'Org Chart', path: '/admin/employees?tab=org-chart' },
        { label: 'Delegations', path: '/admin/employees?tab=delegations' },
      ],
    },

    // ── 10. Settings ──
    {
      label: 'Settings',
      path: '/admin/settings',
      children: [
        { label: 'Roles & Permissions', path: '/admin/settings?tab=roles' },
        { label: 'Audit Log', path: '/admin/settings?tab=audit' },
        { label: 'System Settings', path: '/admin/settings?tab=settings' },
        { label: 'Reports', path: '/admin/settings?tab=reports' },
        { label: '---', type: 'divider' },
        { label: 'Approval Levels', path: '/admin/settings?tab=approval-levels' },
        { label: 'Workflows', path: '/admin/settings?tab=workflows' },
        { label: '---', type: 'divider' },
        { label: 'Email Templates', path: '/admin/settings?tab=email-templates' },
        { label: 'Email Logs', path: '/admin/settings?tab=email-logs' },
        { label: '---', type: 'divider' },
        { label: 'Dashboard Builder', path: '/admin/settings/dashboards' },
        { label: 'Report Builder', path: '/admin/settings/reports' },
        { label: 'Document Type Builder', path: '/admin/dynamic-types' },
        { label: 'Custom Data Sources', path: '/admin/custom-data-sources' },
        { label: 'Custom Fields', path: '/admin/custom-fields' },
        { label: 'Workflow Templates', path: '/admin/workflow-templates' },
        { label: 'AI Insights', path: '/admin/ai-insights' },
        { label: '---', type: 'divider' },
        { label: 'Labor Dashboard', path: '/admin/dashboards/labor' },
        { label: 'Exceptions Dashboard', path: '/admin/dashboards/exceptions' },
        { label: '---', type: 'divider' },
        { label: 'Features Catalog', path: '/admin/features' },
        { label: 'ROI Calculator', path: '/admin/roi-calculator' },
      ],
    },
  ],
  [UserRole.WAREHOUSE_SUPERVISOR]: [
    { label: 'Dashboard', path: '/warehouse' },
    {
      label: 'Operations',
      path: '/warehouse/receive',
      children: [
        { label: 'Receive (GRN)', path: '/warehouse/receive' },
        { label: 'Issue (MI)', path: '/warehouse/issue' },
        { label: 'Returns (MRN)', path: '/warehouse/return' },
        { label: 'Packing Station', path: '/warehouse/packing' },
        { label: 'Staging Areas', path: '/warehouse/staging' },
        { label: 'Mobile Dashboard', path: '/warehouse/mobile' },
        { label: 'Yard Management', path: '/warehouse/yard' },
      ],
    },
    { label: 'Inventory', path: '/warehouse/inventory' },
    { label: 'Intelligence', path: '/warehouse/intelligence' },
    { label: 'Labor Dashboard', path: '/warehouse/labor' },
  ],
  [UserRole.WAREHOUSE_STAFF]: [
    { label: 'Dashboard', path: '/warehouse' },
    {
      label: 'Operations',
      path: '/warehouse/receive',
      children: [
        { label: 'Receive (GRN)', path: '/warehouse/receive' },
        { label: 'Issue (MI)', path: '/warehouse/issue' },
        { label: 'Returns (MRN)', path: '/warehouse/return' },
        { label: 'Packing Station', path: '/warehouse/packing' },
        { label: 'Staging Areas', path: '/warehouse/staging' },
        { label: 'Mobile Dashboard', path: '/warehouse/mobile' },
        { label: 'Yard Management', path: '/warehouse/yard' },
      ],
    },
    { label: 'Inventory', path: '/warehouse/inventory' },
    { label: 'Intelligence', path: '/warehouse/intelligence' },
  ],
  [UserRole.FREIGHT_FORWARDER]: [
    { label: 'Dashboard', path: '/transport' },
    {
      label: 'Logistics',
      path: '/transport/shipments',
      children: [
        { label: 'Shipments', path: '/transport/shipments' },
        { label: 'Gate Passes', path: '/transport/gate-passes' },
      ],
    },
  ],
  [UserRole.MANAGER]: [
    { label: 'Dashboard', path: '/manager' },
    {
      label: 'Workflow',
      path: '/manager/approvals',
      children: [
        { label: 'Approval Queue', path: '/manager/approvals' },
        { label: 'Documents', path: '/manager/documents' },
      ],
    },
    {
      label: 'Oversight',
      path: '/manager/projects',
      children: [
        { label: 'Projects', path: '/manager/projects' },
        { label: 'Tasks', path: '/manager/tasks' },
      ],
    },
  ],
  [UserRole.QC_OFFICER]: [
    { label: 'Dashboard', path: '/qc' },
    {
      label: 'Inspections',
      path: '/qc/inspections',
      children: [
        { label: 'Inspections (QCI)', path: '/qc/inspections' },
        { label: 'Discrepancy Reports (DR)', path: '/qc/dr' },
        { label: 'Incoming', path: '/qc/incoming' },
      ],
    },
    { label: 'Tasks', path: '/qc/tasks' },
  ],
  [UserRole.LOGISTICS_COORDINATOR]: [
    { label: 'Dashboard', path: '/logistics' },
    {
      label: 'Operations',
      path: '/logistics/jobs',
      children: [
        { label: 'Job Orders', path: '/logistics/jobs' },
        { label: 'IMSF', path: '/logistics/imsf' },
        { label: 'Warehouse Transfers', path: '/logistics/wt' },
      ],
    },
    {
      label: 'Shipping',
      path: '/logistics/shipments',
      children: [
        { label: 'Shipments', path: '/logistics/shipments' },
        { label: 'Gate Passes', path: '/logistics/gate-passes' },
      ],
    },
    { label: 'Tasks', path: '/logistics/tasks' },
  ],
  [UserRole.SITE_ENGINEER]: [
    { label: 'Dashboard', path: '/site-engineer' },
    {
      label: 'Requests',
      path: '/site-engineer/new',
      children: [
        { label: 'New Request (MR)', path: '/site-engineer/new' },
        { label: 'My Requests', path: '/site-engineer/my-requests' },
      ],
    },
    {
      label: 'Project',
      path: '/site-engineer/project',
      children: [
        { label: 'My Project', path: '/site-engineer/project' },
        { label: 'Site Inventory', path: '/site-engineer/inventory' },
      ],
    },
    { label: 'Tasks', path: '/site-engineer/tasks' },
  ],
  [UserRole.TRANSPORT_SUPERVISOR]: [
    { label: 'Dashboard', path: '/logistics/transport' },
    {
      label: 'Operations',
      path: '/logistics?tab=all-jobs',
      children: [
        { label: 'Job Orders', path: '/logistics?tab=all-jobs' },
        { label: 'Fleet', path: '/logistics?tab=fleet' },
        { label: 'Rental Contracts', path: '/logistics?tab=rental-contracts' },
      ],
    },
    { label: 'Tasks', path: '/logistics/tasks' },
  ],
  [UserRole.SCRAP_COMMITTEE_MEMBER]: [
    { label: 'Dashboard', path: '/admin/scrap' },
    {
      label: 'Scrap & Surplus',
      path: '/admin/scrap?tab=ssc',
      children: [
        { label: 'SSC Dashboard', path: '/admin/scrap?tab=ssc' },
        { label: 'Scrap Items', path: '/admin/scrap?tab=scrap' },
        { label: 'Surplus', path: '/admin/scrap?tab=surplus' },
      ],
    },
  ],
};

export const STATIC_NAVIGATION = NAVIGATION_LINKS;
