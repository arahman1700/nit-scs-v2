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
import putawayRulesRoutes from './putaway-rules.routes.js';

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
import abcAnalysisRoutes from './abc-analysis.routes.js';
import cycleCountRoutes from './cycle-count.routes.js';
import pickOptimizerRoutes from './pick-optimizer.routes.js';
import routeOptimizerRoutes from './route-optimizer.routes.js';
import asnRoutes from './asn.routes.js';
import inspectionRoutes from './inspection.routes.js';
import pushRoutes from './push.routes.js';
import slottingRoutes from './slotting.routes.js';
import crossDockRoutes from './cross-dock.routes.js';
import demandForecastRoutes from './demand-forecast.routes.js';
import sensorRoutes from './sensor.routes.js';
import yardRoutes from './yard.routes.js';
import packingRoutes from './packing.routes.js';
import stagingRoutes from './staging.routes.js';

// ── Dynamic Documents ───────────────────────────────────────────────────
import dynamicDocTypeRoutes from './dynamic-document-type.routes.js';
import dynamicDocRoutes from './dynamic-document.routes.js';

// ── Custom Data Sources & Custom Fields ─────────────────────────────────
import customDataSourceRoutes from './custom-data-source.routes.js';
import customFieldRoutes from './custom-fields.routes.js';

// ── Workflow Templates (Marketplace) ────────────────────────────────────
import workflowTemplateRoutes from './workflow-template.routes.js';

// ── ROI Calculator ──────────────────────────────────────────────────────
import roiCalculatorRoutes from './roi-calculator.routes.js';

// ── Global Search ───────────────────────────────────────────────────────
import searchRoutes from './search.routes.js';

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
router.use('/putaway-rules', putawayRulesRoutes);

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

// ── ABC Inventory Analysis ──────────────────────────────────────────────
router.use('/abc-analysis', abcAnalysisRoutes);

// ── Cycle Counting ──────────────────────────────────────────────────────
router.use('/cycle-counts', cycleCountRoutes);

// ── Pick Path Optimization & Wave Picking ───────────────────────────────
router.use('/pick-optimizer', pickOptimizerRoutes);

// ── Route Optimization (JO Transport) ───────────────────────────────────
router.use('/route-optimizer', routeOptimizerRoutes);

// ── Advance Shipping Notice ─────────────────────────────────────────────
router.use('/asn', asnRoutes);

// ── Inspection Tools (AQL Calculator & Checklists) ─────────────────────
router.use('/inspections', inspectionRoutes);

// ── Web Push Notifications ──────────────────────────────────────────────
router.use('/push', pushRoutes);

// ── Slotting Optimization ───────────────────────────────────────────────
router.use('/slotting', slottingRoutes);

// ── Cross-Docking ───────────────────────────────────────────────────────
router.use('/cross-docks', crossDockRoutes);

// ── Demand Forecasting ──────────────────────────────────────────────────
router.use('/demand-forecast', demandForecastRoutes);

// ── IoT Sensor Monitoring ───────────────────────────────────────────────
router.use('/sensors', sensorRoutes);

// ── Yard Management ─────────────────────────────────────────────────
router.use('/yard', yardRoutes);

// ── Packing Station ─────────────────────────────────────────────────
router.use('/packing', packingRoutes);

// ── Staging Area Management ─────────────────────────────────────────
router.use('/staging', stagingRoutes);

// ── Dynamic Document System ─────────────────────────────────────────────
router.use('/dynamic-types', dynamicDocTypeRoutes);
router.use('/dynamic', dynamicDocRoutes);

// ── Custom Data Sources & Custom Fields ─────────────────────────────────
router.use('/custom-data-sources', customDataSourceRoutes);
router.use('/custom-fields', customFieldRoutes);

// ── Workflow Templates (Marketplace) ────────────────────────────────────
router.use('/workflow-templates', workflowTemplateRoutes);

// ── ROI Calculator ──────────────────────────────────────────────────────
router.use('/roi-calculator', roiCalculatorRoutes);

// ── Global Search ───────────────────────────────────────────────────────
router.use('/search', searchRoutes);

export default router;
