// ---------------------------------------------------------------------------
// Route Aggregation — V2
// ---------------------------------------------------------------------------
// Single barrel file that composes all route modules under /api/v1.
// V2 mounts new route paths (grn, qci, dr, mi, mrn, mr, wt) alongside
// V1 backward-compatible paths (mrrv, rfim, osd, mirv, mrv, mrf, stock-transfers).
// ---------------------------------------------------------------------------

import { Router } from 'express';
import { rateLimiter } from '../middleware/rate-limiter.js';
import { healthCheck } from './health.routes.js';

import authRoutes from './auth.routes.js';
import masterDataRoutes from './master-data.routes.js';

// ── V2 Document Routes (primary) ───────────────────────────────────────
import grnRoutes from './grn.routes.js';
import qciRoutes from './qci.routes.js';
import drRoutes from './dr.routes.js';
import miRoutes from './mi.routes.js';
import mrnRoutes from './mrn.routes.js';
import mrRoutes from './mr.routes.js';
import wtRoutes from './wt.routes.js';

// ── V1 Backward-Compatible Routes (aliases) ────────────────────────────
import mrrvRoutes from './mrrv.routes.js';
import mirvRoutes from './mirv.routes.js';
import mrvRoutes from './mrv.routes.js';
import rfimRoutes from './rfim.routes.js';
import osdRoutes from './osd.routes.js';

// ── New V2 Module Routes ───────────────────────────────────────────────
import imsfRoutes from './imsf.routes.js';
import surplusRoutes from './surplus.routes.js';
import scrapRoutes from './scrap.routes.js';
import sscRoutes from './ssc.routes.js';
import rentalContractRoutes from './rental-contract.routes.js';
import toolRoutes from './tool.routes.js';
import toolIssueRoutes from './tool-issue.routes.js';
import generatorFuelRoutes from './generator-fuel.routes.js';
import generatorMaintenanceRoutes from './generator-maintenance.routes.js';
import warehouseZoneRoutes from './warehouse-zone.routes.js';
import binCardRoutes from './bin-card.routes.js';
import handoverRoutes from './handover.routes.js';
import rateCardRoutes from './rate-card.routes.js';
import visitorRoutes from './visitor.routes.js';
import equipmentNoteRoutes from './equipment-note.routes.js';
import amcRoutes from './amc.routes.js';
import vehicleMaintenanceRoutes from './vehicle-maintenance.routes.js';
// MVP DEFERRED: import putawayRulesRoutes from './putaway-rules.routes.js';

// ── Existing Routes (unchanged) ────────────────────────────────────────
import notificationRoutes from './notification.routes.js';
import auditRoutes from './audit.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import logisticsRoutes from './logistics.routes.js';
import settingsRoutes from './settings.routes.js';
import uploadRoutes from './upload.routes.js';
import permissionsRoutes from './permissions.routes.js';
import taskRoutes from './task.routes.js';
import companyDocumentRoutes from './company-document.routes.js';
import reportsRoutes from './reports.routes.js';
import savedReportRoutes from './saved-report.routes.js';
import barcodeRoutes from './barcode.routes.js';
import workflowRoutes from './workflow.routes.js';
import workflowRuleRoutes from './workflow-rule.routes.js';
import widgetDataRoutes from './widget-data.routes.js';
import dashboardBuilderRoutes from './dashboard-builder.routes.js';
import emailTemplateRoutes from './email-template.routes.js';
import emailLogRoutes from './email-log.routes.js';
import emailWebhookRoutes from './email-webhook.routes.js';
import approvalRoutes from './approval.routes.js';
import parallelApprovalRoutes from './parallel-approval.routes.js';
import commentRoutes from './comment.routes.js';
import bulkRoutes from './bulk.routes.js';
import importRoutes from './import.routes.js';
import delegationRoutes from './delegation.routes.js';
import attachmentRoutes from './attachment.routes.js';
import userViewRoutes from './user-view.routes.js';
// MVP DEFERRED: Advanced warehouse features
// import abcAnalysisRoutes from './abc-analysis.routes.js';
import cycleCountRoutes from './cycle-count.routes.js';
import pickOptimizerRoutes from './pick-optimizer.routes.js';
import routeOptimizerRoutes from './route-optimizer.routes.js';
// import asnRoutes from './asn.routes.js';
import inspectionRoutes from './inspection.routes.js';
import pushRoutes from './push.routes.js';
// import slottingRoutes from './slotting.routes.js';
// import crossDockRoutes from './cross-dock.routes.js';
// import demandForecastRoutes from './demand-forecast.routes.js';  // superseded by demand.routes.ts
// import consumptionTrendRoutes from './consumption-trend.routes.js';  // superseded by demand.routes.ts
// import sensorRoutes from './sensor.routes.js';
// import yardRoutes from './yard.routes.js';
// import packingRoutes from './packing.routes.js';
// import stagingRoutes from './staging.routes.js';

