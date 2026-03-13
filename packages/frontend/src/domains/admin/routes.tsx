import React from 'react';
import { Route, Navigate } from 'react-router-dom';
import { UserRole } from '@nit-scs-v2/shared/types';
import { RoleGuard, ADMIN_MANAGER_ROLES } from '../routeUtils';

// ── Lazy-loaded pages ────────────────────────────────────────────────────
const AdminDashboard = React.lazy(() =>
  import('@/domains/admin/pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })),
);
const AdminResourceList = React.lazy(() =>
  import('@/domains/admin/pages/AdminResourceList').then(m => ({ default: m.AdminResourceList })),
);
const ResourceForm = React.lazy(() =>
  import('@/domains/admin/pages/ResourceForm').then(m => ({ default: m.ResourceForm })),
);
const GatePassForm = React.lazy(() =>
  import('@/domains/logistics/pages/GatePassForm').then(m => ({ default: m.GatePassForm })),
);
const StockTransferForm = React.lazy(() =>
  import('@/domains/transfers/pages/StockTransferForm').then(m => ({ default: m.StockTransferForm })),
);
const MrfForm = React.lazy(() => import('@/domains/outbound/pages/MrfForm').then(m => ({ default: m.MrfForm })));
const ShipmentForm = React.lazy(() =>
  import('@/domains/logistics/pages/ShipmentForm').then(m => ({ default: m.ShipmentForm })),
);
const CustomsForm = React.lazy(() =>
  import('@/domains/logistics/pages/CustomsForm').then(m => ({ default: m.CustomsForm })),
);

// V2 Form imports
const ImsfForm = React.lazy(() => import('@/domains/transfers/pages/ImsfForm').then(m => ({ default: m.ImsfForm })));
const ScrapForm = React.lazy(() => import('@/domains/inventory/pages/ScrapForm').then(m => ({ default: m.ScrapForm })));
const SurplusForm = React.lazy(() =>
  import('@/domains/inventory/pages/SurplusForm').then(m => ({ default: m.SurplusForm })),
);
const RentalContractForm = React.lazy(() =>
  import('@/domains/equipment/pages/RentalContractForm').then(m => ({ default: m.RentalContractForm })),
);
const ToolIssueForm = React.lazy(() =>
  import('@/domains/equipment/pages/ToolIssueForm').then(m => ({ default: m.ToolIssueForm })),
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

// V2 Dashboard imports
const AssetDashboard = React.lazy(() =>
  import('@/pages/dashboards/AssetDashboard').then(m => ({ default: m.AssetDashboard })),
);
const LaborDashboard = React.lazy(() =>
  import('@/pages/dashboards/LaborDashboard').then(m => ({ default: m.LaborDashboard })),
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

// Section Landing Pages (V2 - NEW)
const MaterialSectionPage = React.lazy(() =>
  import('@/pages/sections/MaterialSectionPage').then(m => ({ default: m.MaterialSectionPage })),
);

// Map Dashboard (standalone page)
const MapDashboard = React.lazy(() =>
  import('@/domains/reporting/pages/MapDashboard').then(m => ({ default: m.MapDashboard })),
);

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

// Workflow Builder (parametric route)
const WorkflowBuilderPage = React.lazy(() =>
  import('@/domains/workflow/pages/WorkflowBuilderPage').then(m => ({ default: m.WorkflowBuilderPage })),
);

// Admin Settings Hub
const AdminSettingsHub = React.lazy(() =>
  import('@/pages/admin/AdminSettingsHub').then(m => ({ default: m.AdminSettingsHub })),
);
const NavigationSettingsPage = React.lazy(() =>
  import('@/pages/admin/NavigationSettingsPage').then(m => ({ default: m.NavigationSettingsPage })),
);
const CustomFieldsPage = React.lazy(() =>
  import('@/pages/admin/CustomFieldsPage').then(m => ({ default: m.CustomFieldsPage })),
);
const DynamicTypeListPage = React.lazy(() =>
  import('@/pages/admin/DynamicTypeListPage').then(m => ({ default: m.DynamicTypeListPage })),
);
const DynamicTypeBuilderPage = React.lazy(() =>
  import('@/pages/admin/DynamicTypeBuilderPage').then(m => ({ default: m.DynamicTypeBuilderPage })),
);
const _ApprovalWorkflowPage = React.lazy(() =>
  import('@/pages/admin/ApprovalWorkflowPage').then(m => ({ default: m.ApprovalWorkflowPage })),
);
const _ApprovalLevelsPageStandalone = React.lazy(() =>
  import('@/pages/admin/ApprovalLevelsPage').then(m => ({ default: m.ApprovalLevelsPage })),
);

// Inspection Tools (AQL Calculator & Checklists)
const InspectionToolsPage = React.lazy(() =>
  import('@/pages/quality/InspectionToolsPage').then(m => ({ default: m.InspectionToolsPage })),
);

// Route Optimizer page
const RouteOptimizerPage = React.lazy(() =>
  import('@/pages/logistics/RouteOptimizerPage').then(m => ({ default: m.RouteOptimizerPage })),
);

// Reports Hub & Dashboards Hub
const ReportsHubPage = React.lazy(() => import('@/pages/ReportsHubPage').then(m => ({ default: m.ReportsHubPage })));
const DashboardsHubPage = React.lazy(() =>
  import('@/pages/DashboardsHubPage').then(m => ({ default: m.DashboardsHubPage })),
);

// EventBus Monitor Dashboard
const EventBusMonitorDashboard = React.lazy(() =>
  import('@/pages/dashboards/EventBusMonitorDashboard').then(m => ({ default: m.EventBusMonitorDashboard })),
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
  import('@/domains/workflow/pages/PendingApprovalsPage').then(m => ({ default: m.PendingApprovalsPage })),
);

// ── Admin route definitions ──────────────────────────────────────────────
export function adminRoutes(currentRole: UserRole) {
  return (
    <>
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

      {/* Admin Settings Hub Routes */}
      <Route path="/admin/settings/hub" element={<AdminSettingsHub />} />
      <Route path="/admin/settings/navigation" element={<NavigationSettingsPage />} />
      <Route path="/admin/settings/custom-fields" element={<CustomFieldsPage />} />
      <Route path="/admin/settings/document-types" element={<DynamicTypeListPage />} />
      <Route path="/admin/settings/document-types/new" element={<DynamicTypeBuilderPage />} />
      <Route path="/admin/settings/document-types/:id" element={<DynamicTypeBuilderPage />} />
      <Route path="/admin/settings/workflows" element={<AdminSystemPage />} />
      <Route path="/admin/settings/notifications" element={<AdminSystemPage />} />
      <Route path="/admin/settings/system" element={<AdminSystemPage />} />

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
      <Route
        path="/admin/system/dashboards"
        element={<Navigate to="/admin/settings?tab=dashboard-builder" replace />}
      />
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

      {/* Reports Hub & Dashboards Hub */}
      <Route path="/admin/reports-hub" element={<ReportsHubPage />} />
      <Route path="/admin/dashboards-hub" element={<DashboardsHubPage />} />

      {/* V2 Dashboard Routes */}
      <Route path="/admin/dashboards/assets" element={<AssetDashboard />} />
      <Route path="/admin/dashboards/labor" element={<LaborDashboard />} />

      {/* EventBus Monitor Dashboard (admin-only) */}
      <Route path="/admin/dashboards/eventbus" element={<EventBusMonitorDashboard />} />

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
    </>
  );
}
