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
const ADMIN_MANAGER_ROLES = [UserRole.ADMIN, UserRole.MANAGER, UserRole.SCRAP_COMMITTEE_MEMBER];
const WAREHOUSE_ROLES = [UserRole.ADMIN, UserRole.WAREHOUSE_SUPERVISOR, UserRole.WAREHOUSE_STAFF];
const TRANSPORT_ROLES = [UserRole.ADMIN, UserRole.FREIGHT_FORWARDER, UserRole.TRANSPORT_SUPERVISOR];
const QC_ROLES = [UserRole.ADMIN, UserRole.QC_OFFICER];
const LOGISTICS_ROLES = [UserRole.ADMIN, UserRole.LOGISTICS_COORDINATOR, UserRole.TRANSPORT_SUPERVISOR];
const ENGINEER_ROLES = [UserRole.ADMIN, UserRole.SITE_ENGINEER];
const MANAGER_ROLES = [UserRole.ADMIN, UserRole.MANAGER];

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
const ForecastDashboard = React.lazy(() =>
  import('@/pages/dashboards/ForecastDashboard').then(m => ({ default: m.ForecastDashboard })),
);
const OperationsDashboard = React.lazy(() =>
  import('@/pages/dashboards/OperationsDashboard').then(m => ({ default: m.OperationsDashboard })),
);
const ExceptionDashboard = React.lazy(() =>
  import('@/pages/dashboards/ExceptionDashboard').then(m => ({ default: m.ExceptionDashboard })),
);
const DepreciationDashboard = React.lazy(() =>
  import('@/pages/dashboards/DepreciationDashboard').then(m => ({ default: m.DepreciationDashboard })),
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

// ABC Analysis page
const AbcAnalysisPage = React.lazy(() =>
  import('@/pages/warehouse/AbcAnalysisPage').then(m => ({ default: m.AbcAnalysisPage })),
);

// Put-Away Rules page
const PutAwayRulesPage = React.lazy(() =>
  import('@/pages/warehouse/PutAwayRulesPage').then(m => ({ default: m.PutAwayRulesPage })),
);

// Cycle Counting pages
const CycleCountListPage = React.lazy(() =>
  import('@/pages/warehouse/CycleCountListPage').then(m => ({ default: m.CycleCountListPage })),
);
const CycleCountDetailPage = React.lazy(() =>
  import('@/pages/warehouse/CycleCountDetailPage').then(m => ({ default: m.CycleCountDetailPage })),
);

// Wave Picking page
const WavePickingPage = React.lazy(() =>
  import('@/pages/warehouse/WavePickingPage').then(m => ({ default: m.WavePickingPage })),
);

// Slotting Optimization page
const SlottingPage = React.lazy(() =>
  import('@/pages/warehouse/SlottingPage').then(m => ({ default: m.SlottingPage })),
);

// Advance Shipping Notice page
const AsnPage = React.lazy(() => import('@/pages/warehouse/AsnPage').then(m => ({ default: m.AsnPage })));

// Cross-Docking page
const CrossDockDashboard = React.lazy(() =>
  import('@/pages/warehouse/CrossDockDashboard').then(m => ({ default: m.CrossDockDashboard })),
);

// IoT Sensor Monitoring
const SensorDashboard = React.lazy(() =>
  import('@/pages/warehouse/SensorDashboard').then(m => ({ default: m.SensorDashboard })),
);

// Yard Management
const YardDashboard = React.lazy(() =>
  import('@/pages/warehouse/YardDashboard').then(m => ({ default: m.YardDashboard })),
);

// Packing Station
const PackingStationPage = React.lazy(() =>
  import('@/pages/warehouse/PackingStationPage').then(m => ({ default: m.PackingStationPage })),
);

// Staging Area Management
const StagingAreaPage = React.lazy(() =>
  import('@/pages/warehouse/StagingAreaPage').then(m => ({ default: m.StagingAreaPage })),
);

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

// Dashboard & Report Builder
const DashboardBuilderPage = React.lazy(() =>
  import('@/pages/DashboardBuilderPage').then(m => ({ default: m.DashboardBuilderPage })),
);
const ReportBuilderPage = React.lazy(() =>
  import('@/pages/ReportBuilderPage').then(m => ({ default: m.ReportBuilderPage })),
);

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

// Pending Approvals page
const PendingApprovalsPage = React.lazy(() =>
  import('@/pages/PendingApprovalsPage').then(m => ({ default: m.PendingApprovalsPage })),
);

// Dynamic Document Type Builder (Admin)
const DynamicTypeListPage = React.lazy(() =>
  import('@/pages/admin/DynamicTypeListPage').then(m => ({ default: m.DynamicTypeListPage })),
);
const DynamicTypeBuilderPage = React.lazy(() =>
  import('@/pages/admin/DynamicTypeBuilderPage').then(m => ({ default: m.DynamicTypeBuilderPage })),
);

// Dynamic Document Runtime Pages
const DynamicDocumentListPage = React.lazy(() =>
  import('@/pages/dynamic/DynamicDocumentListPage').then(m => ({ default: m.DynamicDocumentListPage })),
);
const DynamicDocumentFormPage = React.lazy(() =>
  import('@/pages/dynamic/DynamicDocumentFormPage').then(m => ({ default: m.DynamicDocumentFormPage })),
);

// Custom Data Sources, Custom Fields, Workflow Templates (Admin)
const CustomDataSourcePage = React.lazy(() =>
  import('@/pages/admin/CustomDataSourcePage').then(m => ({ default: m.CustomDataSourcePage })),
);
const CustomFieldsPage = React.lazy(() =>
  import('@/pages/admin/CustomFieldsPage').then(m => ({ default: m.CustomFieldsPage })),
);
const WorkflowTemplatesPage = React.lazy(() =>
  import('@/pages/admin/WorkflowTemplatesPage').then(m => ({ default: m.WorkflowTemplatesPage })),
);

// AI Insights (optional — behind AI_ENABLED flag)
const AiInsightsPage = React.lazy(() =>
  import('@/modules/ai/AiInsightsPage').then(m => ({ default: m.AiInsightsPage })),
);

// Inventory Intelligence — anomaly detection, reorder predictions, health
const IntelligencePage = React.lazy(() =>
  import('@/pages/warehouse/IntelligencePage').then(m => ({ default: m.IntelligencePage })),
);

// Features Showcase & ROI Calculator (Admin)
const FeaturesShowcasePage = React.lazy(() =>
  import('@/pages/admin/FeaturesShowcasePage').then(m => ({ default: m.FeaturesShowcasePage })),
);
const RoiCalculatorPage = React.lazy(() =>
  import('@/pages/admin/RoiCalculatorPage').then(m => ({ default: m.RoiCalculatorPage })),
);

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
    <Route path="/admin/settings/dashboards" element={<DashboardBuilderPage />} />
    <Route path="/admin/settings/reports" element={<ReportBuilderPage />} />
    <Route path="/admin/master" element={<MasterDataSectionPage />} />
    <Route path="/admin/master/:tab" element={<MasterDataSectionPage />} />
    <Route path="/admin/map" element={<MapDashboard />} />

    {/* Backward-compatible redirects (V2 → V3 paths) */}
    <Route path="/admin/material" element={<Navigate to="/admin/warehouses" replace />} />
    <Route path="/admin/material/:tab" element={<Navigate to="/admin/warehouses" replace />} />
    <Route path="/admin/logistics" element={<Navigate to="/admin/equipment" replace />} />
    <Route path="/admin/logistics/:tab" element={<Navigate to="/admin/equipment" replace />} />
    <Route path="/admin/assets" element={<Navigate to="/admin/scrap" replace />} />
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
    <Route path="/admin/dashboards/abc-analysis" element={<AbcAnalysisPage />} />
    <Route path="/admin/dashboards/forecast" element={<ForecastDashboard />} />
    <Route path="/admin/dashboards/operations" element={<OperationsDashboard />} />
    <Route path="/admin/dashboards/exceptions" element={<ExceptionDashboard />} />
    <Route path="/admin/dashboards/depreciation" element={<DepreciationDashboard />} />
    <Route path="/admin/warehouse/putaway-rules" element={<PutAwayRulesPage />} />
    <Route path="/admin/warehouse/cycle-counts" element={<CycleCountListPage />} />
    <Route path="/admin/warehouse/cycle-counts/:id" element={<CycleCountDetailPage />} />
    <Route path="/admin/warehouse/wave-picking" element={<WavePickingPage />} />
    <Route path="/admin/warehouse/asn" element={<AsnPage />} />
    <Route path="/admin/warehouse/slotting" element={<SlottingPage />} />
    <Route path="/admin/warehouse/cross-docking" element={<CrossDockDashboard />} />
    <Route path="/admin/warehouse/sensors" element={<SensorDashboard />} />
    <Route path="/admin/warehouse/yard" element={<YardDashboard />} />
    <Route path="/admin/warehouse/packing" element={<PackingStationPage />} />
    <Route path="/admin/warehouse/staging" element={<StagingAreaPage />} />
    <Route path="/admin/logistics/route-optimizer" element={<RouteOptimizerPage />} />
    <Route path="/admin/quality/inspection-tools" element={<InspectionToolsPage />} />
    <Route path="/admin/parallel-approvals" element={<PendingApprovalsPage />} />

    {/* Dynamic Document Type Builder (Admin) */}
    <Route path="/admin/dynamic-types" element={<DynamicTypeListPage />} />
    <Route path="/admin/dynamic-types/new" element={<DynamicTypeBuilderPage />} />
    <Route path="/admin/dynamic-types/:id" element={<DynamicTypeBuilderPage />} />

    {/* Dynamic Document Runtime Pages */}
    <Route path="/admin/dynamic/:typeCode" element={<DynamicDocumentListPage />} />
    <Route path="/admin/dynamic/:typeCode/new" element={<DynamicDocumentFormPage />} />
    <Route path="/admin/dynamic/:typeCode/:id" element={<DynamicDocumentFormPage />} />

    {/* Custom Data Sources, Custom Fields, Workflow Templates (Admin) */}
    <Route path="/admin/custom-data-sources" element={<CustomDataSourcePage />} />
    <Route path="/admin/custom-fields" element={<CustomFieldsPage />} />
    <Route path="/admin/workflow-templates" element={<WorkflowTemplatesPage />} />

    {/* AI Insights (optional) */}
    <Route path="/admin/ai-insights" element={<AiInsightsPage />} />

    {/* Inventory Intelligence */}
    <Route path="/admin/intelligence" element={<IntelligencePage />} />

    {/* Features Showcase & ROI Calculator */}
    <Route path="/admin/features" element={<FeaturesShowcasePage />} />
    <Route path="/admin/roi-calculator" element={<RoiCalculatorPage />} />

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
    <Route
      path="/warehouse/abc-analysis"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={WAREHOUSE_ROLES}>
          <AbcAnalysisPage />
        </RoleGuard>
      }
    />
    <Route
      path="/warehouse/forecast"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={WAREHOUSE_ROLES}>
          <ForecastDashboard />
        </RoleGuard>
      }
    />
    <Route
      path="/warehouse/putaway-rules"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={WAREHOUSE_ROLES}>
          <PutAwayRulesPage />
        </RoleGuard>
      }
    />
    <Route
      path="/warehouse/intelligence"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={WAREHOUSE_ROLES}>
          <IntelligencePage />
        </RoleGuard>
      }
    />
    <Route
      path="/warehouse/cycle-counts"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={WAREHOUSE_ROLES}>
          <CycleCountListPage />
        </RoleGuard>
      }
    />
    <Route
      path="/warehouse/cycle-counts/:id"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={WAREHOUSE_ROLES}>
          <CycleCountDetailPage />
        </RoleGuard>
      }
    />
    <Route
      path="/warehouse/wave-picking"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={WAREHOUSE_ROLES}>
          <WavePickingPage />
        </RoleGuard>
      }
    />
    <Route
      path="/warehouse/asn"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={WAREHOUSE_ROLES}>
          <AsnPage />
        </RoleGuard>
      }
    />
    <Route
      path="/warehouse/slotting"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={WAREHOUSE_ROLES}>
          <SlottingPage />
        </RoleGuard>
      }
    />
    <Route
      path="/warehouse/cross-docking"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={WAREHOUSE_ROLES}>
          <CrossDockDashboard />
        </RoleGuard>
      }
    />
    <Route
      path="/warehouse/sensors"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={WAREHOUSE_ROLES}>
          <SensorDashboard />
        </RoleGuard>
      }
    />
    <Route
      path="/warehouse/yard"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={WAREHOUSE_ROLES}>
          <YardDashboard />
        </RoleGuard>
      }
    />
    <Route
      path="/warehouse/packing"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={WAREHOUSE_ROLES}>
          <PackingStationPage />
        </RoleGuard>
      }
    />
    <Route
      path="/warehouse/staging"
      element={
        <RoleGuard currentRole={currentRole} allowedRoles={WAREHOUSE_ROLES}>
          <StagingAreaPage />
        </RoleGuard>
      }
    />
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
