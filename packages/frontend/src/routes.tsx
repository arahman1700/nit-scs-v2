import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { UserRole } from '@nit-scs-v2/shared/types';

// ── Role-based route guard component ──────────────────────────────────────
const RoleGuard: React.FC<{
  currentRole: UserRole;
  allowedRoles: UserRole[];
  children: React.ReactNode;
}> = ({ currentRole, allowedRoles, children }) => {
  if (!allowedRoles.includes(currentRole)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

// ── Role groups ──────────────────────────────────────────────────────────
const ADMIN_MANAGER_ROLES = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.SCRAP_COMMITTEE_MEMBER,
  UserRole.FINANCE_USER,
  UserRole.COMPLIANCE_OFFICER,
];
const WAREHOUSE_ROLES = [
  UserRole.ADMIN,
  UserRole.WAREHOUSE_SUPERVISOR,
  UserRole.WAREHOUSE_STAFF,
  UserRole.GATE_OFFICER,
  UserRole.INVENTORY_SPECIALIST,
];
const TRANSPORT_ROLES = [UserRole.ADMIN, UserRole.FREIGHT_FORWARDER, UserRole.TRANSPORT_SUPERVISOR];
const QC_ROLES = [UserRole.ADMIN, UserRole.QC_OFFICER];
const LOGISTICS_ROLES = [
  UserRole.ADMIN,
  UserRole.LOGISTICS_COORDINATOR,
  UserRole.TRANSPORT_SUPERVISOR,
  UserRole.SHIPPING_OFFICER,
  UserRole.CUSTOMS_SPECIALIST,
];
const ENGINEER_ROLES = [UserRole.ADMIN, UserRole.SITE_ENGINEER];
const MANAGER_ROLES = [UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICAL_MANAGER];

// ── Role-to-redirect map ─────────────────────────────────────────────────
const ROLE_REDIRECT: Record<UserRole, string> = {
  [UserRole.ADMIN]: '/admin',
  [UserRole.MANAGER]: '/manager',
  [UserRole.WAREHOUSE_SUPERVISOR]: '/warehouse',
  [UserRole.WAREHOUSE_STAFF]: '/warehouse',
  [UserRole.LOGISTICS_COORDINATOR]: '/logistics',
  [UserRole.SITE_ENGINEER]: '/site-engineer',
  [UserRole.QC_OFFICER]: '/qc',
  [UserRole.FREIGHT_FORWARDER]: '/transport',
  [UserRole.TRANSPORT_SUPERVISOR]: '/logistics',
  [UserRole.SCRAP_COMMITTEE_MEMBER]: '/admin',
  // SOW Section 13.1 — additional roles
  [UserRole.TECHNICAL_MANAGER]: '/manager',
  [UserRole.GATE_OFFICER]: '/warehouse',
  [UserRole.INVENTORY_SPECIALIST]: '/warehouse',
  [UserRole.SHIPPING_OFFICER]: '/logistics',
  [UserRole.FINANCE_USER]: '/admin',
  [UserRole.CUSTOMS_SPECIALIST]: '/logistics',
  [UserRole.COMPLIANCE_OFFICER]: '/admin',
};

// ── 404 Not Found page ───────────────────────────────────────────────────
const NotFoundPage: React.FC = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="glass-card rounded-2xl p-10 max-w-md text-center border border-white/10">
      <div className="text-6xl font-bold text-nesma-primary mb-4">404</div>
      <h1 className="text-xl font-semibold text-white mb-2">Page Not Found</h1>
      <p className="text-gray-400 text-sm mb-6">The page you are looking for does not exist or has been moved.</p>
      <a
        href="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-nesma-primary text-white rounded-xl hover:bg-nesma-accent transition-all text-sm"
      >
        Go to Dashboard
      </a>
    </div>
  </div>
);

