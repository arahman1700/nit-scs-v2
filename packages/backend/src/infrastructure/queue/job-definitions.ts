/**
 * Job Definitions — Oracle-Compatible Job Names & Schedules
 *
 * Maps every scheduled background job to a BullMQ repeatable job definition.
 * Job names follow Oracle Concurrent Program naming:
 *   {MODULE}_{ENTITY}_{ACTION}
 *
 * Example: INV_ABC_CLASSIFICATION → Oracle INV module, ABC entity, classification action
 */

import { QUEUE_NAMES, type QueueName } from './bullmq.config.js';

// ── Job Name Constants (Oracle-Compatible) ──────────────────────────────────

export const JOB_NAMES = {
  // ── SCM: Supply Chain Management ──────────────────────────────────────
  /** SLA breach detection for pending documents */
  SCM_SLA_BREACH_CHECK: 'SCM_SLA_BREACH_CHECK',
  /** SLA warning (1h before deadline) */
  SCM_SLA_WARNING_CHECK: 'SCM_SLA_WARNING_CHECK',
  /** Daily operational reconciliation (lot totals, gate-vs-MI) */
  SCM_DAILY_RECONCILIATION: 'SCM_DAILY_RECONCILIATION',
  /** Generate scheduled reports */
  SCM_SCHEDULED_REPORTS: 'SCM_SCHEDULED_REPORTS',
  /** Execute scheduled workflow rules */
  SCM_SCHEDULED_RULES: 'SCM_SCHEDULED_RULES',

  // ── INV: Inventory Management ─────────────────────────────────────────
  /** ABC classification recalculation */
  INV_ABC_CLASSIFICATION: 'INV_ABC_CLASSIFICATION',
  /** Low stock / reorder point alerts */
  INV_LOW_STOCK_ALERT: 'INV_LOW_STOCK_ALERT',
  /** Mark expired lots */
  INV_EXPIRED_LOT_CHECK: 'INV_EXPIRED_LOT_CHECK',
  /** Auto-create scheduled cycle counts */
  INV_CYCLE_COUNT_AUTO: 'INV_CYCLE_COUNT_AUTO',
  /** Expire old gate passes */
  INV_GATE_PASS_EXPIRY: 'INV_GATE_PASS_EXPIRY',
  /** Inventory anomaly detection */
  INV_ANOMALY_DETECTION: 'INV_ANOMALY_DETECTION',
  /** Auto-update reorder points from forecast */
  INV_REORDER_UPDATE: 'INV_REORDER_UPDATE',
  /** Expiry date approaching alerts (L2 logic) */
  INV_EXPIRY_ALERT: 'INV_EXPIRY_ALERT',
  /** Auto-quarantine expired lots (L2 logic) */
  INV_EXPIRY_QUARANTINE: 'INV_EXPIRY_QUARANTINE',

  // ── HR: Human Resources / Security ────────────────────────────────────
  /** Cleanup expired refresh tokens */
  HR_TOKEN_CLEANUP: 'HR_TOKEN_CLEANUP',
  /** Detect suspicious login activity */
  HR_SECURITY_MONITOR: 'HR_SECURITY_MONITOR',
  /** Check visitor overstays */
  HR_VISITOR_OVERSTAY: 'HR_VISITOR_OVERSTAY',

  // ── SCM: Customs & Logistics ───────────────────────────────────────────
  /** Customs document expiry warnings (7/3/1 day) */
  SCM_CUSTOMS_EXPIRY: 'SCM_CUSTOMS_EXPIRY',

  // ── EAM: Enterprise Asset Management ──────────────────────────────────
  /** Calculate asset depreciation */
  EAM_ASSET_DEPRECIATION: 'EAM_ASSET_DEPRECIATION',
  /** Check AMC/maintenance contract expiry */
  EAM_AMC_EXPIRY: 'EAM_AMC_EXPIRY',
  /** Check vehicle maintenance due (usage-based) */
  EAM_VEHICLE_MAINTENANCE: 'EAM_VEHICLE_MAINTENANCE',

  // ── ONT: Order & Notification Transport ───────────────────────────────
  /** Retry failed email sends */
  ONT_EMAIL_RETRY: 'ONT_EMAIL_RETRY',
  /** Equipment return due alerts (SOW N-03) */
  ONT_EQUIPMENT_RETURN: 'ONT_EQUIPMENT_RETURN',
  /** Shipment delay alerts (SOW N-05) */
  ONT_SHIPMENT_DELAYS: 'ONT_SHIPMENT_DELAYS',
  /** Scheduled cycle count alerts (SOW N-08) */
  ONT_CYCLE_COUNT_ALERT: 'ONT_CYCLE_COUNT_ALERT',
  /** Rate card expiry alerts (SOW N-09) */
  ONT_RATE_CARD_EXPIRY: 'ONT_RATE_CARD_EXPIRY',
  /** Vehicle maintenance due alerts (SOW N-10) */
  ONT_VEHICLE_MAINT_ALERT: 'ONT_VEHICLE_MAINT_ALERT',
  /** NCR/DR deadline alerts (SOW N-12) */
  ONT_NCR_DEADLINE: 'ONT_NCR_DEADLINE',
  /** Contract/insurance renewal alerts (SOW N-13) */
  ONT_CONTRACT_RENEWAL: 'ONT_CONTRACT_RENEWAL',
  /** Overdue tool return alerts (SOW N-14) */
  ONT_OVERDUE_TOOLS: 'ONT_OVERDUE_TOOLS',
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

// ── Job → Legacy Name Mapping (for backward compat with job handlers) ────

export const JOB_LEGACY_MAP: Record<JobName, string> = {
  SCM_SLA_BREACH_CHECK: 'sla_breach',
  SCM_SLA_WARNING_CHECK: 'sla_warning',
  SCM_DAILY_RECONCILIATION: 'daily_reconciliation',
  SCM_SCHEDULED_REPORTS: 'scheduled_reports',
  SCM_SCHEDULED_RULES: 'scheduled_rules',
  INV_ABC_CLASSIFICATION: 'abc_classification',
  INV_LOW_STOCK_ALERT: 'low_stock',
  INV_EXPIRED_LOT_CHECK: 'expired_lots',
  INV_CYCLE_COUNT_AUTO: 'cycle_count_auto',
  INV_GATE_PASS_EXPIRY: 'gate_pass_expiry',
  INV_ANOMALY_DETECTION: 'anomaly_detection',
  INV_REORDER_UPDATE: 'reorder_update',
  INV_EXPIRY_ALERT: 'expiry_alerts',
  INV_EXPIRY_QUARANTINE: 'expiry_quarantine',
  HR_TOKEN_CLEANUP: 'token_cleanup',
  HR_SECURITY_MONITOR: 'security_monitor',
  HR_VISITOR_OVERSTAY: 'visitor_overstay',
  EAM_ASSET_DEPRECIATION: 'asset_depreciation',
  EAM_AMC_EXPIRY: 'amc_expiry',
  EAM_VEHICLE_MAINTENANCE: 'vehicle_maintenance',
  SCM_CUSTOMS_EXPIRY: 'customs_expiry',
  ONT_EMAIL_RETRY: 'email_retry',
  ONT_EQUIPMENT_RETURN: 'sow_equipment_return',
  ONT_SHIPMENT_DELAYS: 'sow_shipment_delays',
  ONT_CYCLE_COUNT_ALERT: 'sow_cycle_count',
  ONT_RATE_CARD_EXPIRY: 'sow_rate_card_expiry',
  ONT_VEHICLE_MAINT_ALERT: 'sow_vehicle_maint',
  ONT_NCR_DEADLINE: 'sow_ncr_deadline',
  ONT_CONTRACT_RENEWAL: 'sow_contract_renewal',
  ONT_OVERDUE_TOOLS: 'sow_overdue_tools',
};

// ── Job Definitions ─────────────────────────────────────────────────────────

export interface JobDefinition {
  name: JobName;
  legacyName: string;
  queue: QueueName;
  /** Cron expression OR interval in ms for BullMQ repeatable */
  repeat: { every: number } | { pattern: string };
  /** Priority (1 = highest). Oracle uses 1-99. */
  priority: number;
  /** Max attempts before dead-letter */
  attempts: number;
  /** Backoff config */
  backoff: { type: 'exponential' | 'fixed'; delay: number };
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const JOB_DEFINITIONS: JobDefinition[] = [
  // ── SCM Jobs → WMS_QUEUE (core WMS operations, SLA, reconciliation) ─
  {
    name: JOB_NAMES.SCM_SLA_BREACH_CHECK,
    legacyName: 'sla_breach',
    queue: QUEUE_NAMES.WMS_QUEUE,
    repeat: { every: 5 * MIN },
    priority: 1,
    attempts: 3,
    backoff: { type: 'exponential', delay: 10_000 },
  },
  {
    name: JOB_NAMES.SCM_SLA_WARNING_CHECK,
    legacyName: 'sla_warning',
    queue: QUEUE_NAMES.WMS_QUEUE,
    repeat: { every: 5 * MIN },
    priority: 1,
    attempts: 3,
    backoff: { type: 'exponential', delay: 10_000 },
  },
  {
    name: JOB_NAMES.SCM_SCHEDULED_RULES,
    legacyName: 'scheduled_rules',
    queue: QUEUE_NAMES.WMS_QUEUE,
    repeat: { every: 1 * MIN },
    priority: 2,
    attempts: 3,
    backoff: { type: 'fixed', delay: 5_000 },
  },
  {
    name: JOB_NAMES.SCM_SCHEDULED_REPORTS,
    legacyName: 'scheduled_reports',
    queue: QUEUE_NAMES.WMS_QUEUE,
    repeat: { every: 1 * HOUR },
    priority: 5,
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
  },
  {
    name: JOB_NAMES.SCM_DAILY_RECONCILIATION,
    legacyName: 'daily_reconciliation',
    queue: QUEUE_NAMES.WMS_QUEUE,
    repeat: { pattern: '0 2 * * *' },
    priority: 3,
    attempts: 5,
    backoff: { type: 'exponential', delay: 60_000 },
  },

  // ── INV Jobs ──────────────────────────────────────────────────────────
  {
    name: JOB_NAMES.INV_LOW_STOCK_ALERT,
    legacyName: 'low_stock',
    queue: QUEUE_NAMES.INV_QUEUE,
    repeat: { every: 30 * MIN },
    priority: 2,
    attempts: 3,
    backoff: { type: 'exponential', delay: 15_000 },
  },
  {
    name: JOB_NAMES.INV_EXPIRED_LOT_CHECK,
    legacyName: 'expired_lots',
    queue: QUEUE_NAMES.INV_QUEUE,
    repeat: { every: 1 * HOUR },
    priority: 3,
    attempts: 3,
    backoff: { type: 'exponential', delay: 15_000 },
  },
  {
    name: JOB_NAMES.INV_GATE_PASS_EXPIRY,
    legacyName: 'gate_pass_expiry',
    queue: QUEUE_NAMES.INV_QUEUE,
    repeat: { every: 1 * HOUR },
    priority: 4,
    attempts: 3,
    backoff: { type: 'exponential', delay: 15_000 },
  },
  {
    name: JOB_NAMES.INV_CYCLE_COUNT_AUTO,
    legacyName: 'cycle_count_auto',
    queue: QUEUE_NAMES.INV_QUEUE,
    repeat: { every: 1 * DAY },
    priority: 5,
    attempts: 5,
    backoff: { type: 'exponential', delay: 60_000 },
  },
  {
    name: JOB_NAMES.INV_ABC_CLASSIFICATION,
    legacyName: 'abc_classification',
    queue: QUEUE_NAMES.INV_QUEUE,
    repeat: { every: 7 * DAY },
    priority: 8,
    attempts: 5,
    backoff: { type: 'exponential', delay: 120_000 },
  },
  {
    name: JOB_NAMES.INV_ANOMALY_DETECTION,
    legacyName: 'anomaly_detection',
    queue: QUEUE_NAMES.INV_QUEUE,
    repeat: { every: 6 * HOUR },
    priority: 5,
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
  },
  {
    name: JOB_NAMES.INV_REORDER_UPDATE,
    legacyName: 'reorder_update',
    queue: QUEUE_NAMES.INV_QUEUE,
    repeat: { every: 7 * DAY },
    priority: 8,
    attempts: 5,
    backoff: { type: 'exponential', delay: 120_000 },
  },
  {
    name: JOB_NAMES.INV_EXPIRY_ALERT,
    legacyName: 'expiry_alerts',
    queue: QUEUE_NAMES.INV_QUEUE,
    repeat: { every: 1 * DAY },
    priority: 3,
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
  },
  {
    name: JOB_NAMES.INV_EXPIRY_QUARANTINE,
    legacyName: 'expiry_quarantine',
    queue: QUEUE_NAMES.INV_QUEUE,
    repeat: { every: 12 * HOUR },
    priority: 2,
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
  },

  // ── HR Jobs → AUD_QUEUE (audit & compliance, security, tokens, visitors)
  {
    name: JOB_NAMES.HR_TOKEN_CLEANUP,
    legacyName: 'token_cleanup',
    queue: QUEUE_NAMES.AUD_QUEUE,
    repeat: { every: 6 * HOUR },
    priority: 7,
    attempts: 3,
    backoff: { type: 'fixed', delay: 10_000 },
  },
  {
    name: JOB_NAMES.HR_SECURITY_MONITOR,
    legacyName: 'security_monitor',
    queue: QUEUE_NAMES.AUD_QUEUE,
    repeat: { every: 1 * HOUR },
    priority: 2,
    attempts: 3,
    backoff: { type: 'exponential', delay: 15_000 },
  },
  {
    name: JOB_NAMES.HR_VISITOR_OVERSTAY,
    legacyName: 'visitor_overstay',
    queue: QUEUE_NAMES.AUD_QUEUE,
    repeat: { every: 30 * MIN },
    priority: 4,
    attempts: 3,
    backoff: { type: 'exponential', delay: 10_000 },
  },

  // ── EAM Jobs → WMS_QUEUE (asset management under WMS umbrella) ──────
  {
    name: JOB_NAMES.EAM_ASSET_DEPRECIATION,
    legacyName: 'asset_depreciation',
    queue: QUEUE_NAMES.WMS_QUEUE,
    repeat: { every: 1 * DAY },
    priority: 6,
    attempts: 5,
    backoff: { type: 'exponential', delay: 60_000 },
  },
  {
    name: JOB_NAMES.EAM_AMC_EXPIRY,
    legacyName: 'amc_expiry',
    queue: QUEUE_NAMES.WMS_QUEUE,
    repeat: { every: 1 * DAY },
    priority: 5,
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
  },
  {
    name: JOB_NAMES.EAM_VEHICLE_MAINTENANCE,
    legacyName: 'vehicle_maintenance',
    queue: QUEUE_NAMES.WMS_QUEUE,
    repeat: { every: 12 * HOUR },
    priority: 4,
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
  },

  // ── SCM Customs Jobs → WMS_QUEUE ──────────────────────────────────────
  {
    name: JOB_NAMES.SCM_CUSTOMS_EXPIRY,
    legacyName: 'customs_expiry',
    queue: QUEUE_NAMES.WMS_QUEUE,
    repeat: { every: 1 * DAY },
    priority: 4,
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
  },

  // ── ONT Jobs → NOTIF_QUEUE (notifications, email, push, alerts) ─────
  {
    name: JOB_NAMES.ONT_EMAIL_RETRY,
    legacyName: 'email_retry',
    queue: QUEUE_NAMES.NOTIF_QUEUE,
    repeat: { every: 2 * MIN },
    priority: 1,
    attempts: 5,
    backoff: { type: 'exponential', delay: 5_000 },
  },
  {
    name: JOB_NAMES.ONT_EQUIPMENT_RETURN,
    legacyName: 'sow_equipment_return',
    queue: QUEUE_NAMES.NOTIF_QUEUE,
    repeat: { every: 1 * DAY },
    priority: 5,
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
  },
  {
    name: JOB_NAMES.ONT_SHIPMENT_DELAYS,
    legacyName: 'sow_shipment_delays',
    queue: QUEUE_NAMES.NOTIF_QUEUE,
    repeat: { every: 6 * HOUR },
    priority: 3,
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
  },
  {
    name: JOB_NAMES.ONT_CYCLE_COUNT_ALERT,
    legacyName: 'sow_cycle_count',
    queue: QUEUE_NAMES.NOTIF_QUEUE,
    repeat: { every: 1 * DAY },
    priority: 5,
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
  },
  {
    name: JOB_NAMES.ONT_RATE_CARD_EXPIRY,
    legacyName: 'sow_rate_card_expiry',
    queue: QUEUE_NAMES.NOTIF_QUEUE,
    repeat: { every: 1 * DAY },
    priority: 5,
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
  },
  {
    name: JOB_NAMES.ONT_VEHICLE_MAINT_ALERT,
    legacyName: 'sow_vehicle_maint',
    queue: QUEUE_NAMES.NOTIF_QUEUE,
    repeat: { every: 12 * HOUR },
    priority: 4,
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
  },
  {
    name: JOB_NAMES.ONT_NCR_DEADLINE,
    legacyName: 'sow_ncr_deadline',
    queue: QUEUE_NAMES.NOTIF_QUEUE,
    repeat: { every: 1 * DAY },
    priority: 4,
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
  },
  {
    name: JOB_NAMES.ONT_CONTRACT_RENEWAL,
    legacyName: 'sow_contract_renewal',
    queue: QUEUE_NAMES.NOTIF_QUEUE,
    repeat: { every: 1 * DAY },
    priority: 5,
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
  },
  {
    name: JOB_NAMES.ONT_OVERDUE_TOOLS,
    legacyName: 'sow_overdue_tools',
    queue: QUEUE_NAMES.NOTIF_QUEUE,
    repeat: { every: 12 * HOUR },
    priority: 4,
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
  },
];

/** Lookup a job definition by its Oracle name. */
export function getJobDefinition(name: JobName): JobDefinition | undefined {
  return JOB_DEFINITIONS.find(j => j.name === name);
}

/** Get all job definitions for a specific queue. */
export function getJobsForQueue(queue: QueueName): JobDefinition[] {
  return JOB_DEFINITIONS.filter(j => j.queue === queue);
}
