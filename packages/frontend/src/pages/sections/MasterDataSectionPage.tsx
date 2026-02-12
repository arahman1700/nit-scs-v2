import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Package,
  FolderOpen,
  Warehouse as WarehouseIcon,
  Wrench,
  ArrowRight,
  Zap,
  Truck,
} from 'lucide-react';
import { SectionLandingPage } from '@/components/SectionLandingPage';
import type { KpiCardProps } from '@/components/KpiCard';
import type { TabDef } from '@/components/SectionTabBar';
import { useSuppliers, useItems, useProjects, useEmployees, useWarehouses, useFleet, useGenerators } from '@/api/hooks';

// ── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Active: 'bg-emerald-500/20 text-emerald-400',
    Approved: 'bg-emerald-500/20 text-emerald-400',
    Inactive: 'bg-gray-500/20 text-gray-400',
    Pending: 'bg-amber-500/20 text-amber-400',
    Suspended: 'bg-red-500/20 text-red-400',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-white/10 text-gray-300'}`}>
      {status}
    </span>
  );
}

// ── Resource card for overview ───────────────────────────────────────────────

interface ResourceCardInfo {
  label: string;
  icon: React.ElementType;
  count: number;
  loading: boolean;
  link: string;
  color: string;
}

function ResourceCard({ label, icon: Icon, count, loading, link, color }: ResourceCardInfo) {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigate(link)}
      className="glass-card p-6 rounded-xl cursor-pointer hover:scale-[1.02] transition-all group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-lg ${color} text-white`}>
          <Icon size={22} />
        </div>
        <ArrowRight size={16} className="text-gray-500 group-hover:text-nesma-secondary transition-colors" />
      </div>
      <p className="text-2xl font-bold text-white mb-1">
        {loading ? (
          <span className="inline-block w-10 h-6 bg-white/10 rounded animate-pulse" />
        ) : (
          count.toLocaleString()
        )}
      </p>
      <p className="text-gray-400 text-sm">{label}</p>
      <p className="text-nesma-secondary text-xs mt-2 group-hover:underline">Manage</p>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export const MasterDataSectionPage: React.FC = () => {
  const navigate = useNavigate();

  const suppliersQuery = useSuppliers({ pageSize: 1 });
  const itemsQuery = useItems({ pageSize: 1 });
  const projectsQuery = useProjects({ pageSize: 1 });
  const employeesQuery = useEmployees({ pageSize: 1 });
  const warehousesQuery = useWarehouses({ pageSize: 50 });
  const fleetQuery = useFleet({ pageSize: 50 });
  const generatorsQuery = useGenerators({ pageSize: 50 });

  const suppliersTotal = suppliersQuery.data?.meta?.total ?? 0;
  const itemsTotal = itemsQuery.data?.meta?.total ?? 0;
  const projectsTotal = projectsQuery.data?.meta?.total ?? 0;
  const employeesTotal = employeesQuery.data?.meta?.total ?? 0;
  const warehousesData = warehousesQuery.data?.data ?? [];
  const fleetData = fleetQuery.data?.data ?? [];
  const generatorsData = generatorsQuery.data?.data ?? [];
  const warehousesTotal = warehousesQuery.data?.meta?.total ?? warehousesData.length;

  const loading =
    suppliersQuery.isLoading || itemsQuery.isLoading || projectsQuery.isLoading || employeesQuery.isLoading;

  // For full tables we need more data
  const suppliersFullQuery = useSuppliers({ pageSize: 15 });
  const itemsFullQuery = useItems({ pageSize: 15 });
  const projectsFullQuery = useProjects({ pageSize: 15 });
  const employeesFullQuery = useEmployees({ pageSize: 15 });

  const suppliersData = suppliersFullQuery.data?.data ?? [];
  const itemsData = itemsFullQuery.data?.data ?? [];
  const projectsData = projectsFullQuery.data?.data ?? [];
  const employeesData = employeesFullQuery.data?.data ?? [];

  // ── KPIs ──────────────────────────────────────────────────────────────────

  const kpis: KpiCardProps[] = [
    { title: 'Items', value: itemsTotal, icon: Package, color: 'bg-emerald-500' },
    { title: 'Suppliers', value: suppliersTotal, icon: Building2, color: 'bg-nesma-primary' },
    { title: 'Projects', value: projectsTotal, icon: FolderOpen, color: 'bg-blue-500' },
    { title: 'Warehouses', value: warehousesTotal, icon: WarehouseIcon, color: 'bg-purple-500' },
  ];

  // ── Tab definitions ───────────────────────────────────────────────────────

  const tabs: TabDef[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'items', label: 'Items' },
    { key: 'suppliers', label: 'Suppliers' },
    { key: 'projects', label: 'Projects' },
    { key: 'warehouses', label: 'Warehouses' },
    { key: 'equipment', label: 'Equipment' },
  ];

  // ── Overview resource cards ───────────────────────────────────────────────

  const resourceCards: ResourceCardInfo[] = useMemo(
    () => [
      {
        label: 'Items',
        icon: Package,
        count: itemsTotal,
        loading: itemsQuery.isLoading,
        link: '/admin/master?tab=items',
        color: 'bg-emerald-500',
      },
      {
        label: 'Suppliers',
        icon: Building2,
        count: suppliersTotal,
        loading: suppliersQuery.isLoading,
        link: '/admin/master?tab=suppliers',
        color: 'bg-nesma-primary',
      },
      {
        label: 'Projects',
        icon: FolderOpen,
        count: projectsTotal,
        loading: projectsQuery.isLoading,
        link: '/admin/master?tab=projects',
        color: 'bg-blue-500',
      },
      {
        label: 'Warehouses',
        icon: WarehouseIcon,
        count: warehousesTotal,
        loading: warehousesQuery.isLoading,
        link: '/admin/master?tab=warehouses',
        color: 'bg-purple-500',
      },
      {
        label: 'Equipment',
        icon: Wrench,
        count: fleetData.length + generatorsData.length,
        loading: fleetQuery.isLoading,
        link: '/admin/master?tab=equipment',
        color: 'bg-orange-500',
      },
    ],
    [
      suppliersTotal,
      itemsTotal,
      projectsTotal,
      warehousesTotal,
      fleetData.length,
      generatorsData.length,
      suppliersQuery.isLoading,
      itemsQuery.isLoading,
      projectsQuery.isLoading,
      warehousesQuery.isLoading,
      fleetQuery.isLoading,
    ],
  );

  // ── Tab content ───────────────────────────────────────────────────────────

  const children: Record<string, React.ReactNode> = {
    overview: (
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {resourceCards.map(rc => (
          <ResourceCard key={rc.label} {...rc} />
        ))}
      </div>
    ),

    suppliers: (
      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left p-4 text-nesma-secondary font-medium">Name</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">City</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">Type</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {suppliersData.slice(0, 15).map(s => (
              <tr key={s.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="p-4 text-white font-medium">{s.name || '-'}</td>
                <td className="p-4 text-gray-300">{s.city || '-'}</td>
                <td className="p-4 text-gray-300">{s.type || '-'}</td>
                <td className="p-4">
                  <StatusBadge status={s.status || 'Active'} />
                </td>
              </tr>
            ))}
            {suppliersData.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-500">
                  No suppliers found
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {suppliersTotal > 15 && (
          <div className="p-3 text-center border-t border-white/10">
            <button
              onClick={() => navigate('/admin/list/suppliers')}
              className="text-nesma-secondary text-sm hover:underline"
            >
              View All {suppliersTotal} Suppliers
            </button>
          </div>
        )}
      </div>
    ),

    items: (
      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left p-4 text-nesma-secondary font-medium">Code</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">Name</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">Category</th>
            </tr>
          </thead>
          <tbody>
            {itemsData.slice(0, 15).map(item => (
              <tr key={item.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="p-4 text-white font-medium">{item.code || '-'}</td>
                <td className="p-4 text-gray-300">{item.name || '-'}</td>
                <td className="p-4 text-gray-300">{item.category || '-'}</td>
              </tr>
            ))}
            {itemsData.length === 0 && (
              <tr>
                <td colSpan={3} className="p-8 text-center text-gray-500">
                  No items found
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {itemsTotal > 15 && (
          <div className="p-3 text-center border-t border-white/10">
            <button
              onClick={() => navigate('/admin/list/items')}
              className="text-nesma-secondary text-sm hover:underline"
            >
              View All {itemsTotal} Items
            </button>
          </div>
        )}
      </div>
    ),

    projects: (
      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left p-4 text-nesma-secondary font-medium">Name</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">Client</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">Region</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">Manager</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {projectsData.slice(0, 15).map(p => (
              <tr key={p.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="p-4 text-white font-medium">{p.name || '-'}</td>
                <td className="p-4 text-gray-300">{p.client || '-'}</td>
                <td className="p-4 text-gray-300">{p.region || '-'}</td>
                <td className="p-4 text-gray-300">{p.manager || '-'}</td>
                <td className="p-4">
                  <StatusBadge status={p.status || 'Active'} />
                </td>
              </tr>
            ))}
            {projectsData.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">
                  No projects found
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {projectsTotal > 15 && (
          <div className="p-3 text-center border-t border-white/10">
            <button
              onClick={() => navigate('/admin/list/projects')}
              className="text-nesma-secondary text-sm hover:underline"
            >
              View All {projectsTotal} Projects
            </button>
          </div>
        )}
      </div>
    ),

    employees: (
      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left p-4 text-nesma-secondary font-medium">Name</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">Department</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">Title</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">Site</th>
            </tr>
          </thead>
          <tbody>
            {employeesData.slice(0, 15).map(e => (
              <tr key={e.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="p-4 text-white font-medium">{e.name || '-'}</td>
                <td className="p-4 text-gray-300">{e.department || '-'}</td>
                <td className="p-4 text-gray-300">{e.title || '-'}</td>
                <td className="p-4 text-gray-300">{e.site || '-'}</td>
              </tr>
            ))}
            {employeesData.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-500">
                  No employees found
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {employeesTotal > 15 && (
          <div className="p-3 text-center border-t border-white/10">
            <button
              onClick={() => navigate('/admin/list/employees')}
              className="text-nesma-secondary text-sm hover:underline"
            >
              View All {employeesTotal} Employees
            </button>
          </div>
        )}
      </div>
    ),

    warehouses: (
      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left p-4 text-nesma-secondary font-medium">ID</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">Name</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">City</th>
            </tr>
          </thead>
          <tbody>
            {warehousesData.slice(0, 15).map(w => (
              <tr key={w.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="p-4 text-white font-medium">{w.id}</td>
                <td className="p-4 text-gray-300">{w.name || '-'}</td>
                <td className="p-4 text-gray-300">{w.city || '-'}</td>
              </tr>
            ))}
            {warehousesData.length === 0 && (
              <tr>
                <td colSpan={3} className="p-8 text-center text-gray-500">
                  No warehouses found
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {warehousesTotal > 15 && (
          <div className="p-3 text-center border-t border-white/10">
            <button
              onClick={() => navigate('/admin/list/warehouses')}
              className="text-nesma-secondary text-sm hover:underline"
            >
              View All {warehousesTotal} Warehouses
            </button>
          </div>
        )}
      </div>
    ),

    equipment: (
      <div className="space-y-6">
        {/* Fleet */}
        <div>
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Truck size={18} className="text-nesma-secondary" /> Fleet Vehicles
          </h3>
          <div className="glass-card rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-4 text-nesma-secondary font-medium">Plate Number</th>
                  <th className="text-left p-4 text-nesma-secondary font-medium">Type</th>
                  <th className="text-left p-4 text-nesma-secondary font-medium">Category</th>
                  <th className="text-left p-4 text-nesma-secondary font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {fleetData.slice(0, 10).map(f => (
                  <tr key={f.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="p-4 text-white font-medium">{f.plateNumber || '-'}</td>
                    <td className="p-4 text-gray-300">{f.type || '-'}</td>
                    <td className="p-4 text-gray-300">{f.category || '-'}</td>
                    <td className="p-4">
                      <StatusBadge status={f.status || 'Active'} />
                    </td>
                  </tr>
                ))}
                {fleetData.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-500">
                      No fleet records
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Generators */}
        <div>
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Zap size={18} className="text-nesma-secondary" /> Generators
          </h3>
          <div className="glass-card rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-4 text-nesma-secondary font-medium">Asset ID</th>
                  <th className="text-left p-4 text-nesma-secondary font-medium">Model</th>
                  <th className="text-left p-4 text-nesma-secondary font-medium">Capacity (kVA)</th>
                  <th className="text-left p-4 text-nesma-secondary font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {generatorsData.slice(0, 10).map(g => (
                  <tr key={g.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="p-4 text-white font-medium">{g.assetId || '-'}</td>
                    <td className="p-4 text-gray-300">{g.model || '-'}</td>
                    <td className="p-4 text-gray-300">{g.capacityKva ?? '-'}</td>
                    <td className="p-4">
                      <StatusBadge status={g.status || 'Active'} />
                    </td>
                  </tr>
                ))}
                {generatorsData.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-500">
                      No generators found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    ),
  };

  return (
    <SectionLandingPage
      title="Master Data"
      subtitle="Core reference data: suppliers, items, projects, employees, and more"
      kpis={kpis}
      tabs={tabs}
      loading={loading}
      children={children}
      defaultTab="overview"
    />
  );
};
