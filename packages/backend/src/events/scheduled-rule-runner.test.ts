import type { PrismaMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

const mockExecuteActions = vi.hoisted(() => vi.fn());
const mockLog = vi.hoisted(() => vi.fn());

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('./action-handlers.js', () => ({ executeActions: mockExecuteActions }));
vi.mock('../config/logger.js', () => ({ log: mockLog }));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { processScheduledRules, initializeScheduledRules } from './scheduled-rule-runner.js';

// ── Helpers ──────────────────────────────────────────────────────────────

function makeRule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rule-1',
    name: 'Test Rule',
    cronExpression: '*/5 * * * *',
    nextRunAt: new Date(Date.now() - 60_000), // in the past = due
    isActive: true,
    actions: [{ type: 'send_notification', params: { message: 'test' } }],
    workflow: { entityType: 'mrrv', isActive: true },
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('scheduled-rule-runner', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    mockExecuteActions.mockReset();
    mockLog.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-15T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── processScheduledRules ────────────────────────────────────────────

  describe('processScheduledRules', () => {
    it('returns early when no rules are due', async () => {
      mockPrisma.workflowRule.findMany.mockResolvedValue([]);

      await processScheduledRules();

      expect(mockPrisma.workflowRule.findMany).toHaveBeenCalledOnce();
      expect(mockExecuteActions).not.toHaveBeenCalled();
      expect(mockPrisma.workflowExecutionLog.create).not.toHaveBeenCalled();
      expect(mockLog).not.toHaveBeenCalled();
    });

    it('skips rules where workflow.isActive=false', async () => {
      const rule = makeRule({ workflow: { entityType: 'mrrv', isActive: false } });
      mockPrisma.workflowRule.findMany.mockResolvedValue([rule]);

      await processScheduledRules();

      expect(mockExecuteActions).not.toHaveBeenCalled();
      // No execution log should be created for skipped rules
      expect(mockPrisma.workflowExecutionLog.create).not.toHaveBeenCalled();
    });

    it('executes actions for due rules', async () => {
      const rule = makeRule({
        actions: [
          { type: 'send_notification', params: { message: 'hello' } },
          { type: 'send_email', params: { to: 'test@example.com' } },
        ],
      });
      mockPrisma.workflowRule.findMany.mockResolvedValue([rule]);
      mockExecuteActions.mockResolvedValue(undefined);
      mockPrisma.workflowExecutionLog.create.mockResolvedValue({});
      mockPrisma.workflowRule.update.mockResolvedValue({});

      await processScheduledRules();

      expect(mockExecuteActions).toHaveBeenCalledTimes(2);
      expect(mockExecuteActions).toHaveBeenCalledWith(
        'send_notification',
        { message: 'hello' },
        expect.objectContaining({
          type: 'scheduled:rule_triggered',
          entityType: 'mrrv',
          entityId: 'rule-1',
          action: 'scheduled_execution',
        }),
      );
      expect(mockExecuteActions).toHaveBeenCalledWith(
        'send_email',
        { to: 'test@example.com' },
        expect.objectContaining({ type: 'scheduled:rule_triggered' }),
      );
    });

    it('creates execution log with success=true when all actions succeed', async () => {
      const rule = makeRule();
      mockPrisma.workflowRule.findMany.mockResolvedValue([rule]);
      mockExecuteActions.mockResolvedValue(undefined);
      mockPrisma.workflowExecutionLog.create.mockResolvedValue({});
      mockPrisma.workflowRule.update.mockResolvedValue({});

      await processScheduledRules();

      expect(mockPrisma.workflowExecutionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ruleId: 'rule-1',
          eventType: 'scheduled:rule_triggered',
          entityType: 'mrrv',
          entityId: 'rule-1',
          matched: true,
          success: true,
          error: undefined,
          actionsRun: [{ type: 'send_notification', status: 'success' }],
        }),
      });
    });

    it('creates execution log with success=false when an action fails', async () => {
      const rule = makeRule();
      mockPrisma.workflowRule.findMany.mockResolvedValue([rule]);
      mockExecuteActions.mockRejectedValue(new Error('Notification service down'));
      mockPrisma.workflowExecutionLog.create.mockResolvedValue({});
      mockPrisma.workflowRule.update.mockResolvedValue({});

      await processScheduledRules();

      expect(mockPrisma.workflowExecutionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ruleId: 'rule-1',
          success: false,
          actionsRun: [{ type: 'send_notification', status: 'failed', error: 'Notification service down' }],
        }),
      });
    });

    it('handles action errors without stopping other actions in same rule', async () => {
      const rule = makeRule({
        actions: [
          { type: 'send_notification', params: { message: 'test' } },
          { type: 'send_email', params: { to: 'a@b.com' } },
          { type: 'webhook', params: { url: 'https://example.com' } },
        ],
      });
      mockPrisma.workflowRule.findMany.mockResolvedValue([rule]);
      // First action fails, second succeeds, third fails
      mockExecuteActions
        .mockRejectedValueOnce(new Error('Notification failed'))
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Webhook failed'));
      mockPrisma.workflowExecutionLog.create.mockResolvedValue({});
      mockPrisma.workflowRule.update.mockResolvedValue({});

      await processScheduledRules();

      // All three actions should have been attempted
      expect(mockExecuteActions).toHaveBeenCalledTimes(3);

      // Per-action errors are logged
      expect(mockLog).toHaveBeenCalledWith(
        'error',
        expect.stringContaining('Action send_notification failed for rule rule-1'),
      );
      expect(mockLog).toHaveBeenCalledWith('error', expect.stringContaining('Action webhook failed for rule rule-1'));

      // Overall success is false because not all actions succeeded
      expect(mockPrisma.workflowExecutionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          success: false,
          actionsRun: [
            { type: 'send_notification', status: 'failed', error: 'Notification failed' },
            { type: 'send_email', status: 'success' },
            { type: 'webhook', status: 'failed', error: 'Webhook failed' },
          ],
        }),
      });
    });

    it('handles execution log creation failure gracefully', async () => {
      const rule = makeRule();
      mockPrisma.workflowRule.findMany.mockResolvedValue([rule]);
      mockExecuteActions.mockResolvedValue(undefined);
      mockPrisma.workflowExecutionLog.create.mockRejectedValue(new Error('DB write failed'));
      mockPrisma.workflowRule.update.mockResolvedValue({});

      // Should not throw
      await processScheduledRules();

      expect(mockLog).toHaveBeenCalledWith('error', expect.stringContaining('Failed to log execution'));
      // nextRunAt should still be updated even if logging fails
      expect(mockPrisma.workflowRule.update).toHaveBeenCalled();
    });

    it('handles nextRunAt update failure gracefully', async () => {
      const rule = makeRule();
      mockPrisma.workflowRule.findMany.mockResolvedValue([rule]);
      mockExecuteActions.mockResolvedValue(undefined);
      mockPrisma.workflowExecutionLog.create.mockResolvedValue({});
      mockPrisma.workflowRule.update.mockRejectedValue(new Error('Update failed'));

      // Should not throw
      await processScheduledRules();

      expect(mockLog).toHaveBeenCalledWith(
        'error',
        expect.stringContaining('Failed to update nextRunAt for rule rule-1'),
      );
    });

    it('updates nextRunAt after processing', async () => {
      // Use a cron expression that runs every 5 minutes: */5 * * * *
      // Current time is 2026-02-15T10:00:00.000Z, so next run = 10:05
      const rule = makeRule({ cronExpression: '*/5 * * * *' });
      mockPrisma.workflowRule.findMany.mockResolvedValue([rule]);
      mockExecuteActions.mockResolvedValue(undefined);
      mockPrisma.workflowExecutionLog.create.mockResolvedValue({});
      mockPrisma.workflowRule.update.mockResolvedValue({});

      await processScheduledRules();

      expect(mockPrisma.workflowRule.update).toHaveBeenCalledWith({
        where: { id: 'rule-1' },
        data: {
          nextRunAt: expect.any(Date),
        },
      });

      // Verify the next run time is the next 5-minute mark after "now"
      const updateCall = mockPrisma.workflowRule.update.mock.calls[0][0];
      const nextRun = updateCall.data.nextRunAt as Date;
      // cronMatches uses local time getters; next minute divisible by 5
      expect(nextRun.getMinutes() % 5).toBe(0);
      expect(nextRun.getSeconds()).toBe(0);
      expect(nextRun.getTime()).toBeGreaterThan(Date.now());
    });

    it('creates synthetic event with correct structure', async () => {
      const rule = makeRule({
        id: 'rule-42',
        name: 'My Scheduled Rule',
        cronExpression: '0 8 * * *',
        workflow: { entityType: 'mirv', isActive: true },
      });
      mockPrisma.workflowRule.findMany.mockResolvedValue([rule]);
      mockExecuteActions.mockResolvedValue(undefined);
      mockPrisma.workflowExecutionLog.create.mockResolvedValue({});
      mockPrisma.workflowRule.update.mockResolvedValue({});

      await processScheduledRules();

      const syntheticEvent = mockExecuteActions.mock.calls[0][2];
      expect(syntheticEvent).toEqual({
        type: 'scheduled:rule_triggered',
        entityType: 'mirv',
        entityId: 'rule-42',
        action: 'scheduled_execution',
        timestamp: '2026-02-15T10:00:00.000Z',
        payload: {
          ruleName: 'My Scheduled Rule',
          cronExpression: '0 8 * * *',
        },
      });
    });

    it('processes multiple due rules independently', async () => {
      const rule1 = makeRule({ id: 'rule-1', name: 'Rule 1' });
      const rule2 = makeRule({
        id: 'rule-2',
        name: 'Rule 2',
        actions: [{ type: 'webhook', params: { url: 'https://example.com' } }],
        workflow: { entityType: 'jobOrder', isActive: true },
      });
      mockPrisma.workflowRule.findMany.mockResolvedValue([rule1, rule2]);
      mockExecuteActions.mockResolvedValue(undefined);
      mockPrisma.workflowExecutionLog.create.mockResolvedValue({});
      mockPrisma.workflowRule.update.mockResolvedValue({});

      await processScheduledRules();

      expect(mockExecuteActions).toHaveBeenCalledTimes(2);
      expect(mockPrisma.workflowExecutionLog.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.workflowRule.update).toHaveBeenCalledTimes(2);
    });

    it('stringifies non-Error action exceptions', async () => {
      const rule = makeRule();
      mockPrisma.workflowRule.findMany.mockResolvedValue([rule]);
      mockExecuteActions.mockRejectedValue('string error');
      mockPrisma.workflowExecutionLog.create.mockResolvedValue({});
      mockPrisma.workflowRule.update.mockResolvedValue({});

      await processScheduledRules();

      expect(mockPrisma.workflowExecutionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actionsRun: [{ type: 'send_notification', status: 'failed', error: 'string error' }],
        }),
      });
    });

    it('passes correct findMany query to find due rules', async () => {
      mockPrisma.workflowRule.findMany.mockResolvedValue([]);

      await processScheduledRules();

      expect(mockPrisma.workflowRule.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          cronExpression: { not: null },
          nextRunAt: { lte: expect.any(Date) },
        },
        include: {
          workflow: { select: { entityType: true, isActive: true } },
        },
      });
    });
  });

  // ── initializeScheduledRules ─────────────────────────────────────────

  describe('initializeScheduledRules', () => {
    it('sets nextRunAt for rules that have null nextRunAt', async () => {
      const uninitializedRule = {
        id: 'rule-init-1',
        cronExpression: '0 */2 * * *', // every 2 hours
        isActive: true,
        nextRunAt: null,
      };
      mockPrisma.workflowRule.findMany.mockResolvedValue([uninitializedRule]);
      mockPrisma.workflowRule.update.mockResolvedValue({});

      await initializeScheduledRules();

      expect(mockPrisma.workflowRule.update).toHaveBeenCalledWith({
        where: { id: 'rule-init-1' },
        data: {
          nextRunAt: expect.any(Date),
        },
      });

      // Verify the computed nextRunAt is at an even hour (0 min, even hour)
      // cronMatches uses local-time getters (getMinutes, getHours), so assert with local time
      const updateCall = mockPrisma.workflowRule.update.mock.calls[0][0];
      const nextRun = updateCall.data.nextRunAt as Date;
      expect(nextRun.getMinutes()).toBe(0);
      expect(nextRun.getHours() % 2).toBe(0);
      // Should be in the future relative to "now"
      expect(nextRun.getTime()).toBeGreaterThan(Date.now());
    });

    it('skips rules without cronExpression (safety check in loop)', async () => {
      const ruleWithNullCron = {
        id: 'rule-null-cron',
        cronExpression: null,
        isActive: true,
        nextRunAt: null,
      };
      mockPrisma.workflowRule.findMany.mockResolvedValue([ruleWithNullCron]);

      await initializeScheduledRules();

      // The safety check `if (!rule.cronExpression) continue` prevents update
      expect(mockPrisma.workflowRule.update).not.toHaveBeenCalled();
    });

    it('does nothing when no uninitialized rules exist', async () => {
      mockPrisma.workflowRule.findMany.mockResolvedValue([]);

      await initializeScheduledRules();

      expect(mockPrisma.workflowRule.update).not.toHaveBeenCalled();
      // log should not be called when there are no rules to initialize
      expect(mockLog).not.toHaveBeenCalled();
    });

    it('logs count of initialized rules', async () => {
      const rules = [
        { id: 'rule-a', cronExpression: '*/10 * * * *', isActive: true, nextRunAt: null },
        { id: 'rule-b', cronExpression: '0 9 * * 1', isActive: true, nextRunAt: null },
        { id: 'rule-c', cronExpression: '30 14 * * *', isActive: true, nextRunAt: null },
      ];
      mockPrisma.workflowRule.findMany.mockResolvedValue(rules);
      mockPrisma.workflowRule.update.mockResolvedValue({});

      await initializeScheduledRules();

      expect(mockPrisma.workflowRule.update).toHaveBeenCalledTimes(3);
      expect(mockLog).toHaveBeenCalledWith('info', '[ScheduledRules] Initialized nextRunAt for 3 rule(s)');
    });

    it('queries for active rules with cron but no nextRunAt', async () => {
      mockPrisma.workflowRule.findMany.mockResolvedValue([]);

      await initializeScheduledRules();

      expect(mockPrisma.workflowRule.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          cronExpression: { not: null },
          nextRunAt: null,
        },
      });
    });
  });

  // ── Cron matching (indirectly via nextRunAt calculations) ─────────────

  describe('cron matching (indirect via nextRunAt)', () => {
    it('nextCronRun calculates next minute-aligned time for every-minute cron', async () => {
      // '* * * * *' matches every minute. Next run should be current time + 1 minute
      const now = new Date();
      const rule = makeRule({ cronExpression: '* * * * *' });
      mockPrisma.workflowRule.findMany.mockResolvedValue([rule]);
      mockExecuteActions.mockResolvedValue(undefined);
      mockPrisma.workflowExecutionLog.create.mockResolvedValue({});
      mockPrisma.workflowRule.update.mockResolvedValue({});

      await processScheduledRules();

      const updateCall = mockPrisma.workflowRule.update.mock.calls[0][0];
      const nextRun = updateCall.data.nextRunAt as Date;
      // Should be exactly 1 minute after current time (seconds/ms zeroed)
      expect(nextRun.getMinutes()).toBe((now.getMinutes() + 1) % 60);
      expect(nextRun.getSeconds()).toBe(0);
      expect(nextRun.getMilliseconds()).toBe(0);
    });

    it('nextCronRun handles specific-minute cron expression', async () => {
      // '30 * * * *' runs at minute 30 of every hour
      const rule = makeRule({ cronExpression: '30 * * * *' });
      mockPrisma.workflowRule.findMany.mockResolvedValue([rule]);
      mockExecuteActions.mockResolvedValue(undefined);
      mockPrisma.workflowExecutionLog.create.mockResolvedValue({});
      mockPrisma.workflowRule.update.mockResolvedValue({});

      await processScheduledRules();

      const updateCall = mockPrisma.workflowRule.update.mock.calls[0][0];
      const nextRun = updateCall.data.nextRunAt as Date;
      // cronMatches uses local time getters
      expect(nextRun.getMinutes()).toBe(30);
    });

    it('nextCronRun handles specific hour and minute', async () => {
      // Use a cron expression for a specific hour that's definitely in the future (local time).
      // Current local hour from fake time: new Date().getHours()
      const now = new Date();
      const futureHour = (now.getHours() + 4) % 24;
      const cronExpr = `0 ${futureHour} * * *`;
      const rule = makeRule({ cronExpression: cronExpr });
      mockPrisma.workflowRule.findMany.mockResolvedValue([rule]);
      mockExecuteActions.mockResolvedValue(undefined);
      mockPrisma.workflowExecutionLog.create.mockResolvedValue({});
      mockPrisma.workflowRule.update.mockResolvedValue({});

      await processScheduledRules();

      const updateCall = mockPrisma.workflowRule.update.mock.calls[0][0];
      const nextRun = updateCall.data.nextRunAt as Date;
      // cronMatches uses local time getters
      expect(nextRun.getHours()).toBe(futureHour);
      expect(nextRun.getMinutes()).toBe(0);
    });

    it('nextCronRun handles step expression in minutes', async () => {
      // '*/15 * * * *' = every 15 minutes (0, 15, 30, 45)
      const rule = makeRule({ cronExpression: '*/15 * * * *' });
      mockPrisma.workflowRule.findMany.mockResolvedValue([rule]);
      mockExecuteActions.mockResolvedValue(undefined);
      mockPrisma.workflowExecutionLog.create.mockResolvedValue({});
      mockPrisma.workflowRule.update.mockResolvedValue({});

      await processScheduledRules();

      const updateCall = mockPrisma.workflowRule.update.mock.calls[0][0];
      const nextRun = updateCall.data.nextRunAt as Date;
      // Next minute divisible by 15 after now+1min
      expect(nextRun.getMinutes() % 15).toBe(0);
      expect(nextRun.getTime()).toBeGreaterThan(Date.now());
    });

    it('nextCronRun handles comma-separated values', async () => {
      // '0,30 * * * *' = at minute 0 and minute 30
      // Scanning starts at now+1min, so next match is the first of 0 or 30
      // that occurs after the current minute
      const rule = makeRule({ cronExpression: '0,30 * * * *' });
      mockPrisma.workflowRule.findMany.mockResolvedValue([rule]);
      mockExecuteActions.mockResolvedValue(undefined);
      mockPrisma.workflowExecutionLog.create.mockResolvedValue({});
      mockPrisma.workflowRule.update.mockResolvedValue({});

      await processScheduledRules();

      const updateCall = mockPrisma.workflowRule.update.mock.calls[0][0];
      const nextRun = updateCall.data.nextRunAt as Date;
      // Should be either minute 0 or minute 30
      expect([0, 30]).toContain(nextRun.getMinutes());
      expect(nextRun.getTime()).toBeGreaterThan(Date.now());
    });

    it('nextCronRun handles range expression', async () => {
      // Build a range around hours that are definitely in the future (local time).
      const now = new Date();
      const startHour = (now.getHours() + 1) % 24;
      const endHour = (startHour + 4) % 24;
      // Only test when range doesn't wrap around midnight for simplicity
      const cronExpr = startHour < endHour ? `0 ${startHour}-${endHour} * * *` : `0 ${startHour} * * *`; // fallback to single hour
      const rule = makeRule({ cronExpression: cronExpr });
      mockPrisma.workflowRule.findMany.mockResolvedValue([rule]);
      mockExecuteActions.mockResolvedValue(undefined);
      mockPrisma.workflowExecutionLog.create.mockResolvedValue({});
      mockPrisma.workflowRule.update.mockResolvedValue({});

      await processScheduledRules();

      const updateCall = mockPrisma.workflowRule.update.mock.calls[0][0];
      const nextRun = updateCall.data.nextRunAt as Date;
      // Should match the start of the range (first eligible hour, minute 0)
      expect(nextRun.getHours()).toBe(startHour);
      expect(nextRun.getMinutes()).toBe(0);
    });
  });
});
