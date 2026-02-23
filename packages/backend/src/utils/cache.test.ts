const { mockRedis, mockIsRedisAvailable, mockGetRedis } = vi.hoisted(() => ({
  mockRedis: {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    scan: vi.fn(),
  },
  mockIsRedisAvailable: vi.fn(),
  mockGetRedis: vi.fn(),
}));

vi.mock('../config/redis.js', () => ({
  isRedisAvailable: mockIsRedisAvailable,
  getRedis: mockGetRedis,
}));
vi.mock('../config/logger.js', () => ({ logger: { warn: vi.fn() } }));

import { cached, invalidateCache, invalidateCachePattern, CacheTTL } from './cache.js';

describe('cache utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRedisAvailable.mockReturnValue(true);
    mockGetRedis.mockReturnValue(mockRedis);
  });

  // ─── CacheTTL constants ────────────────────────────────────────────

  describe('CacheTTL', () => {
    it('exports expected TTL values', () => {
      expect(CacheTTL.DASHBOARD_STATS).toBe(30);
      expect(CacheTTL.INVENTORY_SUMMARY).toBe(60);
      expect(CacheTTL.LABOR_PRODUCTIVITY).toBe(300);
    });
  });

  // ─── cached ────────────────────────────────────────────────────────

  describe('cached', () => {
    it('returns cached value on hit', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ x: 1 }));
      const fetcher = vi.fn();

      const result = await cached('test-key', 30, fetcher);

      expect(result).toEqual({ x: 1 });
      expect(fetcher).not.toHaveBeenCalled();
      expect(mockRedis.get).toHaveBeenCalledWith('nit-scs:cache:test-key');
    });

    it('calls fetcher and caches on miss', async () => {
      mockRedis.get.mockResolvedValue(null);
      const fetcher = vi.fn().mockResolvedValue({ fresh: true });

      const result = await cached('miss-key', 60, fetcher);

      expect(result).toEqual({ fresh: true });
      expect(fetcher).toHaveBeenCalledOnce();
      expect(mockRedis.setex).toHaveBeenCalledWith('nit-scs:cache:miss-key', 60, JSON.stringify({ fresh: true }));
    });

    it('falls through to fetcher when Redis unavailable', async () => {
      mockIsRedisAvailable.mockReturnValue(false);
      const fetcher = vi.fn().mockResolvedValue('fallback');

      const result = await cached('no-redis', 30, fetcher);

      expect(result).toBe('fallback');
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('falls through to fetcher when getRedis returns null', async () => {
      mockGetRedis.mockReturnValue(null);
      const fetcher = vi.fn().mockResolvedValue('fallback');

      const result = await cached('no-client', 30, fetcher);

      expect(result).toBe('fallback');
    });

    it('falls through to fetcher on cache read error', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis down'));
      const fetcher = vi.fn().mockResolvedValue('fresh');

      const result = await cached('error-key', 30, fetcher);

      expect(result).toBe('fresh');
    });

    it('returns data even when cache write fails', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockRejectedValue(new Error('Write fail'));
      const fetcher = vi.fn().mockResolvedValue('data');

      const result = await cached('write-fail', 30, fetcher);

      expect(result).toBe('data');
    });
  });

  // ─── invalidateCache ──────────────────────────────────────────────

  describe('invalidateCache', () => {
    it('deletes specified keys with prefix', async () => {
      await invalidateCache('key1', 'key2');
      expect(mockRedis.del).toHaveBeenCalledWith('nit-scs:cache:key1', 'nit-scs:cache:key2');
    });

    it('does nothing when Redis unavailable', async () => {
      mockIsRedisAvailable.mockReturnValue(false);
      await invalidateCache('key1');
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('handles delete errors gracefully', async () => {
      mockRedis.del.mockRejectedValue(new Error('Del fail'));
      await expect(invalidateCache('key1')).resolves.toBeUndefined();
    });
  });

  // ─── invalidateCachePattern ───────────────────────────────────────

  describe('invalidateCachePattern', () => {
    it('scans and deletes matching keys', async () => {
      mockRedis.scan.mockResolvedValueOnce(['0', ['nit-scs:cache:dash:1', 'nit-scs:cache:dash:2']]);

      await invalidateCachePattern('dash:*');

      expect(mockRedis.scan).toHaveBeenCalledWith('0', 'MATCH', 'nit-scs:cache:dash:*', 'COUNT', 100);
      expect(mockRedis.del).toHaveBeenCalledWith('nit-scs:cache:dash:1', 'nit-scs:cache:dash:2');
    });

    it('skips del when scan returns no keys', async () => {
      mockRedis.scan.mockResolvedValueOnce(['0', []]);

      await invalidateCachePattern('empty:*');

      expect(mockRedis.scan).toHaveBeenCalledTimes(1);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('does nothing when Redis unavailable', async () => {
      mockIsRedisAvailable.mockReturnValue(false);
      await invalidateCachePattern('*');
      expect(mockRedis.scan).not.toHaveBeenCalled();
    });

    it('handles scan error gracefully', async () => {
      mockRedis.scan.mockRejectedValue(new Error('Scan fail'));
      await expect(invalidateCachePattern('*')).resolves.toBeUndefined();
    });
  });
});
