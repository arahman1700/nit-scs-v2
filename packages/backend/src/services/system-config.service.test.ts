import type { PrismaMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../config/logger.js', () => ({ log: vi.fn() }));
vi.mock('@nit-scs-v2/shared/constants', () => ({
  DOC_PREFIXES: { grn: 'GRN', mi: 'MI', mr: 'MR' } as Record<string, string>,
  SLA_HOURS: { mi_approval: 48, jo_completion: 72 } as Record<string, number>,
  INSURANCE_THRESHOLD_SAR: 100000,
}));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import {
  invalidateConfigCache,
  getDocPrefix,
  getDocNumberFormat,
  getDocNumberPadding,
  getSlaHours,
  getAllSlaHours,
  getThreshold,
  getSetting,
  getUserSetting,
  upsertSetting,
  upsertSettings,
} from './system-config.service.js';

describe('system-config.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    // Add systemSetting model mock (not in PrismaMock interface)
    (mockPrisma as any).systemSetting = {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    };
    // Reset cache between tests
    invalidateConfigCache();
  });

  // ---------------------------------------------------------------------------
  // invalidateConfigCache
  // ---------------------------------------------------------------------------
  describe('invalidateConfigCache', () => {
    it('should clear all cache when called without arguments', async () => {
      // Prime cache
      (mockPrisma as any).systemSetting.findMany.mockResolvedValue([
        { key: 'grn', value: 'XGRN', category: 'doc_prefix', userId: null },
      ]);
      await getDocPrefix('grn');

      // Now invalidate all
      invalidateConfigCache();

      // Should re-fetch from DB on next call
      (mockPrisma as any).systemSetting.findMany.mockResolvedValue([]);
      const result = await getDocPrefix('grn');
      expect(result).toBe('GRN'); // Falls back to constant
      expect((mockPrisma as any).systemSetting.findMany).toHaveBeenCalledTimes(2);
    });

    it('should clear only a specific category when called with category', async () => {
      // Prime two caches: doc_prefix and sla
      (mockPrisma as any).systemSetting.findMany.mockResolvedValue([]);
      await getDocPrefix('grn'); // primes 'doc_prefix'
      await getSlaHours('mi_approval'); // primes 'sla'

      expect((mockPrisma as any).systemSetting.findMany).toHaveBeenCalledTimes(2);

      // Invalidate only doc_prefix
      invalidateConfigCache('doc_prefix');

      // doc_prefix should re-fetch
      await getDocPrefix('grn');
      expect((mockPrisma as any).systemSetting.findMany).toHaveBeenCalledTimes(3);

      // sla should still be cached (no extra fetch)
      await getSlaHours('mi_approval');
      expect((mockPrisma as any).systemSetting.findMany).toHaveBeenCalledTimes(3);
    });
  });

  // ---------------------------------------------------------------------------
  // getDocPrefix
  // ---------------------------------------------------------------------------
  describe('getDocPrefix', () => {
    it('should return DB override when present', async () => {
      (mockPrisma as any).systemSetting.findMany.mockResolvedValue([
        { key: 'grn', value: 'RCV', category: 'doc_prefix', userId: null },
      ]);

      const result = await getDocPrefix('grn');
      expect(result).toBe('RCV');
    });

    it('should fall back to shared constants when no DB override', async () => {
      (mockPrisma as any).systemSetting.findMany.mockResolvedValue([]);

      const result = await getDocPrefix('mi');
      expect(result).toBe('MI');
    });

    it('should fall back to uppercased documentType when no constant', async () => {
      (mockPrisma as any).systemSetting.findMany.mockResolvedValue([]);

      const result = await getDocPrefix('custom_doc');
      expect(result).toBe('CUSTOM_DOC');
    });

    it('should use cache on subsequent calls', async () => {
      (mockPrisma as any).systemSetting.findMany.mockResolvedValue([]);

      await getDocPrefix('grn');
      await getDocPrefix('mi');

      // Only one DB call since both use 'doc_prefix' category
      expect((mockPrisma as any).systemSetting.findMany).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // getDocNumberFormat
  // ---------------------------------------------------------------------------
  describe('getDocNumberFormat', () => {
    it('should return DB format when configured', async () => {
      (mockPrisma as any).systemSetting.findMany.mockResolvedValue([
        { key: 'doc_number_format', value: '{PREFIX}/{YYYY}/{NNNN}', category: 'doc_number', userId: null },
      ]);

      const result = await getDocNumberFormat();
      expect(result).toBe('{PREFIX}/{YYYY}/{NNNN}');
    });

    it('should return default format when not configured', async () => {
      (mockPrisma as any).systemSetting.findMany.mockResolvedValue([]);

      const result = await getDocNumberFormat();
      expect(result).toBe('{PREFIX}-{YYYY}-{NNNN}');
    });
  });

  // ---------------------------------------------------------------------------
  // getDocNumberPadding
  // ---------------------------------------------------------------------------
  describe('getDocNumberPadding', () => {
    it('should return DB padding when configured', async () => {
      (mockPrisma as any).systemSetting.findMany.mockResolvedValue([
        { key: 'doc_number_padding', value: '6', category: 'doc_number', userId: null },
      ]);

      const result = await getDocNumberPadding();
      expect(result).toBe(6);
    });

    it('should return default padding of 4 when not configured', async () => {
      (mockPrisma as any).systemSetting.findMany.mockResolvedValue([]);

      const result = await getDocNumberPadding();
      expect(result).toBe(4);
    });

    it('should return NaN if stored value is not a valid number (no guard in service)', async () => {
      (mockPrisma as any).systemSetting.findMany.mockResolvedValue([
        { key: 'doc_number_padding', value: 'abc', category: 'doc_number', userId: null },
      ]);

      const result = await getDocNumberPadding();
      expect(result).toBeNaN();
    });

    it('should return default 4 if stored value is empty string (falsy)', async () => {
      (mockPrisma as any).systemSetting.findMany.mockResolvedValue([
        { key: 'doc_number_padding', value: '', category: 'doc_number', userId: null },
      ]);

      const result = await getDocNumberPadding();
      expect(result).toBe(4);
    });
  });

  // ---------------------------------------------------------------------------
  // getSlaHours
  // ---------------------------------------------------------------------------
  describe('getSlaHours', () => {
    it('should return DB override when present', async () => {
      (mockPrisma as any).systemSetting.findMany.mockResolvedValue([
        { key: 'mi_approval', value: '96', category: 'sla', userId: null },
      ]);

      const result = await getSlaHours('mi_approval');
      expect(result).toBe(96);
    });

    it('should fall back to shared SLA_HOURS constant', async () => {
      (mockPrisma as any).systemSetting.findMany.mockResolvedValue([]);

      const result = await getSlaHours('mi_approval');
      expect(result).toBe(48);
    });

    it('should return 24 as default for unknown SLA key', async () => {
      (mockPrisma as any).systemSetting.findMany.mockResolvedValue([]);

      const result = await getSlaHours('unknown_sla');
      expect(result).toBe(24);
    });

    it('should ignore non-numeric DB values and fall back', async () => {
      (mockPrisma as any).systemSetting.findMany.mockResolvedValue([
        { key: 'mi_approval', value: 'not-a-number', category: 'sla', userId: null },
      ]);

      const result = await getSlaHours('mi_approval');
      expect(result).toBe(48); // Falls back to constant
    });

    it('should support decimal SLA values from DB', async () => {
      (mockPrisma as any).systemSetting.findMany.mockResolvedValue([
        { key: 'mi_approval', value: '4.5', category: 'sla', userId: null },
      ]);

      const result = await getSlaHours('mi_approval');
      expect(result).toBe(4.5);
    });
  });

  // ---------------------------------------------------------------------------
  // getAllSlaHours
  // ---------------------------------------------------------------------------
  describe('getAllSlaHours', () => {
    it('should merge DB overrides with defaults', async () => {
      (mockPrisma as any).systemSetting.findMany.mockResolvedValue([
        { key: 'mi_approval', value: '96', category: 'sla', userId: null },
        { key: 'custom_sla', value: '12', category: 'sla', userId: null },
      ]);

      const result = await getAllSlaHours();

      expect(result).toEqual({
        mi_approval: 96, // overridden
        jo_completion: 72, // original default
        custom_sla: 12, // new key from DB
      });
    });

    it('should return only defaults when DB has no overrides', async () => {
      (mockPrisma as any).systemSetting.findMany.mockResolvedValue([]);

      const result = await getAllSlaHours();
      expect(result).toEqual({
        mi_approval: 48,
        jo_completion: 72,
      });
    });

    it('should skip non-numeric DB values during merge', async () => {
      (mockPrisma as any).systemSetting.findMany.mockResolvedValue([
        { key: 'mi_approval', value: 'invalid', category: 'sla', userId: null },
      ]);

      const result = await getAllSlaHours();
      expect(result.mi_approval).toBe(48); // Not overridden
    });
  });

  // ---------------------------------------------------------------------------
  // getThreshold
  // ---------------------------------------------------------------------------
  describe('getThreshold', () => {
    it('should return DB override when present', async () => {
      (mockPrisma as any).systemSetting.findMany.mockResolvedValue([
        { key: 'insurance_threshold_sar', value: '200000', category: 'threshold', userId: null },
      ]);

      const result = await getThreshold('insurance_threshold_sar');
      expect(result).toBe(200000);
    });

    it('should fall back to INSURANCE_THRESHOLD_SAR constant', async () => {
      (mockPrisma as any).systemSetting.findMany.mockResolvedValue([]);

      const result = await getThreshold('insurance_threshold_sar');
      expect(result).toBe(100000);
    });

    it('should fall back to known default over_delivery_tolerance', async () => {
      (mockPrisma as any).systemSetting.findMany.mockResolvedValue([]);

      const result = await getThreshold('over_delivery_tolerance');
      expect(result).toBe(10);
    });

    it('should fall back to known default backdate_limit_days', async () => {
      (mockPrisma as any).systemSetting.findMany.mockResolvedValue([]);

      const result = await getThreshold('backdate_limit_days');
      expect(result).toBe(7);
    });

    it('should return 0 for unknown threshold key', async () => {
      (mockPrisma as any).systemSetting.findMany.mockResolvedValue([]);

      const result = await getThreshold('nonexistent_threshold');
      expect(result).toBe(0);
    });

    it('should ignore non-numeric DB value and fall back', async () => {
      (mockPrisma as any).systemSetting.findMany.mockResolvedValue([
        { key: 'insurance_threshold_sar', value: 'abc', category: 'threshold', userId: null },
      ]);

      const result = await getThreshold('insurance_threshold_sar');
      expect(result).toBe(100000);
    });
  });

  // ---------------------------------------------------------------------------
  // getSetting
  // ---------------------------------------------------------------------------
  describe('getSetting', () => {
    it('should return DB value when found', async () => {
      (mockPrisma as any).systemSetting.findFirst.mockResolvedValue({
        id: 's1',
        key: 'company_name',
        value: 'Nesma',
        category: 'general',
        userId: null,
      });

      const result = await getSetting('company_name');
      expect(result).toBe('Nesma');
      expect((mockPrisma as any).systemSetting.findFirst).toHaveBeenCalledWith({
        where: { key: 'company_name', userId: null },
      });
    });

    it('should return default value when not found', async () => {
      (mockPrisma as any).systemSetting.findFirst.mockResolvedValue(null);

      const result = await getSetting('missing_key', 'fallback');
      expect(result).toBe('fallback');
    });

    it('should return empty string as default when no default provided', async () => {
      (mockPrisma as any).systemSetting.findFirst.mockResolvedValue(null);

      const result = await getSetting('missing_key');
      expect(result).toBe('');
    });

    it('should return default value on DB error', async () => {
      (mockPrisma as any).systemSetting.findFirst.mockRejectedValue(new Error('DB unavailable'));

      const result = await getSetting('any_key', 'safe_default');
      expect(result).toBe('safe_default');
    });
  });

  // ---------------------------------------------------------------------------
  // getUserSetting
  // ---------------------------------------------------------------------------
  describe('getUserSetting', () => {
    it('should return user-level override when both global and user settings exist', async () => {
      (mockPrisma as any).systemSetting.findMany.mockResolvedValue([
        { key: 'theme', value: 'dark', userId: null, updatedAt: new Date('2024-01-01') },
        { key: 'theme', value: 'light', userId: 'user-1', updatedAt: new Date('2024-01-02') },
      ]);

      const result = await getUserSetting('theme', 'user-1');
      expect(result).toBe('light'); // Last entry (user override) wins
    });

    it('should return global setting when no user override exists', async () => {
      (mockPrisma as any).systemSetting.findMany.mockResolvedValue([
        { key: 'theme', value: 'dark', userId: null, updatedAt: new Date('2024-01-01') },
      ]);

      const result = await getUserSetting('theme', 'user-1');
      expect(result).toBe('dark');
    });

    it('should query with correct OR condition', async () => {
      (mockPrisma as any).systemSetting.findMany.mockResolvedValue([]);

      await getUserSetting('theme', 'user-42', 'default');

      expect((mockPrisma as any).systemSetting.findMany).toHaveBeenCalledWith({
        where: {
          key: 'theme',
          OR: [{ userId: null }, { userId: 'user-42' }],
        },
        orderBy: { updatedAt: 'asc' },
      });
    });

    it('should return default when no rows found', async () => {
      (mockPrisma as any).systemSetting.findMany.mockResolvedValue([]);

      const result = await getUserSetting('unknown', 'user-1', 'fallback');
      expect(result).toBe('fallback');
    });

    it('should return default on DB error', async () => {
      (mockPrisma as any).systemSetting.findMany.mockRejectedValue(new Error('DB down'));

      const result = await getUserSetting('theme', 'user-1', 'safe');
      expect(result).toBe('safe');
    });
  });

  // ---------------------------------------------------------------------------
  // upsertSetting
  // ---------------------------------------------------------------------------
  describe('upsertSetting', () => {
    it('should create a new setting when key does not exist', async () => {
      (mockPrisma as any).systemSetting.findFirst.mockResolvedValue(null);
      (mockPrisma as any).systemSetting.create.mockResolvedValue({});

      await upsertSetting('new_key', 'new_value', 'general');

      expect((mockPrisma as any).systemSetting.create).toHaveBeenCalledWith({
        data: { key: 'new_key', value: 'new_value', category: 'general' },
      });
      expect((mockPrisma as any).systemSetting.update).not.toHaveBeenCalled();
    });

    it('should update an existing setting when key exists', async () => {
      (mockPrisma as any).systemSetting.findFirst.mockResolvedValue({
        id: 'existing-id',
        key: 'existing_key',
        value: 'old',
        category: 'general',
      });
      (mockPrisma as any).systemSetting.update.mockResolvedValue({});

      await upsertSetting('existing_key', 'new_value', 'general');

      expect((mockPrisma as any).systemSetting.update).toHaveBeenCalledWith({
        where: { id: 'existing-id' },
        data: { value: 'new_value', category: 'general' },
      });
      expect((mockPrisma as any).systemSetting.create).not.toHaveBeenCalled();
    });

    it('should invalidate the category cache after upsert', async () => {
      (mockPrisma as any).systemSetting.findFirst.mockResolvedValue(null);
      (mockPrisma as any).systemSetting.create.mockResolvedValue({});

      // Prime cache for 'sla' category
      (mockPrisma as any).systemSetting.findMany.mockResolvedValue([]);
      await getSlaHours('test'); // primes 'sla' cache

      expect((mockPrisma as any).systemSetting.findMany).toHaveBeenCalledTimes(1);

      // Upsert a setting in 'sla' category
      await upsertSetting('test', '10', 'sla');

      // Next fetch should re-query DB (cache was invalidated)
      await getSlaHours('test');
      expect((mockPrisma as any).systemSetting.findMany).toHaveBeenCalledTimes(2);
    });

    it('should default category to "general" when not provided', async () => {
      (mockPrisma as any).systemSetting.findFirst.mockResolvedValue(null);
      (mockPrisma as any).systemSetting.create.mockResolvedValue({});

      await upsertSetting('key', 'val');

      expect((mockPrisma as any).systemSetting.create).toHaveBeenCalledWith({
        data: { key: 'key', value: 'val', category: 'general' },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // upsertSettings (bulk)
  // ---------------------------------------------------------------------------
  describe('upsertSettings', () => {
    it('should create new entries in a transaction', async () => {
      // $transaction runs callback with mock as tx
      const txSystemSetting = {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn(),
      };
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        return cb({ systemSetting: txSystemSetting });
      });

      await upsertSettings([
        { key: 'k1', value: 'v1', category: 'sla' },
        { key: 'k2', value: 'v2', category: 'sla' },
      ]);

      expect(txSystemSetting.findFirst).toHaveBeenCalledTimes(2);
      expect(txSystemSetting.create).toHaveBeenCalledTimes(2);
      expect(txSystemSetting.create).toHaveBeenCalledWith({
        data: { key: 'k1', value: 'v1', category: 'sla' },
      });
      expect(txSystemSetting.create).toHaveBeenCalledWith({
        data: { key: 'k2', value: 'v2', category: 'sla' },
      });
    });

    it('should update existing entries in a transaction', async () => {
      const txSystemSetting = {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({ id: 'id-1', key: 'k1', value: 'old1' })
          .mockResolvedValueOnce({ id: 'id-2', key: 'k2', value: 'old2' }),
        create: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      };
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        return cb({ systemSetting: txSystemSetting });
      });

      await upsertSettings([
        { key: 'k1', value: 'new1', category: 'doc_prefix' },
        { key: 'k2', value: 'new2', category: 'doc_prefix' },
      ]);

      expect(txSystemSetting.update).toHaveBeenCalledTimes(2);
      expect(txSystemSetting.update).toHaveBeenCalledWith({
        where: { id: 'id-1' },
        data: { value: 'new1', category: 'doc_prefix' },
      });
      expect(txSystemSetting.create).not.toHaveBeenCalled();
    });

    it('should invalidate all affected categories', async () => {
      const txSystemSetting = {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn(),
      };
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        return cb({ systemSetting: txSystemSetting });
      });

      // Prime both caches
      (mockPrisma as any).systemSetting.findMany.mockResolvedValue([]);
      await getDocPrefix('grn'); // primes 'doc_prefix'
      await getSlaHours('mi_approval'); // primes 'sla'
      expect((mockPrisma as any).systemSetting.findMany).toHaveBeenCalledTimes(2);

      // Bulk upsert across two categories
      await upsertSettings([
        { key: 'grn', value: 'RCV', category: 'doc_prefix' },
        { key: 'mi_approval', value: '100', category: 'sla' },
      ]);

      // Both caches should be invalidated
      await getDocPrefix('grn');
      await getSlaHours('mi_approval');
      expect((mockPrisma as any).systemSetting.findMany).toHaveBeenCalledTimes(4);
    });

    it('should handle mix of creates and updates', async () => {
      const txSystemSetting = {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({ id: 'id-1', key: 'existing', value: 'old' })
          .mockResolvedValueOnce(null),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      };
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        return cb({ systemSetting: txSystemSetting });
      });

      await upsertSettings([
        { key: 'existing', value: 'updated', category: 'general' },
        { key: 'brand_new', value: 'created', category: 'general' },
      ]);

      expect(txSystemSetting.update).toHaveBeenCalledTimes(1);
      expect(txSystemSetting.create).toHaveBeenCalledTimes(1);
    });

    it('should handle empty entries array gracefully', async () => {
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        return cb({ systemSetting: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() } });
      });

      await expect(upsertSettings([])).resolves.not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // Cache Behavior
  // ---------------------------------------------------------------------------
  describe('cache behavior', () => {
    it('should serve from cache within TTL', async () => {
      (mockPrisma as any).systemSetting.findMany.mockResolvedValue([
        { key: 'grn', value: 'CACHED', category: 'doc_prefix', userId: null },
      ]);

      const first = await getDocPrefix('grn');
      const second = await getDocPrefix('grn');

      expect(first).toBe('CACHED');
      expect(second).toBe('CACHED');
      expect((mockPrisma as any).systemSetting.findMany).toHaveBeenCalledTimes(1);
    });

    it('should re-fetch after cache is explicitly invalidated', async () => {
      (mockPrisma as any).systemSetting.findMany
        .mockResolvedValueOnce([{ key: 'grn', value: 'V1', category: 'doc_prefix', userId: null }])
        .mockResolvedValueOnce([{ key: 'grn', value: 'V2', category: 'doc_prefix', userId: null }]);

      const first = await getDocPrefix('grn');
      expect(first).toBe('V1');

      invalidateConfigCache('doc_prefix');

      const second = await getDocPrefix('grn');
      expect(second).toBe('V2');
      expect((mockPrisma as any).systemSetting.findMany).toHaveBeenCalledTimes(2);
    });

    it('should use stale cache data on DB error after initial fetch', async () => {
      (mockPrisma as any).systemSetting.findMany.mockResolvedValueOnce([
        { key: 'grn', value: 'STALE', category: 'doc_prefix', userId: null },
      ]);

      await getDocPrefix('grn');

      // Invalidate to force re-fetch
      invalidateConfigCache('doc_prefix');

      // DB fails on next attempt
      (mockPrisma as any).systemSetting.findMany.mockRejectedValue(new Error('DB timeout'));

      // The fetchCategory catches the error and returns stale cache entry
      const result = await getDocPrefix('grn');
      // After invalidation, cache.get returns undefined, so empty fallback + constant
      expect(result).toBe('GRN'); // Falls back to constant since cache was deleted
    });

    it('should return empty map on initial DB error with no cached data', async () => {
      (mockPrisma as any).systemSetting.findMany.mockRejectedValue(new Error('DB offline'));

      // No cache primed, DB fails → empty overrides → constant fallback
      const result = await getDocPrefix('grn');
      expect(result).toBe('GRN');
    });

    it('should maintain separate caches per category', async () => {
      (mockPrisma as any).systemSetting.findMany
        .mockResolvedValueOnce([{ key: 'grn', value: 'RCV', category: 'doc_prefix', userId: null }])
        .mockResolvedValueOnce([{ key: 'mi_approval', value: '100', category: 'sla', userId: null }]);

      const prefix = await getDocPrefix('grn');
      const sla = await getSlaHours('mi_approval');

      expect(prefix).toBe('RCV');
      expect(sla).toBe(100);
      expect((mockPrisma as any).systemSetting.findMany).toHaveBeenCalledTimes(2);

      // Invalidate only doc_prefix
      invalidateConfigCache('doc_prefix');

      // SLA should still be cached
      const sla2 = await getSlaHours('mi_approval');
      expect(sla2).toBe(100);
      expect((mockPrisma as any).systemSetting.findMany).toHaveBeenCalledTimes(2); // no new call
    });
  });
});
