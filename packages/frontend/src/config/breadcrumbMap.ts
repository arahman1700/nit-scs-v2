/**
 * Static map of URL path segments to human-readable labels.
 * Used by the Breadcrumbs component to render navigation context.
 * Unknown segments are auto-capitalized with dash-to-space.
 */
export const BREADCRUMB_LABELS: Record<string, string> = {
  // Role roots
  admin: 'Dashboard',
  warehouse: 'Warehouse',
  transport: 'Transport',
  manager: 'Manager',
  qc: 'Quality',
  logistics: 'Logistics',
  'site-engineer': 'Site Engineer',

  // Section pages
  warehouses: 'Warehouses & Stores',
  equipment: 'Equipment & Transport',
  scrap: 'Scrap & Surplus',
  shipping: 'Shipping & Customs',
  master: 'Master Data',
  employees: 'Employees & Org',
  settings: 'Settings',
  inventory: 'Inventory',
  map: 'Interactive Map',
  documents: 'Documents',
  dashboards: 'Dashboards',
  operations: 'Operations',
  exceptions: 'Exceptions',

  // Document form types (V2 display names)
  grn: 'GRN',
  mi: 'MI',
  mrn: 'MRN',
  mr: 'MR',
  qci: 'QCI',
  dr: 'DR',
  jo: 'Job Order',
  imsf: 'IMSF',
  wt: 'Warehouse Transfer',
  'gate-pass': 'Gate Pass',
  shipment: 'Shipment',
  handover: 'Handover',
  'tool-issue': 'Tool Issue',
  'generator-fuel': 'Generator Fuel',
  'generator-maintenance': 'Generator Maintenance',
  'rental-contract': 'Rental Contract',

  // Feature pages
  'dynamic-types': 'Document Type Builder',
  'custom-data-sources': 'Custom Data Sources',
  'custom-fields': 'Custom Fields',
  'workflow-templates': 'Workflow Templates',
  'ai-insights': 'AI Insights',
  features: 'Features Catalog',
  'roi-calculator': 'ROI Calculator',

  // Common actions
  forms: 'Forms',
  new: 'New',
  edit: 'Edit',
  receive: 'Receive (GRN)',
  issue: 'Issue (MI)',
  return: 'Returns (MRN)',
  inspections: 'Inspections',
  incoming: 'Incoming',
  approvals: 'Approvals',
  projects: 'Projects',
  tasks: 'Tasks',
  shipments: 'Shipments',
  'gate-passes': 'Gate Passes',
  jobs: 'Job Orders',
  fleet: 'Fleet',
  'rental-contracts': 'Rental Contracts',
  'my-requests': 'My Requests',
  project: 'My Project',
  'site-inventory': 'Site Inventory',
};
