import type { NavSection } from '@nit-scs-v2/shared/types';
import { UserRole } from '@nit-scs-v2/shared/types';

// ── Section-based navigation config ─────────────────────────────────────
// Each role gets an array of NavSections. Sections support:
// - `alwaysExpanded: true` for sections that cannot be collapsed (e.g. OVERVIEW)
// - `children` for sub-groups (e.g. Inbound/Outbound under OPERATIONS)
// - `items` for flat item lists within a section

export const SECTION_NAVIGATION: Record<string, NavSection[]> = {
  [UserRole.ADMIN]: [
    {
      section: 'OVERVIEW',
      alwaysExpanded: true,
      items: [
        { label: 'Dashboard', path: '/admin', icon: 'LayoutDashboard' },
        { label: 'Pending Approvals', path: '/admin/settings?tab=approval-levels', icon: 'Clock', badge: 0 },
        { label: 'Documents', path: '/admin/documents', icon: 'FileText' },
      ],
    },
    {
      section: 'OPERATIONS',
      items: [],
      children: [
        {
          label: 'Inbound',
          items: [
            { label: 'GRN - Receiving', path: '/admin/warehouses?tab=grn', icon: 'PackageCheck' },
            { label: 'QCI - Inspections', path: '/admin/warehouses?tab=qci', icon: 'CheckCircle' },
            { label: 'DR - Discrepancy', path: '/admin/warehouses?tab=dr', icon: 'AlertTriangle' },
          ],
        },
        {
          label: 'Outbound',
          items: [
            { label: 'MI - Issuing', path: '/admin/warehouses?tab=mi', icon: 'Send' },
            { label: 'MRN - Returns', path: '/admin/warehouses?tab=mrn', icon: 'CornerDownLeft' },
            { label: 'MR - Requests', path: '/admin/warehouses?tab=mr', icon: 'ClipboardList' },
          ],
        },
        {
          label: 'Transfers',
          items: [
            { label: 'WT - Transfers', path: '/admin/warehouses?tab=wt', icon: 'Repeat' },
            { label: 'IMSF - Inter-Store', path: '/admin/warehouses?tab=imsf', icon: 'GitBranch' },
          ],
        },
      ],
    },
    {
      section: 'INVENTORY',
      items: [
        { label: 'Stock Overview', path: '/admin/warehouses?tab=inventory', icon: 'Layers' },
        { label: 'Bin Cards', path: '/admin/warehouses?tab=bin-cards', icon: 'Database' },
        { label: 'Expiry Alerts', path: '/warehouse/expiry-alerts', icon: 'AlertCircle', badge: 0 },
        { label: 'Scrap & Surplus', path: '/admin/scrap', icon: 'Recycle' },
      ],
    },
    {
      section: 'EQUIPMENT & FLEET',
      items: [
        { label: 'Job Orders', path: '/admin/equipment?tab=all-jobs', icon: 'Wrench', badge: 0 },
        { label: 'Gate Passes', path: '/admin/equipment?tab=gate-passes', icon: 'DoorOpen' },
        { label: 'Fleet & Rentals', path: '/admin/equipment?tab=fleet', icon: 'Truck' },
        { label: 'Tools & Issues', path: '/admin/equipment?tab=tools', icon: 'Hammer' },
        { label: 'Generators', path: '/admin/equipment?tab=generators', icon: 'Zap' },
        { label: 'Assets & AMC', path: '/admin/amc', icon: 'Box' },
      ],
    },
    {
      section: 'LOGISTICS',
      items: [
        { label: 'Shipments', path: '/admin/shipping?tab=shipments', icon: 'Ship' },
        { label: 'Customs & Tariffs', path: '/admin/customs-documents', icon: 'Globe' },
        { label: 'Route Optimizer', path: '/admin/map', icon: 'Map' },
      ],
    },
    {
      section: 'ANALYTICS & REPORTS',
      items: [
        { label: 'KPI Dashboard', path: '/admin/dashboards/kpis', icon: 'BarChart2' },
        { label: 'Cost Allocation', path: '/admin/dashboards/cost-allocation', icon: 'DollarSign' },
        { label: 'Security Monitor', path: '/admin/dashboards/security', icon: 'Shield' },
        { label: 'Compliance', path: '/admin/compliance', icon: 'ClipboardCheck' },
      ],
    },
    {
      section: 'ADMIN & SETTINGS',
      items: [
        { label: 'Master Data', path: '/admin/master', icon: 'Database' },
        { label: 'Employees & Org', path: '/admin/employees', icon: 'Users' },
        { label: 'Workflows', path: '/admin/settings?tab=workflows', icon: 'GitMerge' },
        { label: 'System Settings', path: '/admin/settings', icon: 'Settings' },
      ],
    },
  ],

  [UserRole.WAREHOUSE_SUPERVISOR]: [
    {
      section: 'OVERVIEW',
      alwaysExpanded: true,
      items: [
        { label: 'Dashboard', path: '/warehouse', icon: 'LayoutDashboard' },
        { label: 'Mobile Dashboard', path: '/warehouse/mobile', icon: 'Smartphone' },
      ],
    },
    {
      section: 'OPERATIONS',
      items: [],
      children: [
        {
          label: 'Receiving',
          items: [
            { label: 'GRN - Receiving', path: '/warehouse/receive', icon: 'PackageCheck' },
            { label: 'QCI - Inspections', path: '/qc/inspections', icon: 'CheckCircle' },
            { label: 'DR - Discrepancy', path: '/qc/dr', icon: 'AlertTriangle' },
          ],
        },
        {
          label: 'Issuing',
          items: [
            { label: 'MI - Issuing', path: '/warehouse/issue', icon: 'Send' },
            { label: 'MRN - Returns', path: '/warehouse/return', icon: 'CornerDownLeft' },
          ],
        },
      ],
    },
    {
      section: 'INVENTORY',
      items: [
        { label: 'Stock Levels', path: '/warehouse/inventory', icon: 'Layers' },
        { label: 'Expiry Alerts', path: '/warehouse/expiry-alerts', icon: 'AlertCircle', badge: 0 },
        { label: 'Demand Analytics', path: '/warehouse/demand-analytics', icon: 'TrendingUp' },
      ],
    },
    {
      section: 'TRANSFERS',
      items: [
        { label: 'WT - Transfers', path: '/logistics/wt', icon: 'Repeat' },
        { label: 'IMSF - Inter-Store', path: '/logistics/imsf', icon: 'GitBranch' },
      ],
    },
    {
      section: 'PEOPLE',
      items: [{ label: 'Labor Dashboard', path: '/warehouse/labor', icon: 'Users' }],
    },
  ],

  [UserRole.WAREHOUSE_STAFF]: [
    {
      section: 'OVERVIEW',
      alwaysExpanded: true,
      items: [
        { label: 'Dashboard', path: '/warehouse', icon: 'LayoutDashboard' },
        { label: 'Mobile Dashboard', path: '/warehouse/mobile', icon: 'Smartphone' },
      ],
    },
    {
      section: 'OPERATIONS',
      items: [],
      children: [
        {
          label: 'Receiving',
          items: [{ label: 'GRN - Receiving', path: '/warehouse/receive', icon: 'PackageCheck' }],
        },
        {
          label: 'Issuing',
          items: [
            { label: 'MI - Issuing', path: '/warehouse/issue', icon: 'Send' },
            { label: 'MRN - Returns', path: '/warehouse/return', icon: 'CornerDownLeft' },
          ],
        },
      ],
    },
    {
      section: 'INVENTORY',
      items: [
        { label: 'Stock Levels', path: '/warehouse/inventory', icon: 'Layers' },
        { label: 'Expiry Alerts', path: '/warehouse/expiry-alerts', icon: 'AlertCircle', badge: 0 },
        { label: 'Demand Analytics', path: '/warehouse/demand-analytics', icon: 'TrendingUp' },
      ],
    },
  ],

  [UserRole.FREIGHT_FORWARDER]: [
    {
      section: 'OVERVIEW',
      alwaysExpanded: true,
      items: [{ label: 'Dashboard', path: '/transport', icon: 'LayoutDashboard' }],
    },
    {
      section: 'SHIPPING',
      items: [
        { label: 'Shipments', path: '/transport/shipments', icon: 'Ship' },
        { label: 'Gate Passes', path: '/transport/gate-passes', icon: 'DoorOpen' },
      ],
    },
  ],

  [UserRole.MANAGER]: [
    {
      section: 'OVERVIEW',
      alwaysExpanded: true,
      items: [
        { label: 'Dashboard', path: '/manager', icon: 'LayoutDashboard' },
        { label: 'Pending Approvals', path: '/manager/approvals', icon: 'Clock', badge: 0 },
      ],
    },
    {
      section: 'OPERATIONS',
      items: [
        { label: 'GRN - Receiving', path: '/manager/documents', icon: 'PackageCheck' },
        { label: 'Job Orders', path: '/manager/tasks', icon: 'Wrench' },
        { label: 'Projects', path: '/manager/projects', icon: 'Briefcase' },
      ],
    },
    {
      section: 'ANALYTICS',
      items: [
        { label: 'KPI Dashboard', path: '/manager/kpis', icon: 'BarChart2' },
        { label: 'Reports', path: '/manager/reports', icon: 'FileText' },
      ],
    },
  ],

  [UserRole.QC_OFFICER]: [
    {
      section: 'OVERVIEW',
      alwaysExpanded: true,
      items: [
        { label: 'Dashboard', path: '/qc', icon: 'LayoutDashboard' },
        { label: 'Tasks', path: '/qc/tasks', icon: 'ListTodo' },
      ],
    },
    {
      section: 'INSPECTIONS',
      items: [
        { label: 'QCI - Inspections', path: '/qc/inspections', icon: 'CheckCircle' },
        { label: 'DR - Discrepancy', path: '/qc/dr', icon: 'AlertTriangle' },
        { label: 'Incoming', path: '/qc/incoming', icon: 'PackageCheck' },
      ],
    },
  ],

  [UserRole.LOGISTICS_COORDINATOR]: [
    {
      section: 'OVERVIEW',
      alwaysExpanded: true,
      items: [
        { label: 'Dashboard', path: '/logistics', icon: 'LayoutDashboard' },
        { label: 'Tasks', path: '/logistics/tasks', icon: 'ListTodo' },
      ],
    },
    {
      section: 'OPERATIONS',
      items: [
        { label: 'Job Orders', path: '/logistics/jobs', icon: 'Wrench' },
        { label: 'IMSF - Inter-Store', path: '/logistics/imsf', icon: 'GitBranch' },
        { label: 'WT - Transfers', path: '/logistics/wt', icon: 'Repeat' },
      ],
    },
    {
      section: 'SHIPPING',
      items: [
        { label: 'Shipments', path: '/logistics/shipments', icon: 'Ship' },
        { label: 'Gate Passes', path: '/logistics/gate-passes', icon: 'DoorOpen' },
      ],
    },
  ],

  [UserRole.SITE_ENGINEER]: [
    {
      section: 'OVERVIEW',
      alwaysExpanded: true,
      items: [
        { label: 'Dashboard', path: '/site-engineer', icon: 'LayoutDashboard' },
        { label: 'Tasks', path: '/site-engineer/tasks', icon: 'ListTodo' },
      ],
    },
    {
      section: 'REQUESTS',
      items: [
        { label: 'New Request (MR)', path: '/site-engineer/new', icon: 'PlusCircle' },
        { label: 'My Requests', path: '/site-engineer/my-requests', icon: 'FileText' },
      ],
    },
    {
      section: 'PROJECT',
      items: [
        { label: 'My Project', path: '/site-engineer/project', icon: 'Briefcase' },
        { label: 'Site Inventory', path: '/site-engineer/inventory', icon: 'Package' },
      ],
    },
  ],

  [UserRole.TRANSPORT_SUPERVISOR]: [
    {
      section: 'OVERVIEW',
      alwaysExpanded: true,
      items: [
        { label: 'Dashboard', path: '/logistics/transport', icon: 'LayoutDashboard' },
        { label: 'Tasks', path: '/logistics/tasks', icon: 'ListTodo' },
      ],
    },
    {
      section: 'OPERATIONS',
      items: [
        { label: 'Job Orders', path: '/logistics?tab=all-jobs', icon: 'Wrench' },
        { label: 'Fleet', path: '/logistics?tab=fleet', icon: 'Truck' },
        { label: 'Rental Contracts', path: '/logistics?tab=rental-contracts', icon: 'FileText' },
      ],
    },
  ],

  [UserRole.SCRAP_COMMITTEE_MEMBER]: [
    {
      section: 'OVERVIEW',
      alwaysExpanded: true,
      items: [{ label: 'SSC Dashboard', path: '/admin/scrap?tab=ssc', icon: 'LayoutDashboard' }],
    },
    {
      section: 'SCRAP & SURPLUS',
      items: [
        { label: 'Scrap Items', path: '/admin/scrap?tab=scrap', icon: 'Recycle' },
        { label: 'Surplus', path: '/admin/scrap?tab=surplus', icon: 'Package' },
      ],
    },
  ],

  [UserRole.TECHNICAL_MANAGER]: [
    {
      section: 'OVERVIEW',
      alwaysExpanded: true,
      items: [
        { label: 'Dashboard', path: '/manager', icon: 'LayoutDashboard' },
        { label: 'Pending Approvals', path: '/manager/approvals', icon: 'Clock', badge: 0 },
      ],
    },
    {
      section: 'OVERSIGHT',
      items: [
        { label: 'Documents', path: '/manager/documents', icon: 'FileText' },
        { label: 'Projects', path: '/manager/projects', icon: 'Briefcase' },
        { label: 'Inventory', path: '/manager/inventory', icon: 'Layers' },
      ],
    },
  ],

  [UserRole.GATE_OFFICER]: [
    {
      section: 'OVERVIEW',
      alwaysExpanded: true,
      items: [{ label: 'Dashboard', path: '/warehouse', icon: 'LayoutDashboard' }],
    },
    {
      section: 'GATE OPERATIONS',
      items: [
        { label: 'Gate Passes', path: '/warehouse/gate-passes', icon: 'DoorOpen' },
        { label: 'Inbound Verification', path: '/warehouse/gate-inbound', icon: 'PackageCheck' },
        { label: 'Outbound Verification', path: '/warehouse/gate-outbound', icon: 'Send' },
      ],
    },
  ],

  [UserRole.INVENTORY_SPECIALIST]: [
    {
      section: 'OVERVIEW',
      alwaysExpanded: true,
      items: [{ label: 'Dashboard', path: '/warehouse', icon: 'LayoutDashboard' }],
    },
    {
      section: 'INVENTORY',
      items: [
        { label: 'Stock Levels', path: '/warehouse/inventory', icon: 'Layers' },
        { label: 'Bin Cards', path: '/warehouse/bin-cards', icon: 'Database' },
        { label: 'Cycle Counts', path: '/warehouse/cycle-counts', icon: 'RefreshCw' },
      ],
    },
    {
      section: 'OPERATIONS',
      items: [
        { label: 'GRN - Receiving', path: '/warehouse/receive', icon: 'PackageCheck' },
        { label: 'MI - Issuing', path: '/warehouse/issue', icon: 'Send' },
        { label: 'MRN - Returns', path: '/warehouse/return', icon: 'CornerDownLeft' },
      ],
    },
  ],

  [UserRole.SHIPPING_OFFICER]: [
    {
      section: 'OVERVIEW',
      alwaysExpanded: true,
      items: [{ label: 'Dashboard', path: '/logistics', icon: 'LayoutDashboard' }],
    },
    {
      section: 'SHIPMENTS',
      items: [
        { label: 'All Shipments', path: '/logistics/shipments', icon: 'Ship' },
        { label: 'Customs Clearance', path: '/logistics/customs', icon: 'Globe' },
        { label: 'Gate Passes', path: '/logistics/gate-passes', icon: 'DoorOpen' },
      ],
    },
  ],

  [UserRole.FINANCE_USER]: [
    {
      section: 'OVERVIEW',
      alwaysExpanded: true,
      items: [{ label: 'Dashboard', path: '/admin', icon: 'LayoutDashboard' }],
    },
    {
      section: 'REPORTS',
      items: [
        { label: 'Financial Reports', path: '/admin/settings?tab=reports', icon: 'BarChart2' },
        { label: 'Inventory Valuation', path: '/admin/warehouses?tab=inventory', icon: 'DollarSign' },
      ],
    },
    {
      section: 'DOCUMENTS',
      items: [
        { label: 'All Documents', path: '/admin/documents', icon: 'FileText' },
        { label: 'Job Orders', path: '/admin/equipment?tab=all-jobs', icon: 'Wrench' },
      ],
    },
  ],

  [UserRole.CUSTOMS_SPECIALIST]: [
    {
      section: 'OVERVIEW',
      alwaysExpanded: true,
      items: [{ label: 'Dashboard', path: '/logistics', icon: 'LayoutDashboard' }],
    },
    {
      section: 'CUSTOMS',
      items: [
        { label: 'Customs Clearance', path: '/logistics/customs', icon: 'Globe' },
        { label: 'Shipments', path: '/logistics/shipments', icon: 'Ship' },
        { label: 'Gate Passes', path: '/logistics/gate-passes', icon: 'DoorOpen' },
      ],
    },
  ],

  [UserRole.COMPLIANCE_OFFICER]: [
    {
      section: 'OVERVIEW',
      alwaysExpanded: true,
      items: [{ label: 'Dashboard', path: '/admin', icon: 'LayoutDashboard' }],
    },
    {
      section: 'COMPLIANCE',
      items: [
        { label: 'Audit Log', path: '/admin/settings?tab=audit', icon: 'Shield' },
        { label: 'Reports', path: '/admin/settings?tab=reports', icon: 'FileText' },
        { label: 'Quality (QCI)', path: '/admin/warehouses?tab=qci', icon: 'CheckCircle' },
      ],
    },
    {
      section: 'DOCUMENTS',
      items: [{ label: 'All Documents', path: '/admin/documents', icon: 'FileText' }],
    },
  ],
};