// MVP DEFERRED: Dynamic Documents, Custom builders, ROI
// import dynamicDocTypeRoutes from './dynamic-document-type.routes.js';
// import dynamicDocRoutes from './dynamic-document.routes.js';
// import customDataSourceRoutes from './custom-data-source.routes.js';
// import customFieldRoutes from './custom-fields.routes.js';
// import workflowTemplateRoutes from './workflow-template.routes.js';
// import roiCalculatorRoutes from './roi-calculator.routes.js';

// ── Asset Register (M10) ──────────────────────────────────────────────────
import assetRoutes from './asset.routes.js';

// ── Supplier Performance Evaluation (SOW M2-F05) ────────────────────────
import supplierEvaluationRoutes from './supplier-evaluation.routes.js';

// ── Compliance Audit Checklists (SOW M2 — ISO 9001) ────────────────────
import complianceRoutes from './compliance.routes.js';

// ── Tariff & Duties (SOW M3 — VAT & Duties Calculation) ─────────────────
import tariffRoutes from './tariff.routes.js';

// ── Labor Standards ──────────────────────────────────────────────────────
import laborRoutes from './labor.routes.js';

// ── Navigation ──────────────────────────────────────────────────────────
import navigationRoutes from './navigation.routes.js';

// ── Global Search ───────────────────────────────────────────────────────
import searchRoutes from './search.routes.js';

// ── Semantic Analytics Layer ────────────────────────────────────────────
import semanticRoutes from './semantic.routes.js';

// ── Comprehensive KPI Dashboard (M7) ──────────────────────────────────
import kpiRoutes from './kpi.routes.js';

// ── Security (M6: Access Control & Security) ──────────────────────────
import securityRoutes from './security.routes.js';

// ── Customs Documentation Management (M9) ────────────────────────────
import customsDocumentRoutes from './customs-document.routes.js';

// MVP DEFERRED: import intelligenceRoutes from './intelligence.routes.js';

// ── Demand Analysis (L8 Consumption Trends + L9 Rule-Based Forecasting) ──
import demandRoutes from './demand.routes.js';

// ── Expiry Alerts (L2: Expiry Date Alerts) ──────────────────────────────
import expiryAlertRoutes from './expiry-alert.routes.js';

// ── Digital Signatures (L6) ──────────────────────────────────────────
import signatureRoutes from './digital-signature.routes.js';

// ── Cost Allocation Reports (L7) ──────────────────────────────────────
import costAllocationRoutes from './cost-allocation.routes.js';

const router = Router();

// ── Rate limiter (applied to all /api/v1 routes) ─────────────────────────
router.use(rateLimiter(200, 60_000));

// ── Health Check (no auth required) ───────────────────────────────────────
router.get('/health', healthCheck);

// ── Authentication (public) ───────────────────────────────────────────────
router.use('/auth', authRoutes);

// ── Master Data (17 CRUD entities) ────────────────────────────────────────
router.use('/', masterDataRoutes);

// ── Material Management — V2 Routes (primary) ─────────────────────────────
router.use('/grn', grnRoutes);
router.use('/qci', qciRoutes);
router.use('/dr', drRoutes);
router.use('/mi', miRoutes);
router.use('/mrn', mrnRoutes);
router.use('/mr', mrRoutes);
router.use('/wt', wtRoutes);

// ── Material Management — V1 Routes (backward compatibility) ──────────────
router.use('/mrrv', mrrvRoutes);
router.use('/mirv', mirvRoutes);
router.use('/mrv', mrvRoutes);
router.use('/rfim', rfimRoutes);
router.use('/osd', osdRoutes);

// ── New V2 Modules ────────────────────────────────────────────────────────
router.use('/imsf', imsfRoutes);
router.use('/surplus', surplusRoutes);
router.use('/scrap', scrapRoutes);
router.use('/ssc', sscRoutes);
router.use('/rental-contracts', rentalContractRoutes);
router.use('/tools', toolRoutes);
router.use('/tool-issues', toolIssueRoutes);
router.use('/generator-fuel', generatorFuelRoutes);
router.use('/generator-maintenance', generatorMaintenanceRoutes);
router.use('/warehouse-zones', warehouseZoneRoutes);
router.use('/bin-cards', binCardRoutes);
router.use('/handovers', handoverRoutes);
router.use('/rate-cards', rateCardRoutes);
router.use('/visitors', visitorRoutes);
router.use('/equipment-notes', equipmentNoteRoutes);
router.use('/amc', amcRoutes);
router.use('/vehicle-maintenance', vehicleMaintenanceRoutes);
// MVP DEFERRED: router.use('/putaway-rules', putawayRulesRoutes);

// ── Logistics (job-orders, gate-passes, stock-transfers, mrf, shipments) ─
router.use('/', logisticsRoutes);

