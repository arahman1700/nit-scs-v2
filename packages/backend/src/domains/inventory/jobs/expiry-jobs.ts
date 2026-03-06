/**
 * Expiry Jobs — L2 expiry date alerts and auto-quarantine.
 *
 * Self-registers two jobs:
 * - expiry_alerts: daily (lock: 2 hours) — checkExpiringLots
 * - expiry_quarantine: every 12 hours (lock: ~83 min) — autoQuarantineExpired
 */

import { registerJob } from '../../../utils/job-registry.js';
import type { JobContext } from '../../../utils/job-registry.js';
import { checkExpiringLots, autoQuarantineExpired } from '../services/expiry-alert.service.js';

// L2: Expiry date alerts — daily (lock: 2 hours)
registerJob({
  name: 'expiry_alerts',
  intervalMs: 24 * 60 * 60 * 1000,
  lockTtlSec: 7200,
  handler: async (_ctx: JobContext) => {
    await checkExpiringLots();
  },
});

// L2: Auto-quarantine expired lots — every 12 hours (lock: ~83 min)
registerJob({
  name: 'expiry_quarantine',
  intervalMs: 12 * 60 * 60 * 1000,
  lockTtlSec: 5000,
  handler: async (_ctx: JobContext) => {
    await autoQuarantineExpired();
  },
});
