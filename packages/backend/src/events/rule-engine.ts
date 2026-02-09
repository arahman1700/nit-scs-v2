import { eventBus, type SystemEvent } from './event-bus.js';
import { getActiveRules } from './rule-cache.js';
import { executeActions } from './action-handlers.js';
import { prisma } from '../utils/prisma.js';
import { log } from '../config/logger.js';

// ── Condition Types ─────────────────────────────────────────────────────

interface LeafCondition {
  field: string;
  op: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: unknown;
}

interface GroupCondition {
  operator: 'AND' | 'OR';
  conditions: Condition[];
}

type Condition = LeafCondition | GroupCondition;

// ── Condition Evaluator ─────────────────────────────────────────────────

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function evaluateLeaf(condition: LeafCondition, event: SystemEvent): boolean {
  const fieldValue = getNestedValue(event as unknown as Record<string, unknown>, condition.field);
  const target = condition.value;

  switch (condition.op) {
    case 'eq':
      return fieldValue === target || String(fieldValue) === String(target);
    case 'ne':
      return fieldValue !== target && String(fieldValue) !== String(target);
    case 'gt':
      return Number(fieldValue) > Number(target);
    case 'gte':
      return Number(fieldValue) >= Number(target);
    case 'lt':
      return Number(fieldValue) < Number(target);
    case 'lte':
      return Number(fieldValue) <= Number(target);
    case 'in':
      if (Array.isArray(target)) return target.includes(fieldValue);
      return false;
    case 'contains':
      return (
        typeof fieldValue === 'string' &&
        typeof target === 'string' &&
        fieldValue.toLowerCase().includes(target.toLowerCase())
      );
    default:
      return false;
  }
}

function isGroupCondition(c: Condition): c is GroupCondition {
  return 'operator' in c && 'conditions' in c;
}

function evaluateCondition(condition: Condition, event: SystemEvent): boolean {
  if (isGroupCondition(condition)) {
    if (!condition.conditions || condition.conditions.length === 0) return true;
    if (condition.operator === 'AND') {
      return condition.conditions.every(c => evaluateCondition(c, event));
    }
    return condition.conditions.some(c => evaluateCondition(c, event));
  }
  return evaluateLeaf(condition, event);
}

// ── Rule Processing ─────────────────────────────────────────────────────

async function processEvent(event: SystemEvent): Promise<void> {
  const rules = await getActiveRules();

  // Filter rules: match by triggerEvent and entityType (or wildcard)
  const matching = rules.filter(rule => {
    if (rule.triggerEvent !== event.type && rule.triggerEvent !== '*') return false;
    if (rule.workflow.entityType !== event.entityType && rule.workflow.entityType !== '*') return false;
    return true;
  });

  if (matching.length === 0) return;

  log('debug', `[RuleEngine] ${matching.length} rules to evaluate for ${event.type}/${event.entityType}`);

  for (const rule of matching) {
    let matched = false;
    let success = false;
    let error: string | undefined;
    const actionsRun: unknown[] = [];

    try {
      // Evaluate conditions
      const conditions = rule.conditions as Condition;
      matched = evaluateCondition(conditions, event);

      if (matched) {
        // Execute all actions
        const actions = rule.actions as Array<{ type: string; params: Record<string, unknown> }>;
        for (const action of actions) {
          try {
            await executeActions(action.type, action.params, event);
            actionsRun.push({ type: action.type, status: 'success' });
          } catch (actionErr) {
            const msg = actionErr instanceof Error ? actionErr.message : String(actionErr);
            actionsRun.push({ type: action.type, status: 'failed', error: msg });
            log('error', `[RuleEngine] Action ${action.type} failed for rule ${rule.id}: ${msg}`);
          }
        }
        success = actionsRun.every((a: unknown) => (a as { status: string }).status === 'success');
      }
    } catch (evalErr) {
      error = evalErr instanceof Error ? evalErr.message : String(evalErr);
      log('error', `[RuleEngine] Rule ${rule.id} evaluation error: ${error}`);
    }

    // Log execution
    try {
      await prisma.workflowExecutionLog.create({
        data: {
          ruleId: rule.id,
          eventType: event.type,
          entityType: event.entityType,
          entityId: event.entityId,
          matched,
          success,
          error,
          eventData: JSON.parse(JSON.stringify(event)),
          actionsRun: actionsRun.length > 0 ? JSON.parse(JSON.stringify(actionsRun)) : undefined,
        },
      });
    } catch (logErr) {
      log('error', `[RuleEngine] Failed to log execution: ${logErr}`);
    }

    // Stop processing further rules if this one matched and stopOnMatch is true
    if (matched && rule.stopOnMatch) {
      log('debug', `[RuleEngine] Stop-on-match triggered by rule ${rule.id}`);
      break;
    }
  }
}

// ── Start / Stop ────────────────────────────────────────────────────────

let started = false;

export function startRuleEngine(): void {
  if (started) return;
  started = true;
  eventBus.on('*', (event: SystemEvent) => {
    // Process async — don't block the event emitter
    processEvent(event).catch(err => {
      log('error', `[RuleEngine] Unhandled error: ${err}`);
    });
  });
  log('info', '[RuleEngine] Started — listening for events');
}

export function stopRuleEngine(): void {
  eventBus.removeAllListeners('*');
  started = false;
  log('info', '[RuleEngine] Stopped');
}