// ── System ────────────────────────────────────────────────────────────────
router.use('/notifications', notificationRoutes);
router.use('/audit', auditRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/settings', settingsRoutes);
router.use('/upload', uploadRoutes);
router.use('/permissions', permissionsRoutes);
router.use('/tasks', taskRoutes);
router.use('/documents', companyDocumentRoutes);

// ── Reports — mount /saved BEFORE generic /reports to avoid shadowing ─────
router.use('/reports/saved', savedReportRoutes);
router.use('/reports', reportsRoutes);

// ── Barcodes ──────────────────────────────────────────────────────────────
router.use('/barcodes', barcodeRoutes);

// ── Workflow Engine ───────────────────────────────────────────────────────
router.use('/workflows', workflowRoutes);
router.use('/workflows/:workflowId/rules', workflowRuleRoutes);

// ── Dashboard & Report Builders ───────────────────────────────────────────
router.use('/widget-data', widgetDataRoutes);
router.use('/dashboards', dashboardBuilderRoutes);

// ── Approvals ─────────────────────────────────────────────────────────────
router.use('/approvals', approvalRoutes);

// ── Parallel Approvals ──────────────────────────────────────────────────
router.use('/parallel-approvals', parallelApprovalRoutes);

// ── Document Comments ──────────────────────────────────────────────────────
router.use('/comments', commentRoutes);

// ── Bulk Operations ───────────────────────────────────────────────────────
router.use('/bulk', bulkRoutes);

// ── Excel Import ──────────────────────────────────────────────────────────
router.use('/import', importRoutes);

// ── Delegation Rules ──────────────────────────────────────────────────────
router.use('/delegations', delegationRoutes);

// ── Email System ──────────────────────────────────────────────────────────
router.use('/email-templates', emailTemplateRoutes);
router.use('/email-logs', emailLogRoutes);
router.use('/webhooks', emailWebhookRoutes);

// ── File Attachments ─────────────────────────────────────────────────────
router.use('/attachments', attachmentRoutes);

// ── User View Preferences ────────────────────────────────────────────────
router.use('/views', userViewRoutes);

// ── MVP DEFERRED: Advanced warehouse features ──────────────────────────
// router.use('/abc-analysis', abcAnalysisRoutes);
router.use('/cycle-counts', cycleCountRoutes);
router.use('/pick-optimizer', pickOptimizerRoutes);
// router.use('/asn', asnRoutes);
// router.use('/slotting', slottingRoutes);
// router.use('/cross-docks', crossDockRoutes);
// router.use('/demand-forecast', demandForecastRoutes);  // superseded by /demand
// router.use('/consumption-trends', consumptionTrendRoutes);  // superseded by /demand
// router.use('/sensors', sensorRoutes);
// router.use('/yard', yardRoutes);
// router.use('/packing', packingRoutes);
// router.use('/staging', stagingRoutes);
// router.use('/putaway-rules', putawayRulesRoutes);

// ── MVP DEFERRED: Dynamic Documents, Custom builders, ROI ──────────────
// router.use('/dynamic-types', dynamicDocTypeRoutes);
// router.use('/dynamic', dynamicDocRoutes);
// router.use('/custom-data-sources', customDataSourceRoutes);
// router.use('/custom-fields', customFieldRoutes);
// router.use('/workflow-templates', workflowTemplateRoutes);
// router.use('/roi-calculator', roiCalculatorRoutes);

// ── Route Optimization (JO Transport — kept for logistics) ─────────────
router.use('/route-optimizer', routeOptimizerRoutes);

// ── Inspection Tools (AQL Calculator & Checklists — core QC) ───────────
router.use('/inspections', inspectionRoutes);

// ── Web Push Notifications ──────────────────────────────────────────────
router.use('/push', pushRoutes);

// ── Supplier Performance Evaluation ──────────────────────────────────────
router.use('/supplier-evaluations', supplierEvaluationRoutes);

// ── Asset Register (M10) ────────────────────────────────────────────────
router.use('/assets', assetRoutes);

// ── Compliance Audit Checklists (ISO 9001) ──────────────────────────────
router.use('/compliance', complianceRoutes);

// ── Tariff & Duties (SOW M3) ────────────────────────────────────────────
router.use('/tariffs', tariffRoutes);

// ── Labor Standards ──────────────────────────────────────────────────────
router.use('/labor', laborRoutes);

// ── Navigation ──────────────────────────────────────────────────────────
router.use('/navigation', navigationRoutes);

// ── Global Search ───────────────────────────────────────────────────────
router.use('/search', searchRoutes);

// ── Semantic Analytics Layer ────────────────────────────────────────────
router.use('/semantic', semanticRoutes);

// ── Comprehensive KPI Dashboard (M7) ──────────────────────────────────
router.use('/kpis', kpiRoutes);

// ── Security (M6: Access Control & Security) ────────────────────────────
router.use('/security', securityRoutes);

// ── Customs Documentation Management (M9) ──────────────────────────────
router.use('/customs-documents', customsDocumentRoutes);

// ── Expiry Alerts (L2: Inventory Expiry Date Alerts) ──────────────────
router.use('/inventory', expiryAlertRoutes);

// ── Digital Signatures (L6) ──────────────────────────────────────────
router.use('/signatures', signatureRoutes);

// ── Cost Allocation Reports (L7) ──────────────────────────────────────
router.use('/cost-allocation', costAllocationRoutes);

// ── Demand Analysis (L8 + L9) ────────────────────────────────────────
router.use('/demand', demandRoutes);

// MVP DEFERRED: router.use('/intelligence', intelligenceRoutes);

export default router;
