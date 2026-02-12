/**
 * Scheduled Rule Runner
 *
 * Evaluates WorkflowRules that have `cronExpression` set.
 * Runs every 60 seconds, checks which rules are due, executes them,
 * and updates `nextRunAt`.
 *
 * Uses simple cron matching (not full cron parser) to avoid external deps.
 */
import { prisma } from '../utils/prisma.js';
import { executeActions } from './action-handlers.js';
import { log } from '../config/logger.js';
import type { SystemEvent } from './event-bus.js';

// ── Simple Cron Matcher ──────────────────────────────────────────────

/**
 * Parse a standard 5-part cron expression and check if `date` matches.
 * Format: minute hour dayOfMonth month dayOfWeek
 * Supports: numbers, '*', ',' (lists), '/' (steps)
 */
function cronMatches(expression: string, date: Date): boolean {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const fields = [
    date.getMinutes(), // 0-59
    date.getHours(), // 0-23
    date.getDate(), // 1-31
    date.getMonth() + 1, // 1-12
    date.getDay(), // 0-6 (Sunday = 0)
  ];

  for (let i = 0; i < 5; i++) {
    if (!fieldMatches(parts[i], fields[i])) return false;
  }
  return true;
}

function fieldMatches(pattern: string, value: number): boolean {
  if (pattern === '*') return true;

  // Handle comma-separated values
  if (pattern.includes(',')) {
    return pattern.split(',').some(p => fieldMatches(p.trim(), value));
  }

  // Handle step: */n or m-n/s
  if (pattern.includes('/')) {
    const [range, stepStr] = pattern.split('/');
    const step = parseInt(stepStr, 10);
    if (isNaN(step) || step <= 0) return false;

    if (range === '*') {
      return value % step === 0;
    }

    if (range.includes('-')) {
      const [min, max] = range.split('-').map(Number);
      return value >= min && value <= max && (value - min) % step === 0;
    }

    return value % step === 0;
  }

  // Handle range: m-n
  if (pattern.includes('-')) {
    const [min, max] = pattern.split('-').map(Number);
    return value >= min && value <= max;
  }

  // Direct number match
  return parseInt(pattern, 10) === value;
}

/**
 * Calculate the next run time from a cron expression.
 * Scans forward minute by minute (max 1440 attempts = 24 hours).
 */
function nextCronRun(expression: string, after: Date): Date {
  const candidate = new Date(after);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1); // Start from next minute

  for (let i = 0; i < 1440; i++) {
    if (cronMatches(expression, candidate)) return candidate;
    candidate.setMinutes(candidate.getMinutes() + 1);
  }

  // Fallback: 1 hour from now
  return new Date(after.getTime() + 60 * 60 * 1000);
}

// ── Scheduled Rule Processor ─────────────────────────────────────────

async function processScheduledRules(): Promise<void> {
  const now = new Date();

  // Find rules that are due to run
  const dueRules = await prisma.workflowRule.findMany({
    where: {
      isActive: true,
      cronExpression: { not: null },
      nextRunAt: { lte: now },
    },
    include: {
      workflow: { select: { entityType: true, isActive: true } },
    },
  });

  if (dueRules.length === 0) return;

  log('debug', `[ScheduledRules] ${dueRules.length} rule(s) due for execution`);

  for (const rule of dueRules) {
    if (!rule.workflow.isActive) continue;

    // Create a synthetic event for the rule
    const syntheticEvent: SystemEvent = {
      type: 'scheduled:rule_triggered',
      entityType: rule.workflow.entityType,
      entityId: rule.id,
      action: 'scheduled_execution',
      timestamp: now.toISOString(),
      payload: { ruleName: rule.name, cronExpression: rule.cronExpression },
    };

    let success = false;
    let error: string | undefined;
    const actionsRun: unknown[] = [];

    try {
      const actions = rule.actions as Array<{ type: string; params: Record<string, unknown> }>;
      for (const action of actions) {
        try {
          await executeActions(action.type, action.params, syntheticEvent);
          actionsRun.push({ type: action.type, status: 'success' });
        } catch (actionErr) {
          const msg = actionErr instanceof Error ? actionErr.message : String(actionErr);
          actionsRun.push({ type: action.type, status: 'failed', error: msg });
          log('error', `[ScheduledRules] Action ${action.type} failed for rule ${rule.id}: ${msg}`);
        }
      }
      success = actionsRun.every((a: unknown) => (a as { status: string }).status === 'success');
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      log('error', `[ScheduledRules] Rule ${rule.id} failed: ${error}`);
    }

    // Log execution
    try {
      await prisma.workflowExecutionLog.create({
        data: {
          ruleId: rule.id,
          eventType: 'scheduled:rule_triggered',
          entityType: rule.workflow.entityType,
          entityId: rule.id,
          matched: true,
          success,
          error,
          eventData: JSON.parse(JSON.stringify(syntheticEvent)),
          actionsRun: actionsRun.length > 0 ? JSON.parse(JSON.stringify(actionsRun)) : undefined,
        },
      });
    } catch (logErr) {
      log('error', `[ScheduledRules] Failed to log execution: ${logErr}`);
    }

    // Update nextRunAt
    try {
      const nextRun = nextCronRun(rule.cronExpression!, now);
      await prisma.workflowRule.update({
        where: { id: rule.id },
        data: { nextRunAt: nextRun },
      });
    } catch (updateErr) {
      log('error', `[ScheduledRules] Failed to update nextRunAt for rule ${rule.id}: ${updateErr}`);
    }
  }
}

/**
 * Initialize nextRunAt for all scheduled rules that don't have one set.
 */
export async function initializeScheduledRules(): Promise<void> {
  const rules = await prisma.workflowRule.findMany({
    where: {
      isActive: true,
      cronExpression: { not: null },
      nextRunAt: null,
    },
  });

  const now = new Date();
  for (const rule of rules) {
    if (!rule.cronExpression) continue;
    const nextRun = nextCronRun(rule.cronExpression, now);
    await prisma.workflowRule.update({
      where: { id: rule.id },
      data: { nextRunAt: nextRun },
    });
  }

  if (rules.length > 0) {
    log('info', `[ScheduledRules] Initialized nextRunAt for ${rules.length} rule(s)`);
  }
}

export { processScheduledRules };
