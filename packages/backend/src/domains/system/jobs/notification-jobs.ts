/**
 * Notification Jobs — SOW N-xx notification checks.
 *
 * Self-registers all SOW notification-related scheduled jobs:
 * N-03: Equipment return date approaching
 * N-05: Shipment delayed
 * N-08: Cycle count scheduled
 * N-09: Rate card expiring
 * N-10: Vehicle maintenance due
 * N-12: NCR/DR deadline approaching
 * N-13: Contract/insurance renewal due
 * N-14: Overdue tool return
 */

import { registerJob } from '../../../utils/job-registry.js';
import type { JobContext } from '../../../utils/job-registry.js';
import {
  checkEquipmentReturnDue,
  checkShipmentDelays,
  checkScheduledCycleCounts,
  checkRateCardExpiry,
  checkVehicleMaintenanceDue,
  checkNcrDeadlines,
  checkContractRenewals,
  checkOverdueToolReturns,
} from '../../../services/notification-dispatcher.service.js';

// ── Register Jobs ────────────────────────────────────────────────────────

// N-03: Equipment return date approaching — daily (lock: 23 hours)
registerJob({
  name: 'sow_equipment_return',
  intervalMs: 24 * 60 * 60 * 1000,
  lockTtlSec: 82800,
  handler: async (_ctx: JobContext) => {
    await checkEquipmentReturnDue();
  },
});

// N-05: Shipment delayed — every 6 hours (lock: 5 hours)
registerJob({
  name: 'sow_shipment_delays',
  intervalMs: 6 * 60 * 60 * 1000,
  lockTtlSec: 18000,
  handler: async (_ctx: JobContext) => {
    await checkShipmentDelays();
  },
});

// N-08: Cycle count scheduled — daily (lock: 23 hours)
registerJob({
  name: 'sow_cycle_count',
  intervalMs: 24 * 60 * 60 * 1000,
  lockTtlSec: 82800,
  handler: async (_ctx: JobContext) => {
    await checkScheduledCycleCounts();
  },
});

// N-09: Rate card expiring — daily (lock: 23 hours)
registerJob({
  name: 'sow_rate_card_expiry',
  intervalMs: 24 * 60 * 60 * 1000,
  lockTtlSec: 82800,
  handler: async (_ctx: JobContext) => {
    await checkRateCardExpiry();
  },
});

// N-10: Vehicle maintenance due — every 12 hours (lock: 11 hours)
registerJob({
  name: 'sow_vehicle_maint',
  intervalMs: 12 * 60 * 60 * 1000,
  lockTtlSec: 39600,
  handler: async (_ctx: JobContext) => {
    await checkVehicleMaintenanceDue();
  },
});

// N-12: NCR/DR deadline approaching — daily (lock: 23 hours)
registerJob({
  name: 'sow_ncr_deadline',
  intervalMs: 24 * 60 * 60 * 1000,
  lockTtlSec: 82800,
  handler: async (_ctx: JobContext) => {
    await checkNcrDeadlines();
  },
});

// N-13: Contract/insurance renewal due — daily (lock: 23 hours)
registerJob({
  name: 'sow_contract_renewal',
  intervalMs: 24 * 60 * 60 * 1000,
  lockTtlSec: 82800,
  handler: async (_ctx: JobContext) => {
    await checkContractRenewals();
  },
});

// N-14: Overdue tool return — every 12 hours (lock: 11 hours)
registerJob({
  name: 'sow_overdue_tools',
  intervalMs: 12 * 60 * 60 * 1000,
  lockTtlSec: 39600,
  handler: async (_ctx: JobContext) => {
    await checkOverdueToolReturns();
  },
});
