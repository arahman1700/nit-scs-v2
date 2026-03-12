/**
 * Queue Dashboard — Bull Board Integration
 *
 * Provides an admin UI at /admin/queues for monitoring BullMQ jobs.
 * Protected by authentication + admin role check.
 */

import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { getAllQueues, getDeadLetterQueue } from './bullmq.config.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import type { Express } from 'express';

/**
 * Mount the Bull Board dashboard on the Express app.
 * Only accessible by authenticated admin users.
 */
export function mountQueueDashboard(app: Express): void {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  const allQueues = getAllQueues();
  const dlq = getDeadLetterQueue();

  createBullBoard({
    queues: [...allQueues.map(q => new BullMQAdapter(q)), new BullMQAdapter(dlq)],
    serverAdapter,
  });

  // Auth middleware: admin only
  app.use('/admin/queues', authenticate, requireRole('admin'), serverAdapter.getRouter());
}