// ── Backward compatibility ──────────────────────────────────────────────
// Legacy flat NavItem[] format used by MobileTabBar and useNavigation hook.
// Converts section-based config to flat list with section as parent group.
import type { NavItem } from '@nit-scs-v2/shared/types';

function sectionsToFlatNav(sections: NavSection[]): NavItem[] {
  const result: NavItem[] = [];
  for (const sec of sections) {
    if (sec.items.length <= 2 && sec.section === 'OVERVIEW' && !sec.children?.length) {
      // Short overview sections stay flat
      for (const item of sec.items) result.push(item);
    } else {
      // Collect all items including children sub-groups
      const allItems: NavItem[] = [...sec.items];
      if (sec.children) {
        for (const child of sec.children) {
          allItems.push(...child.items);
        }
      }
      // Create a group parent with children
      result.push({
        label: sec.section.charAt(0) + sec.section.slice(1).toLowerCase(),
        path: allItems[0]?.path,
        children: allItems,
      });
    }
  }
  return result;
}

export const NAVIGATION_LINKS: Record<string, NavItem[]> = Object.fromEntries(
  Object.entries(SECTION_NAVIGATION).map(([role, sections]) => [role, sectionsToFlatNav(sections)]),
);

export const STATIC_NAVIGATION = NAVIGATION_LINKS;
