/**
 * BullMQ Configuration Tests
 *
 * Tests queue creation, connection parsing, dead-letter queue handling,
 * and graceful shutdown behavior.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock BullMQ classes ─────────────────────────────────────────────────

const mockQueueAdd = vi.fn().mockResolvedValue({});
const mockQueueClose = vi.fn().mockResolvedValue(undefined);
const mockQueueGetRepeatableJobs = vi.fn().mockResolvedValue([]);
const mockQueueRemoveRepeatableByKey = vi.fn().mockResolvedValue(undefined);

const mockWorkerClose = vi.fn().mockResolvedValue(undefined);
const mockWorkerOn = vi.fn().mockReturnThis();

vi.mock('bullmq', () => {
  function MockQueue(this: Record<string, unknown>, name: string) {
    this.name = name;
    this.add = mockQueueAdd;
    this.close = mockQueueClose;
    this.getRepeatableJobs = mockQueueGetRepeatableJobs;
    this.removeRepeatableByKey = mockQueueRemoveRepeatableByKey;
  }
  function MockWorker(this: Record<string, unknown>) {
    this.close = mockWorkerClose;
    this.on = mockWorkerOn;
  }
  return { Queue: MockQueue, Worker: MockWorker };
});

vi.mock('../../config/redis.js', () => ({
  getRedis: vi.fn().mockReturnValue(null),
}));

vi.mock('../../config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ── Import after mocks ─────────────────────────────────────────────────

import {
  QUEUE_NAMES,
  getQueue,
  getAllQueues,
  getDeadLetterQueue,
  moveToDeadLetter,
  shutdownQueues,
  getQueueConnection,
  createWorker,
} from './bullmq.config.js';

// ── Tests ───────────────────────────────────────────────────────────────

describe('bullmq.config', () => {
  const originalRedisUrl = process.env.REDIS_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REDIS_URL = 'redis://localhost:6379';
  });

  afterEach(async () => {
    await shutdownQueues();
    process.env.REDIS_URL = originalRedisUrl;
  });

  describe('QUEUE_NAMES', () => {
    it('should define Oracle WMS-compatible queue names', () => {
      expect(QUEUE_NAMES.WMS_QUEUE).toBe('WMS_QUEUE');
      expect(QUEUE_NAMES.RCV_QUEUE).toBe('RCV_QUEUE');
      expect(QUEUE_NAMES.INV_QUEUE).toBe('INV_QUEUE');
      expect(QUEUE_NAMES.SHIP_QUEUE).toBe('SHIP_QUEUE');
      expect(QUEUE_NAMES.CUST_QUEUE).toBe('CUST_QUEUE');
      expect(QUEUE_NAMES.ASN_QUEUE).toBe('ASN_QUEUE');
      expect(QUEUE_NAMES.GRN_QUEUE).toBe('GRN_QUEUE');
      expect(QUEUE_NAMES.PICK_QUEUE).toBe('PICK_QUEUE');
      expect(QUEUE_NAMES.PUT_QUEUE).toBe('PUT_QUEUE');
      expect(QUEUE_NAMES.AUD_QUEUE).toBe('AUD_QUEUE');
      expect(QUEUE_NAMES.NOTIF_QUEUE).toBe('NOTIF_QUEUE');
      expect(QUEUE_NAMES.DLQ).toBe('DEAD_LETTER_QUEUE');
    });

    it('should have exactly 12 queue names (11 operational + DLQ)', () => {
      expect(Object.keys(QUEUE_NAMES)).toHaveLength(12);
    });
  });

  describe('getQueueConnection', () => {
    it('should parse REDIS_URL into connection options', () => {
      const original = process.env.REDIS_URL;
      process.env.REDIS_URL = 'redis://user:pass@myhost:6380';

      const conn = getQueueConnection();

      expect(conn.host).toBe('myhost');
      expect(conn.port).toBe(6380);
      expect(conn.password).toBe('pass');
      expect(conn.username).toBe('user');
      expect(conn.maxRetriesPerRequest).toBeNull(); // Required by BullMQ

      process.env.REDIS_URL = original;
    });

    it('should enable TLS for rediss:// URLs', () => {
      const original = process.env.REDIS_URL;
      process.env.REDIS_URL = 'rediss://default:secret@tls-host:6379';

      const conn = getQueueConnection();

      expect(conn.host).toBe('tls-host');
      expect(conn.tls).toEqual({});

      process.env.REDIS_URL = original;
    });

    it('should default to localhost:6379 when no REDIS_URL', () => {
      process.env.REDIS_URL = '';

      const conn = getQueueConnection();

      expect(conn.host).toBe('localhost');
      expect(conn.port).toBe(6379);
    });
  });

  describe('getQueue', () => {
    it('should return a Queue instance for a given name', () => {
      const queue = getQueue(QUEUE_NAMES.INV_QUEUE);
      expect(queue).toBeDefined();
      expect(queue.name).toBe('INV_QUEUE');
    });

    it('should return the same instance on subsequent calls (singleton)', () => {
      const q1 = getQueue(QUEUE_NAMES.WMS_QUEUE);
      const q2 = getQueue(QUEUE_NAMES.WMS_QUEUE);
      expect(q1).toBe(q2);
    });

    it('should return different instances for different queue names', () => {
      const q1 = getQueue(QUEUE_NAMES.INV_QUEUE);
      const q2 = getQueue(QUEUE_NAMES.AUD_QUEUE);
      expect(q1).not.toBe(q2);
    });
  });

  describe('getAllQueues', () => {
    it('should return all created queues', () => {
      getQueue(QUEUE_NAMES.INV_QUEUE);
      getQueue(QUEUE_NAMES.WMS_QUEUE);
      getQueue(QUEUE_NAMES.AUD_QUEUE);

      const all = getAllQueues();
      expect(all.length).toBe(3);
    });
  });

  describe('getDeadLetterQueue', () => {
    it('should create and return the dead-letter queue', () => {
      const dlq = getDeadLetterQueue();
      expect(dlq).toBeDefined();
      expect(dlq.name).toBe('DEAD_LETTER_QUEUE');
    });

    it('should return the same DLQ instance on subsequent calls', () => {
      const dlq1 = getDeadLetterQueue();
      const dlq2 = getDeadLetterQueue();
      expect(dlq1).toBe(dlq2);
    });
  });

  describe('moveToDeadLetter', () => {
    it('should add a failed job to the dead-letter queue', async () => {
      await moveToDeadLetter({
        id: 'job-123',
        name: 'SCM_SLA_BREACH_CHECK',
        data: { legacyName: 'sla_breach' },
        failedReason: 'Connection timeout',
        attemptsMade: 3,
        queueName: 'WMS_QUEUE',
      });

      expect(mockQueueAdd).toHaveBeenCalledWith('DLQ_ENTRY', {
        originalQueue: 'WMS_QUEUE',
        originalJobName: 'SCM_SLA_BREACH_CHECK',
        originalJobId: 'job-123',
        data: { legacyName: 'sla_breach' },
        failedReason: 'Connection timeout',
        attempts: 3,
        movedAt: expect.any(String),
      });
    });
  });

  describe('createWorker', () => {
    it('should create a worker with default concurrency of 1', () => {
      const processor = vi.fn();
      const worker = createWorker(QUEUE_NAMES.INV_QUEUE, processor);

      expect(worker).toBeDefined();
      expect(mockWorkerOn).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockWorkerOn).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(mockWorkerOn).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('shutdownQueues', () => {
    it('should close all workers and queues', async () => {
      // Create some queues and workers first
      getQueue(QUEUE_NAMES.INV_QUEUE);
      getQueue(QUEUE_NAMES.WMS_QUEUE);
      createWorker(QUEUE_NAMES.INV_QUEUE, vi.fn());
      getDeadLetterQueue();

      await shutdownQueues();

      expect(mockWorkerClose).toHaveBeenCalled();
      expect(mockQueueClose).toHaveBeenCalled();

      // After shutdown, getAllQueues should return empty
      expect(getAllQueues()).toHaveLength(0);
    });
  });
});
