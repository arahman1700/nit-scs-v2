import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { UserRole } from '@nit-scs-v2/shared/types';

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
const EngineerDashboard = React.lazy(() =>
  import('@/pages/EngineerDashboard').then(m => ({ default: m.EngineerDashboard })),
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
const WtForm = React.lazy(() => import('@/pages/WtForm').then(m => ({ default: m.WtForm })));
const ImsfForm = React.lazy(() => import('@/pages/ImsfForm').then(m => ({ default: m.ImsfForm })));
const ScrapForm = React.lazy(() => import('@/pages/ScrapForm').then(m => ({ default: m.ScrapForm })));
const SurplusForm = React.lazy(() => import('@/pages/SurplusForm').then(m => ({ default: m.SurplusForm })));
const RentalContractForm = React.lazy(() =>
  import('@/pages/RentalContractForm').then(m => ({ default: m.RentalContractForm })),
);
const ToolIssueForm = React.lazy(() => import('@/pages/ToolIssueForm').then(m => ({ default: m.ToolIssueForm })));

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
const ReceivingSectionPage = React.lazy(() =>
  import('@/pages/sections/ReceivingSectionPage').then(m => ({ default: m.ReceivingSectionPage })),
);
const IssuingSectionPage = React.lazy(() =>
  import('@/pages/sections/IssuingSectionPage').then(m => ({ default: m.IssuingSectionPage })),
);
const QualitySectionPage = React.lazy(() =>
  import('@/pages/sections/QualitySectionPage').then(m => ({ default: m.QualitySectionPage })),
);
const LogisticsSectionPage = React.lazy(() =>
  import('@/pages/sections/LogisticsSectionPage').then(m => ({ default: m.LogisticsSectionPage })),
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
const AssetSectionPage = React.lazy(() =>
  import('@/pages/sections/AssetSectionPage').then(m => ({ default: m.AssetSectionPage })),
);

export const AppRouteDefinitions: React.FC<{ currentRole: UserRole }> = ({ currentRole }) => (
  <Routes>
    <Route
      path="/"
      element={
        currentRole === UserRole.ADMIN ? (
          <Navigate to="/admin" />
        ) : currentRole === UserRole.MANAGER ? (
          <Navigate to="/manager" />
        ) : currentRole === UserRole.WAREHOUSE_SUPERVISOR || currentRole === UserRole.WAREHOUSE_STAFF ? (
          <Navigate to="/warehouse" />
        ) : currentRole === UserRole.QC_OFFICER ? (
          <Navigate to="/qc" />
        ) : currentRole === UserRole.LOGISTICS_COORDINATOR ? (
          <Navigate to="/logistics" />
        ) : currentRole === UserRole.SITE_ENGINEER ? (
          <Navigate to="/site-engineer" />
        ) : currentRole === UserRole.FREIGHT_FORWARDER ? (
          <Navigate to="/transport" />
        ) : currentRole === UserRole.TRANSPORT_SUPERVISOR ? (
          <Navigate to="/logistics" />
        ) : currentRole === UserRole.SCRAP_COMMITTEE_MEMBER ? (
          <Navigate to="/assets/scrap/ssc" />
        ) : (
          <Navigate to="/warehouse" />
        )
      }
    />

    {/* ADMIN SECTION ROUTES */}
    <Route path="/admin" element={<AdminDashboard />} />

    {/* Section Landing Pages (V1 - kept for backward compatibility) */}
    <Route path="/admin/inventory" element={<InventorySectionPage />} />
    <Route path="/admin/quality" element={<QualitySectionPage />} />

    {/* Section Landing Pages (V2) */}
    <Route path="/admin/material" element={<MaterialSectionPage />} />
    <Route path="/admin/material/:tab" element={<MaterialSectionPage />} />
    <Route path="/admin/logistics" element={<LogisticsSectionPage />} />
    <Route path="/admin/logistics/:tab" element={<LogisticsSectionPage />} />
    <Route path="/admin/assets" element={<AssetSectionPage />} />
    <Route path="/admin/assets/:tab" element={<AssetSectionPage />} />
    <Route path="/admin/master" element={<MasterDataSectionPage />} />
    <Route path="/admin/system" element={<AdminSystemPage />} />
    <Route path="/admin/system/workflows/:workflowId" element={<WorkflowBuilderPage />} />
    <Route path="/admin/system/dashboards" element={<DashboardBuilderPage />} />
    <Route path="/admin/system/reports" element={<ReportBuilderPage />} />

    {/* V2 Form Routes */}
    <Route path="/admin/forms/grn" element={<ResourceForm />} />
    <Route path="/admin/forms/grn/:id" element={<ResourceForm />} />
    <Route path="/admin/forms/qci/:id" element={<ResourceForm />} />
    <Route path="/admin/forms/dr" element={<ResourceForm />} />
    <Route path="/admin/forms/dr/:id" element={<ResourceForm />} />
    <Route path="/admin/forms/mi" element={<ResourceForm />} />
    <Route path="/admin/forms/mi/:id" element={<ResourceForm />} />
    <Route path="/admin/forms/mrn" element={<ResourceForm />} />
    <Route path="/admin/forms/mrn/:id" element={<ResourceForm />} />
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

    {/* V1 Form Routes (kept for backward compatibility) */}
    <Route path="/admin/forms/gatepass" element={<GatePassForm />} />
    <Route path="/admin/forms/stock-transfer" element={<StockTransferForm />} />
    <Route path="/admin/forms/mrf" element={<MrfForm />} />
    <Route path="/admin/forms/shipment" element={<ShipmentForm />} />
    <Route path="/admin/forms/customs" element={<CustomsForm />} />
    <Route path="/admin/forms/:formType" element={<ResourceForm />} />
    <Route path="/admin/forms/:formType/:id" element={<ResourceForm />} />

    {/* V2 redirects from old V1 section structure */}
    <Route path="/admin/receiving" element={<Navigate to="/admin/material?tab=grn" replace />} />
    <Route path="/admin/issuing" element={<Navigate to="/admin/material?tab=mi" replace />} />
    <Route path="/admin/quality" element={<Navigate to="/admin/material?tab=qci" replace />} />

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

    <Route path="/admin/transport/board" element={<Navigate to="/admin/logistics?tab=kanban" replace />} />
    <Route path="/admin/transport/job-orders" element={<Navigate to="/admin/logistics?tab=all-jobs" replace />} />
    <Route path="/admin/transport/fleet" element={<Navigate to="/admin/logistics?tab=fleet" replace />} />
    <Route path="/admin/transport/suppliers" element={<Navigate to="/admin/master?tab=suppliers" replace />} />

    <Route path="/admin/shipping/shipments" element={<Navigate to="/admin/receiving?tab=shipments" replace />} />
    <Route path="/admin/shipping/customs" element={<Navigate to="/admin/receiving?tab=customs" replace />} />
    <Route path="/admin/shipping/reports" element={<Navigate to="/admin/system?tab=reports" replace />} />

    <Route path="/admin/quality/rfim" element={<Navigate to="/admin/quality?tab=rfim" replace />} />
    <Route path="/admin/quality/osd" element={<Navigate to="/admin/quality?tab=osd" replace />} />

    <Route path="/admin/management/employees" element={<Navigate to="/admin/master?tab=employees" replace />} />
    <Route path="/admin/management/projects" element={<Navigate to="/admin/master?tab=projects" replace />} />
    <Route path="/admin/management/roles" element={<Navigate to="/admin/system?tab=roles" replace />} />
    <Route path="/admin/audit-log" element={<Navigate to="/admin/system?tab=audit" replace />} />
    <Route path="/admin/settings" element={<Navigate to="/admin/system?tab=settings" replace />} />

    <Route path="/admin/sla" element={<Navigate to="/admin/logistics?tab=sla" replace />} />
    <Route path="/admin/payments" element={<Navigate to="/admin/logistics?tab=payments" replace />} />
    <Route path="/admin/map" element={<Navigate to="/admin/logistics?tab=map" replace />} />

    <Route path="/admin/reports" element={<Navigate to="/admin/system?tab=reports" replace />} />
    <Route path="/admin/reports/:tab" element={<Navigate to="/admin/system?tab=reports" replace />} />

    {/* Generic resource routes */}
    <Route path="/admin/:section/:resource" element={<AdminResourceList />} />

    {/* WAREHOUSE ROUTES */}
    <Route path="/warehouse" element={<WarehouseDashboard />} />
    <Route path="/warehouse/:tab" element={<WarehouseDashboard />} />

    {/* TRANSPORT ROUTES */}
    <Route path="/transport" element={<TransportDashboard />} />
    <Route path="/transport/:view" element={<TransportDashboard />} />

    {/* ENGINEER ROUTES */}
    <Route path="/engineer" element={<EngineerDashboard />} />
    <Route path="/engineer/*" element={<EngineerDashboard />} />

    {/* MANAGER ROUTES */}
    <Route path="/manager" element={<ManagerDashboard />} />
    <Route path="/manager/:tab" element={<ManagerDashboard />} />
    <Route path="/manager/forms/:formType" element={<ResourceForm />} />
    <Route path="/manager/forms/:formType/:id" element={<ResourceForm />} />
    <Route path="/manager/tasks" element={<TasksPage />} />
    <Route path="/manager/documents" element={<DocumentsPage />} />

    {/* QC OFFICER ROUTES */}
    <Route path="/qc" element={<QCOfficerDashboard />} />
    <Route path="/qc/:tab" element={<QCOfficerDashboard />} />
    <Route path="/qc/forms/osd" element={<ResourceForm />} />
    <Route path="/qc/forms/:formType" element={<ResourceForm />} />
    <Route path="/qc/tasks" element={<TasksPage />} />

    {/* LOGISTICS COORDINATOR ROUTES */}
    <Route path="/logistics" element={<LogisticsCoordinatorDashboard />} />
    <Route path="/logistics/:tab" element={<LogisticsCoordinatorDashboard />} />
    <Route path="/logistics/forms/jo" element={<ResourceForm />} />
    <Route path="/logistics/forms/shipment" element={<ShipmentForm />} />
    <Route path="/logistics/forms/gatepass" element={<GatePassForm />} />
    <Route path="/logistics/forms/:formType" element={<ResourceForm />} />
    <Route path="/logistics/forms/:formType/:id" element={<ResourceForm />} />
    <Route path="/logistics/tasks" element={<TasksPage />} />

    {/* SITE ENGINEER ROUTES */}
    <Route path="/site-engineer" element={<SiteEngineerDashboard />} />
    <Route path="/site-engineer/*" element={<SiteEngineerDashboard />} />
    <Route path="/site-engineer/forms/:formType" element={<ResourceForm />} />
    <Route path="/site-engineer/tasks" element={<TasksPage />} />

    {/* SHARED FEATURE ROUTES */}
    <Route path="/admin/tasks" element={<TasksPage />} />
    <Route path="/admin/documents" element={<DocumentsPage />} />
    <Route path="/warehouse/tasks" element={<TasksPage />} />
    <Route path="/transport/tasks" element={<TasksPage />} />
    <Route path="/engineer/tasks" element={<TasksPage />} />
  </Routes>
);
