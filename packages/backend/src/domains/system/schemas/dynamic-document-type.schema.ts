import { z } from 'zod';

// ── Status Flow Validation ──────────────────────────────────────────────

const statusEntrySchema = z.object({
  key: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  color: z.string().min(1).max(30),
});

/**
 * Zod schema for StatusFlowConfig validation.
 *
 * Validates:
 * - initialStatus must be a key in the statuses array
 * - All transition source keys must be in statuses
 * - All transition target keys must be in statuses
 * - At least one path from initialStatus reaches a terminal status
 *   (a status with no outgoing transitions), preventing fully circular flows
 */
export const statusFlowSchema = z
  .object({
    initialStatus: z.string().min(1).max(50),
    statuses: z.array(statusEntrySchema).min(1, 'At least one status is required'),
    transitions: z.record(z.string(), z.array(z.string())),
  })
  .refine(
    data => {
      const statusKeys = new Set(data.statuses.map(s => s.key));
      return statusKeys.has(data.initialStatus);
    },
    { message: 'initialStatus must be one of the defined status keys', path: ['initialStatus'] },
  )
  .refine(
    data => {
      const statusKeys = new Set(data.statuses.map(s => s.key));
      for (const sourceKey of Object.keys(data.transitions)) {
        if (!statusKeys.has(sourceKey)) return false;
      }
      return true;
    },
    { message: 'All transition source statuses must be defined in the statuses array', path: ['transitions'] },
  )
  .refine(
    data => {
      const statusKeys = new Set(data.statuses.map(s => s.key));
      for (const targets of Object.values(data.transitions)) {
        for (const target of targets) {
          if (!statusKeys.has(target)) return false;
        }
      }
      return true;
    },
    { message: 'All transition target statuses must be defined in the statuses array', path: ['transitions'] },
  )
  .refine(
    data => {
      // Detect circular transitions: ensure at least one path from initialStatus
      // reaches a terminal status (one with no outgoing transitions or not in transitions map).
      const transitions = data.transitions;

      // If there are no transitions at all, every status is terminal — valid.
      if (Object.keys(transitions).length === 0) return true;

      // DFS to find if any path from initialStatus reaches a terminal.
      function canReachTerminal(current: string, visited: Set<string>): boolean {
        // Terminal = not in transitions map OR has empty transitions array
        const targets = transitions[current];
        if (!targets || targets.length === 0) return true;

        for (const next of targets) {
          if (visited.has(next)) continue; // Skip cycles
          visited.add(next);
          if (canReachTerminal(next, visited)) return true;
        }
        return false;
      }

      return canReachTerminal(data.initialStatus, new Set([data.initialStatus]));
    },
    {
      message: 'Status flow contains circular transitions with no reachable terminal status',
      path: ['transitions'],
    },
  );

export type StatusFlowConfig = z.infer<typeof statusFlowSchema>;

// ── Document Type Schemas ───────────────────────────────────────────────

export const createDocumentTypeSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  icon: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  statusFlow: statusFlowSchema.optional(),
  approvalConfig: z.record(z.unknown()).optional(),
  permissionConfig: z.record(z.unknown()).optional(),
  settings: z.record(z.unknown()).optional(),
  visibleToRoles: z.array(z.string()).optional(),
});

export const updateDocumentTypeSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  icon: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  statusFlow: statusFlowSchema.optional(),
  approvalConfig: z.record(z.unknown()).optional(),
  permissionConfig: z.record(z.unknown()).optional(),
  settings: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
  visibleToRoles: z.array(z.string()).optional(),
});
