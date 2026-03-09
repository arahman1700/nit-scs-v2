import { registerJob, getAllJobs, clearJobs, type ScheduledJob, type JobContext } from './job-registry.js';

describe('job-registry', () => {
  beforeEach(() => {
    clearJobs();
  });

  const createMockJob = (name: string, intervalMs = 60000): ScheduledJob => ({
    name,
    intervalMs,
    lockTtlSec: 30,
    handler: vi.fn().mockResolvedValue(undefined),
  });

  // ---------------------------------------------------------------------------
  // registerJob
  // ---------------------------------------------------------------------------
  describe('registerJob', () => {
    it('should register a single job', () => {
      const job = createMockJob('test-job');

      registerJob(job);

      expect(getAllJobs()).toHaveLength(1);
      expect(getAllJobs()[0].name).toBe('test-job');
    });

    it('should register multiple jobs', () => {
      registerJob(createMockJob('job-1'));
      registerJob(createMockJob('job-2'));
      registerJob(createMockJob('job-3'));

      expect(getAllJobs()).toHaveLength(3);
    });

    it('should preserve job properties', () => {
      const job: ScheduledJob = {
        name: 'sla-check',
        intervalMs: 300000,
        lockTtlSec: 120,
        handler: vi.fn(),
      };

      registerJob(job);

      const registered = getAllJobs()[0];
      expect(registered.name).toBe('sla-check');
      expect(registered.intervalMs).toBe(300000);
      expect(registered.lockTtlSec).toBe(120);
      expect(registered.handler).toBe(job.handler);
    });

    it('should allow registering jobs with the same name (no dedup)', () => {
      registerJob(createMockJob('dup'));
      registerJob(createMockJob('dup'));

      expect(getAllJobs()).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------------------
  // getAllJobs
  // ---------------------------------------------------------------------------
  describe('getAllJobs', () => {
    it('should return an empty array when no jobs registered', () => {
      expect(getAllJobs()).toEqual([]);
    });

    it('should return a copy (defensive copy)', () => {
      registerJob(createMockJob('job-1'));

      const jobs1 = getAllJobs();
      const jobs2 = getAllJobs();

      // Should be different array references
      expect(jobs1).not.toBe(jobs2);
      // But same content
      expect(jobs1).toEqual(jobs2);
    });

    it('should not allow external mutation of the registry', () => {
      registerJob(createMockJob('job-1'));

      const jobs = getAllJobs();
      jobs.push(createMockJob('job-2'));

      // Original registry should still have 1 job
      expect(getAllJobs()).toHaveLength(1);
    });

    it('should return jobs in registration order', () => {
      registerJob(createMockJob('alpha'));
      registerJob(createMockJob('beta'));
      registerJob(createMockJob('gamma'));

      const names = getAllJobs().map(j => j.name);
      expect(names).toEqual(['alpha', 'beta', 'gamma']);
    });
  });

  // ---------------------------------------------------------------------------
  // clearJobs
  // ---------------------------------------------------------------------------
  describe('clearJobs', () => {
    it('should remove all registered jobs', () => {
      registerJob(createMockJob('job-1'));
      registerJob(createMockJob('job-2'));
      expect(getAllJobs()).toHaveLength(2);

      clearJobs();

      expect(getAllJobs()).toHaveLength(0);
    });

    it('should allow re-registration after clearing', () => {
      registerJob(createMockJob('old-job'));
      clearJobs();
      registerJob(createMockJob('new-job'));

      expect(getAllJobs()).toHaveLength(1);
      expect(getAllJobs()[0].name).toBe('new-job');
    });

    it('should be idempotent (safe to call on empty registry)', () => {
      clearJobs();
      clearJobs();

      expect(getAllJobs()).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // ScheduledJob interface
  // ---------------------------------------------------------------------------
  describe('ScheduledJob handler', () => {
    it('should accept a handler that receives JobContext', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const job = createMockJob('ctx-test');
      job.handler = handler;

      registerJob(job);

      const mockContext = {
        prisma: {} as any,
        io: null,
        log: vi.fn(),
        notifySla: vi.fn(),
        getAdminIds: vi.fn(),
        getEmployeeIdsByRole: vi.fn(),
        getRecentNotificationRefs: vi.fn(),
        hasRecentNotification: vi.fn(),
        refreshSlaConfig: vi.fn(),
        getDelegate: vi.fn(),
        slaHoursToMs: vi.fn(),
        _computeSlaDeadline: vi.fn(),
        getSlaConfig: vi.fn(),
        createNotification: vi.fn(),
      } as unknown as JobContext;

      await getAllJobs()[0].handler(mockContext);

      expect(handler).toHaveBeenCalledWith(mockContext);
    });

    it('should handle async handler errors', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('job failed'));
      const job = createMockJob('error-test');
      job.handler = handler;

      registerJob(job);

      await expect(getAllJobs()[0].handler({} as JobContext)).rejects.toThrow('job failed');
    });
  });

  // ---------------------------------------------------------------------------
  // Type correctness
  // ---------------------------------------------------------------------------
  describe('types', () => {
    it('should accept valid ScheduledJob with all fields', () => {
      const job: ScheduledJob = {
        name: 'full-job',
        intervalMs: 1000,
        lockTtlSec: 10,
        handler: async (_ctx: JobContext) => {
          /* no-op */
        },
      };

      registerJob(job);
      expect(getAllJobs()[0]).toMatchObject({
        name: 'full-job',
        intervalMs: 1000,
        lockTtlSec: 10,
      });
    });
  });
});
