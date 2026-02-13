// ============================================================================
// Navigation Service — merges static nav, dynamic doc types, and overrides
// ============================================================================

import { prisma } from '../utils/prisma.js';
import { UserRole } from '@nit-scs-v2/shared';
import type { NavItem } from '@nit-scs-v2/shared/types';

// ── In-memory cache with TTL ────────────────────────────────────────────────
const NAV_CACHE = new Map<string, { data: NavItem[]; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCached(role: string): NavItem[] | null {
  const entry = NAV_CACHE.get(role);
  if (entry && entry.expiresAt > Date.now()) return entry.data;
  if (entry) NAV_CACHE.delete(role);
  return null;
}

function setCache(role: string, data: NavItem[]): void {
  NAV_CACHE.set(role, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function invalidateNavCache(role?: string): void {
  if (role) {
    NAV_CACHE.delete(role);
  } else {
    NAV_CACHE.clear();
  }
}

// ── Static navigation config (mirrors frontend navigation.ts) ───────────────
const STATIC_NAV: Record<string, NavItem[]> = {
  [UserRole.ADMIN]: [
    { label: 'Dashboard', path: '/admin' },
    { label: 'Exceptions', path: '/admin/dashboards/exceptions' },
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
    { label: 'Interactive Map', path: '/admin/map' },
    { label: 'Documents', path: '/admin/documents' },
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

// ── Dynamic document types → nav items ──────────────────────────────────────
async function getDynamicNavItems(role: string): Promise<NavItem[]> {
  const types = await prisma.dynamicDocumentType.findMany({
    where: { isActive: true },
    select: { code: true, name: true, visibleToRoles: true },
    orderBy: { name: 'asc' },
  });

  const visible = types.filter(t => {
    const roles = t.visibleToRoles as string[];
    return Array.isArray(roles) && (roles.includes(role) || roles.includes('*'));
  });

  if (visible.length === 0) return [];

  return [
    {
      label: 'Custom Documents',
      path: '/admin/dynamic',
      children: visible.map(t => ({
        label: t.name,
        path: `/admin/dynamic/${t.code}`,
      })),
    },
  ];
}

// ── Apply overrides (sort + hide) ───────────────────────────────────────────
async function applyOverrides(role: string, items: NavItem[]): Promise<NavItem[]> {
  const overrides = await prisma.navigationOverride.findMany({
    where: { role },
  });

  if (overrides.length === 0) return items;

  const overrideMap = new Map(overrides.map(o => [o.path, o]));

  // Filter hidden items
  const filtered = items.filter(item => {
    const override = item.path ? overrideMap.get(item.path) : null;
    return !override?.hidden;
  });

  // Apply sort orders
  const sorted = filtered.map(item => {
    const override = item.path ? overrideMap.get(item.path) : null;
    return { item, sortOrder: override?.sortOrder ?? 0 };
  });

  sorted.sort((a, b) => a.sortOrder - b.sortOrder);

  return sorted.map(s => s.item);
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function getNavigationForRole(role: string): Promise<NavItem[]> {
  const cached = getCached(role);
  if (cached) return cached;

  // 1. Static nav items for this role
  const staticItems = structuredClone(STATIC_NAV[role] ?? []);

  // 2. Dynamic document types visible to this role
  const dynamicItems = await getDynamicNavItems(role);

  // 3. Merge
  const merged = [...staticItems, ...dynamicItems];

  // 4. Apply overrides (reorder, hide)
  const result = await applyOverrides(role, merged);

  setCache(role, result);
  return result;
}

export async function updateNavigationOrder(
  role: string,
  overrides: Array<{ path: string; sortOrder: number; parentPath?: string }>,
): Promise<void> {
  await prisma.$transaction(
    overrides.map(o =>
      prisma.navigationOverride.upsert({
        where: { role_path: { role, path: o.path } },
        create: {
          role,
          path: o.path,
          sortOrder: o.sortOrder,
          parentPath: o.parentPath ?? null,
        },
        update: {
          sortOrder: o.sortOrder,
          parentPath: o.parentPath ?? null,
        },
      }),
    ),
  );
  invalidateNavCache(role);
}

export async function hideNavigationItem(role: string, path: string): Promise<void> {
  await prisma.navigationOverride.upsert({
    where: { role_path: { role, path } },
    create: { role, path, hidden: true },
    update: { hidden: true },
  });
  invalidateNavCache(role);
}

export async function showNavigationItem(role: string, path: string): Promise<void> {
  // Delete the override entirely if it only existed to hide the item
  const existing = await prisma.navigationOverride.findUnique({
    where: { role_path: { role, path } },
  });

  if (!existing) return;

  if (existing.sortOrder === 0 && !existing.parentPath) {
    // No other overrides — just delete it
    await prisma.navigationOverride.delete({
      where: { role_path: { role, path } },
    });
  } else {
    // Has sort/parent overrides — just toggle hidden off
    await prisma.navigationOverride.update({
      where: { role_path: { role, path } },
      data: { hidden: false },
    });
  }
  invalidateNavCache(role);
}
