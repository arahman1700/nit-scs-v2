/**
 * Job Definitions Tests
 *
 * Validates Oracle-compatible job naming, queue assignments,
 * legacy name mapping, and job definition completeness.
 */
import { describe, it, expect } from 'vitest';
import {
  JOB_NAMES,
  JOB_DEFINITIONS,
  JOB_LEGACY_MAP,
  getJobDefinition,
  getJobsForQueue,
  type JobName,
} from './job-definitions.js';
import { QUEUE_NAMES } from './bullmq.config.js';

describe('job-definitions', () => {
  describe('JOB_NAMES', () => {
    it('should follow Oracle naming convention: {MODULE}_{ENTITY}_{ACTION}', () => {
      const validPrefixes = ['SCM_', 'INV_', 'HR_', 'EAM_', 'ONT_', 'WMS_'];

      for (const [key, value] of Object.entries(JOB_NAMES)) {
        expect(key).toBe(value); // Key equals value
        const hasValidPrefix = validPrefixes.some(p => value.startsWith(p));
        expect(hasValidPrefix, `${value} should start with an Oracle module prefix`).toBe(true);
      }
    });

    it('should have all names in UPPER_SNAKE_CASE', () => {
      for (const value of Object.values(JOB_NAMES)) {
        expect(value).toMatch(/^[A-Z][A-Z0-9_]+$/);
      }
    });
  });

  describe('JOB_LEGACY_MAP', () => {
    it('should map every JOB_NAME to a legacy name', () => {
      for (const jobName of Object.values(JOB_NAMES)) {
        expect(JOB_LEGACY_MAP[jobName as JobName], `${jobName} should have a legacy mapping`).toBeDefined();
      }
    });

    it('should have unique legacy names (no duplicates)', () => {
      const legacyNames = Object.values(JOB_LEGACY_MAP);
      const uniqueNames = new Set(legacyNames);
      expect(uniqueNames.size).toBe(legacyNames.length);
    });
  });

  describe('JOB_DEFINITIONS', () => {
    it('should have a definition for every JOB_NAME', () => {
      const definedNames = new Set(JOB_DEFINITIONS.map(j => j.name));
      for (const jobName of Object.values(JOB_NAMES)) {
        expect(definedNames.has(jobName as JobName), `Missing definition for ${jobName}`).toBe(true);
      }
    });

    it('should assign each job to a valid queue', () => {
      const validQueues = new Set(Object.values(QUEUE_NAMES));
      for (const def of JOB_DEFINITIONS) {
        expect(validQueues.has(def.queue), `${def.name} assigned to unknown queue: ${def.queue}`).toBe(true);
        expect(def.queue).not.toBe(QUEUE_NAMES.DLQ); // Jobs should never be assigned to DLQ
      }
    });

    it('should assign jobs to Oracle WMS-appropriate queues', () => {
      for (const def of JOB_DEFINITIONS) {
        if (def.name.startsWith('INV_')) expect(def.queue).toBe(QUEUE_NAMES.INV_QUEUE);
        if (def.name.startsWith('SCM_')) expect(def.queue).toBe(QUEUE_NAMES.WMS_QUEUE);
        if (def.name.startsWith('HR_')) expect(def.queue).toBe(QUEUE_NAMES.AUD_QUEUE);
        if (def.name.startsWith('EAM_')) expect(def.queue).toBe(QUEUE_NAMES.WMS_QUEUE);
        if (def.name.startsWith('ONT_')) expect(def.queue).toBe(QUEUE_NAMES.NOTIF_QUEUE);
      }
    });

    it('should have valid priority values (1–99, Oracle convention)', () => {
      for (const def of JOB_DEFINITIONS) {
        expect(def.priority).toBeGreaterThanOrEqual(1);
        expect(def.priority).toBeLessThanOrEqual(99);
      }
    });

    it('should have at least 1 retry attempt', () => {
      for (const def of JOB_DEFINITIONS) {
        expect(def.attempts).toBeGreaterThanOrEqual(1);
      }
    });

    it('should have a valid backoff configuration', () => {
      for (const def of JOB_DEFINITIONS) {
        expect(['exponential', 'fixed']).toContain(def.backoff.type);
        expect(def.backoff.delay).toBeGreaterThan(0);
      }
    });

    it('should have positive repeat intervals', () => {
      for (const def of JOB_DEFINITIONS) {
        if ('every' in def.repeat) {
          expect(def.repeat.every).toBeGreaterThan(0);
        }
      }
    });

    it('should match legacyName to JOB_LEGACY_MAP', () => {
      for (const def of JOB_DEFINITIONS) {
        expect(def.legacyName).toBe(JOB_LEGACY_MAP[def.name]);
      }
    });
  });

  describe('getJobDefinition', () => {
    it('should return the definition for a known job', () => {
      const def = getJobDefinition('SCM_SLA_BREACH_CHECK');
      expect(def).toBeDefined();
      expect(def!.name).toBe('SCM_SLA_BREACH_CHECK');
      expect(def!.queue).toBe(QUEUE_NAMES.WMS_QUEUE);
    });

    it('should return undefined for an unknown job', () => {
      const def = getJobDefinition('UNKNOWN_JOB' as JobName);
      expect(def).toBeUndefined();
    });
  });

  describe('getJobsForQueue', () => {
    it('should return jobs for a specific queue', () => {
      const invJobs = getJobsForQueue(QUEUE_NAMES.INV_QUEUE);
      expect(invJobs.length).toBeGreaterThan(0);
      for (const j of invJobs) {
        expect(j.queue).toBe(QUEUE_NAMES.INV_QUEUE);
      }
    });

    it('should return empty for a queue with no jobs', () => {
      const dlqJobs = getJobsForQueue(QUEUE_NAMES.DLQ);
      expect(dlqJobs).toHaveLength(0);
    });
  });
});