// ── Lazy-loaded pages (code-split) ──────────────────────────────────────────
const AdminDashboard = React.lazy(() => import('@/pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AdminResourceList = React.lazy(() =>
  import('@/pages/AdminResourceList').then(m => ({ default: m.AdminResourceList })),
);
const WarehouseDashboard = React.lazy(() =>
  import('@/pages/WarehouseDashboard').then(m => ({ default: m.WarehouseDashboard })),
);
const TransportDashboard = React.lazy(() =>
  import('@/pages/TransportDashboard').then(m => ({ default: m.TransportDashboard })),
);
const ResourceForm = React.lazy(() => import('@/pages/ResourceForm').then(m => ({ default: m.ResourceForm })));
const GatePassForm = React.lazy(() => import('@/pages/GatePassForm').then(m => ({ default: m.GatePassForm })));
const StockTransferForm = React.lazy(() =>
  import('@/pages/StockTransferForm').then(m => ({ default: m.StockTransferForm })),
);
const MrfForm = React.lazy(() => import('@/pages/MrfForm').then(m => ({ default: m.MrfForm })));
const ShipmentForm = React.lazy(() => import('@/pages/ShipmentForm').then(m => ({ default: m.ShipmentForm })));
const CustomsForm = React.lazy(() => import('@/pages/CustomsForm').then(m => ({ default: m.CustomsForm })));

// V2 Form imports
const ImsfForm = React.lazy(() => import('@/pages/ImsfForm').then(m => ({ default: m.ImsfForm })));
const ScrapForm = React.lazy(() => import('@/pages/ScrapForm').then(m => ({ default: m.ScrapForm })));
const SurplusForm = React.lazy(() => import('@/pages/SurplusForm').then(m => ({ default: m.SurplusForm })));
const RentalContractForm = React.lazy(() =>
  import('@/pages/RentalContractForm').then(m => ({ default: m.RentalContractForm })),
);
const ToolIssueForm = React.lazy(() => import('@/pages/ToolIssueForm').then(m => ({ default: m.ToolIssueForm })));

// V2 Dashboard imports
const AssetDashboard = React.lazy(() =>
  import('@/pages/dashboards/AssetDashboard').then(m => ({ default: m.AssetDashboard })),
);
const LaborDashboard = React.lazy(() =>
  import('@/pages/dashboards/LaborDashboard').then(m => ({ default: m.LaborDashboard })),
);
const OperationsDashboard = React.lazy(() =>
  import('@/pages/dashboards/OperationsDashboard').then(m => ({ default: m.OperationsDashboard })),
);

// V2 Form imports (additional)
const HandoverForm = React.lazy(() => import('@/pages/forms/HandoverForm').then(m => ({ default: m.HandoverForm })));
const GeneratorFuelForm = React.lazy(() =>
  import('@/pages/forms/GeneratorFuelForm').then(m => ({ default: m.GeneratorFuelForm })),
);
const GeneratorMaintenanceForm = React.lazy(() =>
  import('@/pages/forms/GeneratorMaintenanceForm').then(m => ({ default: m.GeneratorMaintenanceForm })),
);
const WarehouseZoneForm = React.lazy(() =>
  import('@/pages/forms/WarehouseZoneForm').then(m => ({ default: m.WarehouseZoneForm })),
);
const ToolForm = React.lazy(() => import('@/pages/forms/ToolForm').then(m => ({ default: m.ToolForm })));

// ── MVP DEFERRED: Advanced warehouse features stripped for pilot ──────────

// Mobile scan workflow pages
const MobileDashboard = React.lazy(() =>
  import('@/pages/warehouse/MobileDashboard').then(m => ({ default: m.MobileDashboard })),
);
const MobileGrnReceive = React.lazy(() =>
  import('@/pages/warehouse/MobileGrnReceive').then(m => ({ default: m.MobileGrnReceive })),
);
const MobileMiIssue = React.lazy(() =>
  import('@/pages/warehouse/MobileMiIssue').then(m => ({ default: m.MobileMiIssue })),
);
const MobileWtTransfer = React.lazy(() =>
  import('@/pages/warehouse/MobileWtTransfer').then(m => ({ default: m.MobileWtTransfer })),
);

// New role dashboards
const ManagerDashboard = React.lazy(() =>
  import('@/pages/ManagerDashboard').then(m => ({ default: m.ManagerDashboard })),
);
const QCOfficerDashboard = React.lazy(() =>
  import('@/pages/QCOfficerDashboard').then(m => ({ default: m.QCOfficerDashboard })),
);
const LogisticsCoordinatorDashboard = React.lazy(() =>
  import('@/pages/LogisticsCoordinatorDashboard').then(m => ({ default: m.LogisticsCoordinatorDashboard })),
);
const SiteEngineerDashboard = React.lazy(() =>
  import('@/pages/SiteEngineerDashboard').then(m => ({ default: m.SiteEngineerDashboard })),
);

// Feature pages
const TasksPage = React.lazy(() => import('@/pages/TasksPage').then(m => ({ default: m.TasksPage })));
const DocumentsPage = React.lazy(() => import('@/pages/DocumentsPage').then(m => ({ default: m.DocumentsPage })));

// Workflow Builder (parametric route)
const WorkflowBuilderPage = React.lazy(() =>
  import('@/pages/WorkflowBuilderPage').then(m => ({ default: m.WorkflowBuilderPage })),
);

// Section Landing Pages (V1)
const InventorySectionPage = React.lazy(() =>
  import('@/pages/sections/InventorySectionPage').then(m => ({ default: m.InventorySectionPage })),
);
const QualitySectionPage = React.lazy(() =>
  import('@/pages/sections/QualitySectionPage').then(m => ({ default: m.QualitySectionPage })),
);
const MasterDataSectionPage = React.lazy(() =>
  import('@/pages/sections/MasterDataSectionPage').then(m => ({ default: m.MasterDataSectionPage })),
);
const AdminSystemPage = React.lazy(() =>
  import('@/pages/sections/AdminSystemPage').then(m => ({ default: m.AdminSystemPage })),
);

// Inspection Tools (AQL Calculator & Checklists)
const InspectionToolsPage = React.lazy(() =>
  import('@/pages/quality/InspectionToolsPage').then(m => ({ default: m.InspectionToolsPage })),
);

// Section Landing Pages (V2 - NEW)
const MaterialSectionPage = React.lazy(() =>
  import('@/pages/sections/MaterialSectionPage').then(m => ({ default: m.MaterialSectionPage })),
);
// Map Dashboard (standalone page)
const MapDashboard = React.lazy(() => import('@/pages/MapDashboard').then(m => ({ default: m.MapDashboard })));

// Section Landing Pages (V3 - Reorganized)
const EquipmentSectionPage = React.lazy(() =>
  import('@/pages/sections/EquipmentSectionPage').then(m => ({ default: m.EquipmentSectionPage })),
);
const ScrapSectionPage = React.lazy(() =>
  import('@/pages/sections/ScrapSectionPage').then(m => ({ default: m.ScrapSectionPage })),
);
const ShippingSectionPage = React.lazy(() =>
  import('@/pages/sections/ShippingSectionPage').then(m => ({ default: m.ShippingSectionPage })),
);
const EmployeeSectionPage = React.lazy(() =>
  import('@/pages/sections/EmployeeSectionPage').then(m => ({ default: m.EmployeeSectionPage })),
);

// Route Optimizer page
const RouteOptimizerPage = React.lazy(() =>
  import('@/pages/logistics/RouteOptimizerPage').then(m => ({ default: m.RouteOptimizerPage })),
);

// Gap Analysis Feature Pages
const KpiDashboard = React.lazy(() =>
  import('@/pages/dashboards/KpiDashboard').then(m => ({ default: m.KpiDashboard })),
);
const SecurityDashboard = React.lazy(() =>
  import('@/pages/dashboards/SecurityDashboard').then(m => ({ default: m.SecurityDashboard })),
);
const CostAllocationPage = React.lazy(() =>
  import('@/pages/dashboards/CostAllocationPage').then(m => ({ default: m.CostAllocationPage })),
);
const AmcPage = React.lazy(() => import('@/pages/logistics/AmcPage').then(m => ({ default: m.AmcPage })));
const VehicleMaintenancePage = React.lazy(() =>
  import('@/pages/logistics/VehicleMaintenancePage').then(m => ({ default: m.VehicleMaintenancePage })),
);
const CustomsDocumentsPage = React.lazy(() =>
  import('@/pages/logistics/CustomsDocumentsPage').then(m => ({ default: m.CustomsDocumentsPage })),
);
const TariffPage = React.lazy(() => import('@/pages/logistics/TariffPage').then(m => ({ default: m.TariffPage })));
const AssetRegisterPage = React.lazy(() =>
  import('@/pages/logistics/AssetRegisterPage').then(m => ({ default: m.AssetRegisterPage })),
);
const CompliancePage = React.lazy(() =>
  import('@/pages/quality/CompliancePage').then(m => ({ default: m.CompliancePage })),
);
const ExpiryAlertsPage = React.lazy(() =>
  import('@/pages/warehouse/ExpiryAlertsPage').then(m => ({ default: m.ExpiryAlertsPage })),
);
const DemandAnalyticsPage = React.lazy(() =>
  import('@/pages/warehouse/DemandAnalyticsPage').then(m => ({ default: m.DemandAnalyticsPage })),
);

// Pending Approvals page
const PendingApprovalsPage = React.lazy(() =>
  import('@/pages/PendingApprovalsPage').then(m => ({ default: m.PendingApprovalsPage })),
);

// ── MVP DEFERRED: Admin builder tools, AI, dynamic types stripped for pilot ──

export const AppRouteDefinitions: React.FC<{ currentRole: UserRole }> = ({ currentRole }) => (
  <Routes>
    <Route path="/" element={<Navigate to={ROLE_REDIRECT[currentRole] || '/warehouse'} />} />

    {/* ADMIN SECTION ROUTES */}
    <Route
      path="/admin"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={ADMIN_MANAGER_ROLES}>
          <AdminDashboard />
        </RoleGuard>
      }
    />

    {/* Section Landing Pages (V1 - kept for backward compatibility) */}
    <Route path="/admin/inventory" element={<InventorySectionPage />} />
    <Route path="/admin/quality" element={<QualitySectionPage />} />

    {/* Section Landing Pages (V3 — Reorganized) */}
    <Route path="/admin/warehouses" element={<MaterialSectionPage />} />
    <Route path="/admin/warehouses/:tab" element={<MaterialSectionPage />} />
    <Route path="/admin/equipment" element={<EquipmentSectionPage />} />
    <Route path="/admin/equipment/:tab" element={<EquipmentSectionPage />} />
    <Route path="/admin/scrap" element={<ScrapSectionPage />} />
    <Route path="/admin/scrap/:tab" element={<ScrapSectionPage />} />
    <Route path="/admin/shipping" element={<ShippingSectionPage />} />
    <Route path="/admin/shipping/:tab" element={<ShippingSectionPage />} />
    <Route path="/admin/employees" element={<EmployeeSectionPage />} />
    <Route path="/admin/employees/:tab" element={<EmployeeSectionPage />} />
    <Route path="/admin/settings" element={<AdminSystemPage />} />
    <Route path="/admin/settings/workflows/:workflowId" element={<WorkflowBuilderPage />} />
    <Route path="/admin/master" element={<MasterDataSectionPage />} />
    <Route path="/admin/master/:tab" element={<MasterDataSectionPage />} />
    <Route path="/admin/map" element={<MapDashboard />} />

    {/* Backward-compatible redirects (V2 → V3 paths) */}
    <Route path="/admin/material" element={<Navigate to="/admin/warehouses" replace />} />
    <Route path="/admin/material/:tab" element={<Navigate to="/admin/warehouses" replace />} />
    <Route path="/admin/logistics" element={<Navigate to="/admin/equipment" replace />} />
    <Route path="/admin/logistics/:tab" element={<Navigate to="/admin/equipment" replace />} />
    <Route path="/admin/assets/:tab" element={<Navigate to="/admin/scrap" replace />} />
    <Route path="/admin/system" element={<Navigate to="/admin/settings" replace />} />
    <Route path="/admin/system/workflows/:workflowId" element={<WorkflowBuilderPage />} />
    <Route path="/admin/system/dashboards" element={<Navigate to="/admin/settings?tab=dashboard-builder" replace />} />
    <Route path="/admin/system/reports" element={<Navigate to="/admin/settings?tab=report-builder" replace />} />

    {/* V2 form names (grn, mi, mrn, qci, dr) are handled by the catch-all
        :formType route below — useDocumentForm maps V2→V1 names internally */}
    <Route path="/admin/forms/mr" element={<MrfForm />} />
    <Route path="/admin/forms/mr/:id" element={<MrfForm />} />
    <Route path="/admin/forms/wt" element={<StockTransferForm />} />
    <Route path="/admin/forms/wt/:id" element={<StockTransferForm />} />
    <Route path="/admin/forms/imsf" element={<ImsfForm />} />
    <Route path="/admin/forms/imsf/:id" element={<ImsfForm />} />
    <Route path="/admin/forms/surplus" element={<SurplusForm />} />
    <Route path="/admin/forms/surplus/:id" element={<SurplusForm />} />
    <Route path="/admin/forms/scrap" element={<ScrapForm />} />
    <Route path="/admin/forms/scrap/:id" element={<ScrapForm />} />
    <Route path="/admin/forms/rental-contract" element={<RentalContractForm />} />
    <Route path="/admin/forms/rental-contract/:id" element={<RentalContractForm />} />
    <Route path="/admin/forms/tool-issue" element={<ToolIssueForm />} />
    <Route path="/admin/forms/tool-issue/:id" element={<ToolIssueForm />} />
    <Route path="/admin/forms/handover" element={<HandoverForm />} />
    <Route path="/admin/forms/handover/:id" element={<HandoverForm />} />
    <Route path="/admin/forms/generator-fuel" element={<GeneratorFuelForm />} />
    <Route path="/admin/forms/generator-fuel/:id" element={<GeneratorFuelForm />} />
    <Route path="/admin/forms/generator-maintenance" element={<GeneratorMaintenanceForm />} />
    <Route path="/admin/forms/generator-maintenance/:id" element={<GeneratorMaintenanceForm />} />
    <Route path="/admin/forms/warehouse-zone" element={<WarehouseZoneForm />} />
    <Route path="/admin/forms/warehouse-zone/:id" element={<WarehouseZoneForm />} />
    <Route path="/admin/forms/tool" element={<ToolForm />} />
    <Route path="/admin/forms/tool/:id" element={<ToolForm />} />

    {/* V2 Dashboard Routes */}
    <Route path="/admin/dashboards/assets" element={<AssetDashboard />} />
    <Route path="/admin/dashboards/labor" element={<LaborDashboard />} />

    {/* Gap Analysis Feature Pages */}
    <Route path="/admin/dashboards/kpis" element={<KpiDashboard />} />
    <Route path="/admin/dashboards/security" element={<SecurityDashboard />} />
    <Route path="/admin/dashboards/cost-allocation" element={<CostAllocationPage />} />
    <Route path="/admin/amc" element={<AmcPage />} />
    <Route path="/admin/vehicle-maintenance" element={<VehicleMaintenancePage />} />
    <Route path="/admin/customs-documents" element={<CustomsDocumentsPage />} />
    <Route path="/admin/tariffs" element={<TariffPage />} />
    <Route path="/admin/assets" element={<AssetRegisterPage />} />
    <Route path="/admin/compliance" element={<CompliancePage />} />
    <Route path="/warehouse/expiry-alerts" element={<ExpiryAlertsPage />} />
    <Route path="/warehouse/demand-analytics" element={<DemandAnalyticsPage />} />

    {/* MVP DEFERRED: Advanced warehouse dashboards, analytics, yard stripped for pilot */}
    <Route path="/admin/logistics/route-optimizer" element={<RouteOptimizerPage />} />
    <Route path="/admin/quality/inspection-tools" element={<InspectionToolsPage />} />
    <Route path="/admin/parallel-approvals" element={<PendingApprovalsPage />} />

    {/* MVP DEFERRED: Dynamic types, custom builders, AI, intelligence stripped for pilot */}

    {/* V1 Form Routes (kept for backward compatibility) */}
    <Route path="/admin/forms/gatepass" element={<GatePassForm />} />
    <Route path="/admin/forms/stock-transfer" element={<StockTransferForm />} />
    <Route path="/admin/forms/mrf" element={<MrfForm />} />
    <Route path="/admin/forms/shipment" element={<ShipmentForm />} />
    <Route path="/admin/forms/customs" element={<CustomsForm />} />
    <Route path="/admin/forms/:formType" element={<ResourceForm />} />
    <Route path="/admin/forms/:formType/:id" element={<ResourceForm />} />

    {/* V2 redirects from old V1 section structure */}
    <Route path="/admin/receiving" element={<Navigate to="/admin/warehouses?tab=grn" replace />} />
    <Route path="/admin/issuing" element={<Navigate to="/admin/warehouses?tab=mi" replace />} />
    <Route path="/admin/quality" element={<Navigate to="/admin/warehouses?tab=qci" replace />} />

    {/* LEGACY REDIRECTS (V1) */}
    <Route path="/admin/warehouse/mrrv" element={<Navigate to="/admin/receiving?tab=mrrv" replace />} />
    <Route path="/admin/warehouse/mirv" element={<Navigate to="/admin/issuing?tab=mirv" replace />} />
    <Route path="/admin/warehouse/mrv" element={<Navigate to="/admin/quality?tab=mrv" replace />} />
    <Route path="/admin/warehouse/inventory" element={<Navigate to="/admin/inventory?tab=stock-levels" replace />} />
    <Route
      path="/admin/warehouse/inventory-dashboard"
      element={<Navigate to="/admin/inventory?tab=dashboard" replace />}
    />
    <Route
      path="/admin/warehouse/shifting-materials"
      element={<Navigate to="/admin/inventory?tab=shifting" replace />}
    />
    <Route path="/admin/warehouse/non-moving" element={<Navigate to="/admin/inventory?tab=non-moving" replace />} />
    <Route path="/admin/warehouse/gate-pass" element={<Navigate to="/admin/receiving?tab=gate-passes" replace />} />
    <Route
      path="/admin/warehouse/stock-transfer"
      element={<Navigate to="/admin/issuing?tab=stock-transfers" replace />}
    />

    <Route path="/admin/transport/board" element={<Navigate to="/admin/equipment?tab=kanban" replace />} />
    <Route path="/admin/transport/job-orders" element={<Navigate to="/admin/equipment?tab=all-jobs" replace />} />
    <Route path="/admin/transport/fleet" element={<Navigate to="/admin/equipment?tab=fleet" replace />} />
    <Route path="/admin/transport/suppliers" element={<Navigate to="/admin/master?tab=suppliers" replace />} />

    <Route path="/admin/shipping/shipments" element={<Navigate to="/admin/shipping?tab=shipments" replace />} />
    <Route path="/admin/shipping/customs" element={<Navigate to="/admin/shipping?tab=customs" replace />} />
    <Route path="/admin/shipping/reports" element={<Navigate to="/admin/settings?tab=reports" replace />} />

    <Route path="/admin/quality/rfim" element={<Navigate to="/admin/quality?tab=rfim" replace />} />
    <Route path="/admin/quality/osd" element={<Navigate to="/admin/quality?tab=osd" replace />} />

    <Route path="/admin/management/employees" element={<Navigate to="/admin/employees?tab=employees" replace />} />
    <Route path="/admin/management/projects" element={<Navigate to="/admin/master?tab=projects" replace />} />
    <Route path="/admin/management/roles" element={<Navigate to="/admin/settings?tab=roles" replace />} />
    <Route path="/admin/audit-log" element={<Navigate to="/admin/settings?tab=audit" replace />} />

    <Route path="/admin/sla" element={<Navigate to="/admin/shipping?tab=sla" replace />} />
    <Route path="/admin/payments" element={<Navigate to="/admin/equipment?tab=payments" replace />} />
    {/* /admin/map is now a standalone route — no redirect needed */}

    <Route path="/admin/reports" element={<Navigate to="/admin/settings?tab=reports" replace />} />
    <Route path="/admin/reports/:tab" element={<Navigate to="/admin/settings?tab=reports" replace />} />

    {/* Generic resource routes */}
    <Route path="/admin/:section/:resource" element={<AdminResourceList />} />

    {/* WAREHOUSE ROUTES */}
    <Route
      path="/warehouse"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={WAREHOUSE_ROLES}>
          <WarehouseDashboard />
        </RoleGuard>
      }
    />
    <Route
      path="/warehouse/:tab"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={WAREHOUSE_ROLES}>
          <WarehouseDashboard />
        </RoleGuard>
      }
    />
    {/* MVP DEFERRED: Advanced warehouse features stripped for pilot */}
    <Route
      path="/warehouse/labor"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={WAREHOUSE_ROLES}>
          <LaborDashboard />
        </RoleGuard>
      }
    />
    <Route
      path="/warehouse/mobile"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={WAREHOUSE_ROLES}>
          <MobileDashboard />
        </RoleGuard>
      }
    />
    <Route
      path="/warehouse/mobile/grn-receive"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={WAREHOUSE_ROLES}>
          <MobileGrnReceive />
        </RoleGuard>
      }
    />
    <Route
      path="/warehouse/mobile/mi-issue"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={WAREHOUSE_ROLES}>
          <MobileMiIssue />
        </RoleGuard>
      }
    />
    <Route
      path="/warehouse/mobile/wt-transfer"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={WAREHOUSE_ROLES}>
          <MobileWtTransfer />
        </RoleGuard>
      }
    />

    {/* TRANSPORT ROUTES */}
    <Route
      path="/transport"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={TRANSPORT_ROLES}>
          <TransportDashboard />
        </RoleGuard>
      }
    />
    <Route
      path="/transport/:view"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={TRANSPORT_ROLES}>
          <TransportDashboard />
        </RoleGuard>
      }
    />

    {/* MANAGER ROUTES */}
    <Route
      path="/manager"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={MANAGER_ROLES}>
          <ManagerDashboard />
        </RoleGuard>
      }
    />
    <Route
      path="/manager/:tab"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={MANAGER_ROLES}>
          <ManagerDashboard />
        </RoleGuard>
      }
    />
    <Route
      path="/manager/forms/:formType"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={MANAGER_ROLES}>
          <ResourceForm />
        </RoleGuard>
      }
    />
    <Route
      path="/manager/forms/:formType/:id"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={MANAGER_ROLES}>
          <ResourceForm />
        </RoleGuard>
      }
    />
    <Route
      path="/manager/tasks"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={MANAGER_ROLES}>
          <TasksPage />
        </RoleGuard>
      }
    />
    <Route
      path="/manager/documents"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={MANAGER_ROLES}>
          <DocumentsPage />
        </RoleGuard>
      }
    />
    <Route
      path="/manager/operations"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={MANAGER_ROLES}>
          <OperationsDashboard />
        </RoleGuard>
      }
    />

    {/* QC OFFICER ROUTES */}
    <Route
      path="/qc"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={QC_ROLES}>
          <QCOfficerDashboard />
        </RoleGuard>
      }
    />
    <Route
      path="/qc/:tab"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={QC_ROLES}>
          <QCOfficerDashboard />
        </RoleGuard>
      }
    />
    <Route
      path="/qc/forms/osd"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={QC_ROLES}>
          <ResourceForm />
        </RoleGuard>
      }
    />
    <Route
      path="/qc/forms/:formType"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={QC_ROLES}>
          <ResourceForm />
        </RoleGuard>
      }
    />
    <Route
      path="/qc/tasks"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={QC_ROLES}>
          <TasksPage />
        </RoleGuard>
      }
    />
    <Route
      path="/quality/inspection-tools"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={QC_ROLES}>
          <InspectionToolsPage />
        </RoleGuard>
      }
    />

    {/* LOGISTICS COORDINATOR ROUTES */}
    <Route
      path="/logistics"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={LOGISTICS_ROLES}>
          <LogisticsCoordinatorDashboard />
        </RoleGuard>
      }
    />
    <Route
      path="/logistics/:tab"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={LOGISTICS_ROLES}>
          <LogisticsCoordinatorDashboard />
        </RoleGuard>
      }
    />
    <Route
      path="/logistics/forms/jo"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={LOGISTICS_ROLES}>
          <ResourceForm />
        </RoleGuard>
      }
    />
    <Route
      path="/logistics/forms/shipment"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={LOGISTICS_ROLES}>
          <ShipmentForm />
        </RoleGuard>
      }
    />
    <Route
      path="/logistics/forms/gatepass"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={LOGISTICS_ROLES}>
          <GatePassForm />
        </RoleGuard>
      }
    />
    <Route
      path="/logistics/forms/:formType"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={LOGISTICS_ROLES}>
          <ResourceForm />
        </RoleGuard>
      }
    />
    <Route
      path="/logistics/forms/:formType/:id"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={LOGISTICS_ROLES}>
          <ResourceForm />
        </RoleGuard>
      }
    />
    <Route
      path="/logistics/tasks"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={LOGISTICS_ROLES}>
          <TasksPage />
        </RoleGuard>
      }
    />
    <Route
      path="/logistics/route-optimizer"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={LOGISTICS_ROLES}>
          <RouteOptimizerPage />
        </RoleGuard>
      }
    />

    {/* SITE ENGINEER ROUTES */}
    <Route
      path="/site-engineer"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={ENGINEER_ROLES}>
          <SiteEngineerDashboard />
        </RoleGuard>
      }
    />
    <Route
      path="/site-engineer/*"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={ENGINEER_ROLES}>
          <SiteEngineerDashboard />
        </RoleGuard>
      }
    />
    <Route
      path="/site-engineer/forms/:formType"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={ENGINEER_ROLES}>
          <ResourceForm />
        </RoleGuard>
      }
    />
    <Route
      path="/site-engineer/tasks"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={ENGINEER_ROLES}>
          <TasksPage />
        </RoleGuard>
      }
    />

    {/* SHARED FEATURE ROUTES */}
    <Route
      path="/admin/tasks"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={ADMIN_MANAGER_ROLES}>
          <TasksPage />
        </RoleGuard>
      }
    />
    <Route
      path="/admin/documents"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={ADMIN_MANAGER_ROLES}>
          <DocumentsPage />
        </RoleGuard>
      }
    />
    <Route
      path="/warehouse/tasks"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={WAREHOUSE_ROLES}>
          <TasksPage />
        </RoleGuard>
      }
    />
    <Route
      path="/transport/tasks"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={TRANSPORT_ROLES}>
          <TasksPage />
        </RoleGuard>
      }
    />
    <Route
      path="/engineer/tasks"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={ENGINEER_ROLES}>
          <TasksPage />
        </RoleGuard>
      }
    />

    {/* PENDING APPROVALS — accessible to all authenticated roles */}
    <Route path="/approvals/pending" element={<PendingApprovalsPage />} />

    {/* 404 Catch-all — must be last */}
    <Route path="*" element={<NotFoundPage />} />
  </Routes>
);
