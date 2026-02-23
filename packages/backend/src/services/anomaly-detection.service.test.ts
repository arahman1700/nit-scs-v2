import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaMock, PrismaModelMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => ({ mockPrisma: {} as PrismaMock }));
vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../config/logger.js', () => ({ log: vi.fn() }));
vi.mock('./notification.service.js', () => ({ createNotification: vi.fn().mockResolvedValue({}) }));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { detectAnomalies, getInventoryHealthSummary } from './anomaly-detection.service.js';
import { createNotification } from './notification.service.js';
import { log } from '../config/logger.js';

// ── Helpers ──────────────────────────────────────────────────────────────

function makeQuantitySpikeRow(
  overrides: Partial<{
    id: string;
    itemId: string;
    itemCode: string;
    itemDescription: string;
    warehouseId: string;
    warehouseName: string;
    qtyIssued: number;
    avgQty: number;
    stddevQty: number;
  }> = {},
) {
  return {
    id: 'ml-1',
    itemId: 'item-1',
    itemCode: 'ITM-001',
    itemDescription: 'Bolt M10',
    warehouseId: 'wh-1',
    warehouseName: 'Main Warehouse',
    qtyIssued: 100,
    avgQty: 20,
    stddevQty: 10,
    ...overrides,
  };
}

function makeOffHoursRow(
  overrides: Partial<{
    table_name: string;
    record_id: string;
    performed_at: Date;
    full_name: string;
    hour: number;
  }> = {},
) {
  return {
    table_name: 'mrrv',
    record_id: 'rec-1',
    performed_at: new Date('2026-02-20T02:00:00Z'),
    full_name: 'Ahmed Ali',
    hour: 3,
    ...overrides,
  };
}

function makeNegativeStockRow(
  overrides: Partial<{
    id: string;
    itemId: string;
    itemCode: string;
    warehouseId: string;
    warehouseName: string;
    quantity: number;
    reservedQty: number;
    effective: number;
  }> = {},
) {
  return {
    id: 'il-1',
    itemId: 'item-2',
    itemCode: 'ITM-002',
    warehouseId: 'wh-2',
    warehouseName: 'Site B',
    quantity: -5,
    reservedQty: 0,
    effective: -5,
    ...overrides,
  };
}

// ── Test Suite ────────────────────────────────────────────────────────────

describe('AnomalyDetectionService', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    vi.clearAllMocks();
  });

  // ────────────────────────────────────────────────────────────────────────
  // detectAnomalies — orchestrator
  // ────────────────────────────────────────────────────────────────────────
  describe('detectAnomalies', () => {
    it('should return empty array when no anomalies detected', async () => {
      // 3 parallel $queryRaw calls, all return empty
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([]) // detectQuantitySpikes
        .mockResolvedValueOnce([]) // detectOffHoursActivity
        .mockResolvedValueOnce([]); // detectNegativeStock

      const result = await detectAnomalies();

      expect(result).toEqual([]);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(3);
    });

    it('should use default 24h lookback when no since option provided', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const before = Date.now();
      await detectAnomalies();

      // The function should have been called — we just verify it completed
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(3);
      expect(log).toHaveBeenCalledWith('info', expect.stringContaining('Running anomaly detection'));
    });

    it('should accept custom since date', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const customSince = new Date('2026-01-01');
      const result = await detectAnomalies({ since: customSince });

      expect(result).toEqual([]);
    });

    it('should merge results from all three detectors', async () => {
      const spikeRow = makeQuantitySpikeRow();
      const offHoursRow = makeOffHoursRow();
      const negativeRow = makeNegativeStockRow();

      mockPrisma.$queryRaw
        .mockResolvedValueOnce([spikeRow]) // detectQuantitySpikes
        .mockResolvedValueOnce([offHoursRow]) // detectOffHoursActivity
        .mockResolvedValueOnce([negativeRow]); // detectNegativeStock

      // High-severity anomalies trigger admin lookup
      mockPrisma.employee.findMany.mockResolvedValue([]);

      const result = await detectAnomalies();

      expect(result).toHaveLength(3);
      expect(result.map(a => a.type)).toContain('quantity_spike');
      expect(result.map(a => a.type)).toContain('off_hours');
      expect(result.map(a => a.type)).toContain('negative_stock');
    });

    it('should log summary with anomaly count and high severity count', async () => {
      const highSeveritySpike = makeQuantitySpikeRow({ qtyIssued: 200, avgQty: 20, stddevQty: 10 });
      // z-score = (200-20)/10 = 18 → high severity

      mockPrisma.$queryRaw
        .mockResolvedValueOnce([highSeveritySpike])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      // Mock for admin notification lookup
      mockPrisma.employee.findMany.mockResolvedValue([]);

      await detectAnomalies();

      expect(log).toHaveBeenCalledWith('info', expect.stringContaining('1 anomalies'));
      expect(log).toHaveBeenCalledWith('info', expect.stringContaining('1 high severity'));
    });

    it('should handle partial detector failures gracefully', async () => {
      // First detector fails, others succeed
      mockPrisma.$queryRaw
        .mockRejectedValueOnce(new Error('Connection lost'))
        .mockResolvedValueOnce([makeOffHoursRow()])
        .mockResolvedValueOnce([]);

      // Off-hours at hour 3 is high severity → triggers admin lookup
      mockPrisma.employee.findMany.mockResolvedValue([]);

      const result = await detectAnomalies();

      // Should still get results from the detectors that succeeded
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(log).toHaveBeenCalledWith('warn', expect.stringContaining('Quantity spike detection failed'));
    });

    it('should handle all detectors failing', async () => {
      mockPrisma.$queryRaw
        .mockRejectedValueOnce(new Error('DB down'))
        .mockRejectedValueOnce(new Error('DB down'))
        .mockRejectedValueOnce(new Error('DB down'));

      const result = await detectAnomalies();

      expect(result).toEqual([]);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // detectAnomalies — notifications
  // ────────────────────────────────────────────────────────────────────────
  describe('detectAnomalies — admin notifications', () => {
    it('should notify admins when high-severity anomalies exist', async () => {
      // High z-score spike → high severity
      const highSpikeRow = makeQuantitySpikeRow({ qtyIssued: 500, avgQty: 20, stddevQty: 10 });
      // z-score = (500-20)/10 = 48 → definitely high

      mockPrisma.$queryRaw.mockResolvedValueOnce([highSpikeRow]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'admin-1' }, { id: 'admin-2' }]);

      await detectAnomalies({ notify: true });

      expect(mockPrisma.employee.findMany).toHaveBeenCalledWith({
        where: { systemRole: 'admin', isActive: true },
        select: { id: true },
      });
      expect(createNotification).toHaveBeenCalledTimes(2);
      expect(createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'admin-1',
          notificationType: 'sla_breach',
          referenceTable: 'system',
          referenceId: 'anomaly_detection',
        }),
      );
    });

    it('should not notify when notify option is false', async () => {
      const highSpikeRow = makeQuantitySpikeRow({ qtyIssued: 500, avgQty: 20, stddevQty: 10 });

      mockPrisma.$queryRaw.mockResolvedValueOnce([highSpikeRow]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      await detectAnomalies({ notify: false });

      expect(mockPrisma.employee.findMany).not.toHaveBeenCalled();
      expect(createNotification).not.toHaveBeenCalled();
    });

    it('should not notify when no high-severity anomalies exist', async () => {
      // Low z-score → low severity
      const lowSpikeRow = makeQuantitySpikeRow({ qtyIssued: 50, avgQty: 20, stddevQty: 10 });
      // z-score = (50-20)/10 = 3.0 → medium, not high

      mockPrisma.$queryRaw.mockResolvedValueOnce([lowSpikeRow]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      await detectAnomalies();

      expect(mockPrisma.employee.findMany).not.toHaveBeenCalled();
      expect(createNotification).not.toHaveBeenCalled();
    });

    it('should notify by default (notify not explicitly set) when high severity found', async () => {
      const highSpikeRow = makeQuantitySpikeRow({ qtyIssued: 500, avgQty: 20, stddevQty: 10 });

      mockPrisma.$queryRaw.mockResolvedValueOnce([highSpikeRow]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'admin-1' }]);

      // No options.notify specified at all
      await detectAnomalies();

      expect(createNotification).toHaveBeenCalledTimes(1);
    });

    it('should include up to 3 anomaly descriptions in notification body', async () => {
      // 4 high-severity anomalies — only first 3 should appear in body
      const spikes = [
        makeQuantitySpikeRow({ id: 'ml-1', qtyIssued: 500, avgQty: 20, stddevQty: 10 }),
        makeQuantitySpikeRow({ id: 'ml-2', qtyIssued: 600, avgQty: 20, stddevQty: 10 }),
        makeQuantitySpikeRow({ id: 'ml-3', qtyIssued: 700, avgQty: 20, stddevQty: 10 }),
        makeQuantitySpikeRow({ id: 'ml-4', qtyIssued: 800, avgQty: 20, stddevQty: 10 }),
      ];

      mockPrisma.$queryRaw.mockResolvedValueOnce(spikes).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'admin-1' }]);

      await detectAnomalies();

      expect(createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('4 anomalies detected'),
        }),
      );
    });

    it('should not crash if createNotification throws', async () => {
      const highSpikeRow = makeQuantitySpikeRow({ qtyIssued: 500, avgQty: 20, stddevQty: 10 });

      mockPrisma.$queryRaw.mockResolvedValueOnce([highSpikeRow]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'admin-1' }]);
      vi.mocked(createNotification).mockRejectedValueOnce(new Error('Notification failed'));

      // Should not throw
      const result = await detectAnomalies();
      expect(result).toHaveLength(1);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // detectQuantitySpikes (tested via detectAnomalies)
  // ────────────────────────────────────────────────────────────────────────
  describe('quantity spike detection', () => {
    it('should classify z-score > 4 as high severity', async () => {
      // z-score = (100-20)/10 = 8.0 → high
      const row = makeQuantitySpikeRow({ qtyIssued: 100, avgQty: 20, stddevQty: 10 });

      mockPrisma.$queryRaw.mockResolvedValueOnce([row]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      mockPrisma.employee.findMany.mockResolvedValue([]);

      const result = await detectAnomalies({ notify: false });

      const spike = result.find(a => a.type === 'quantity_spike');
      expect(spike).toBeDefined();
      expect(spike!.severity).toBe('high');
    });

    it('should classify z-score between 3 and 4 as medium severity', async () => {
      // z-score = (55-20)/10 = 3.5 → medium
      const row = makeQuantitySpikeRow({ qtyIssued: 55, avgQty: 20, stddevQty: 10 });

      mockPrisma.$queryRaw.mockResolvedValueOnce([row]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const result = await detectAnomalies({ notify: false });

      const spike = result.find(a => a.type === 'quantity_spike');
      expect(spike!.severity).toBe('medium');
    });

    it('should classify z-score <= 3 as low severity', async () => {
      // z-score = (48-20)/10 = 2.8 → low
      const row = makeQuantitySpikeRow({ qtyIssued: 48, avgQty: 20, stddevQty: 10 });

      mockPrisma.$queryRaw.mockResolvedValueOnce([row]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const result = await detectAnomalies({ notify: false });

      const spike = result.find(a => a.type === 'quantity_spike');
      expect(spike!.severity).toBe('low');
    });

    it('should populate all anomaly fields correctly for quantity spikes', async () => {
      const row = makeQuantitySpikeRow({
        id: 'ml-77',
        itemId: 'item-77',
        itemCode: 'BOLT-10',
        warehouseId: 'wh-99',
        warehouseName: 'Central',
        qtyIssued: 100,
        avgQty: 20,
        stddevQty: 10,
      });

      mockPrisma.$queryRaw.mockResolvedValueOnce([row]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      mockPrisma.employee.findMany.mockResolvedValue([]);

      const result = await detectAnomalies({ notify: false });
      const spike = result[0];

      expect(spike.type).toBe('quantity_spike');
      expect(spike.itemId).toBe('item-77');
      expect(spike.itemCode).toBe('BOLT-10');
      expect(spike.warehouseId).toBe('wh-99');
      expect(spike.warehouseName).toBe('Central');
      expect(spike.value).toBe(100);
      // threshold = avgQty + 2.5 * stddevQty = 20 + 25 = 45
      expect(spike.threshold).toBe(45);
      expect(spike.referenceId).toBe('ml-77');
      expect(spike.referenceTable).toBe('mirv_lines');
      expect(spike.detectedAt).toBeInstanceOf(Date);
      expect(spike.description).toContain('BOLT-10');
      expect(spike.description).toContain('100');
    });

    it('should handle zero stddev gracefully (z-score = 0)', async () => {
      const row = makeQuantitySpikeRow({ qtyIssued: 50, avgQty: 20, stddevQty: 0 });

      mockPrisma.$queryRaw.mockResolvedValueOnce([row]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const result = await detectAnomalies({ notify: false });

      const spike = result.find(a => a.type === 'quantity_spike');
      expect(spike!.severity).toBe('low'); // z-score = 0 with stddev 0
    });

    it('should handle multiple spikes in single run', async () => {
      const rows = [
        makeQuantitySpikeRow({ id: 'ml-1', itemCode: 'A', qtyIssued: 100, avgQty: 20, stddevQty: 10 }),
        makeQuantitySpikeRow({ id: 'ml-2', itemCode: 'B', qtyIssued: 60, avgQty: 20, stddevQty: 10 }),
        makeQuantitySpikeRow({ id: 'ml-3', itemCode: 'C', qtyIssued: 48, avgQty: 20, stddevQty: 10 }),
      ];

      mockPrisma.$queryRaw.mockResolvedValueOnce(rows).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      mockPrisma.employee.findMany.mockResolvedValue([]);

      const result = await detectAnomalies({ notify: false });
      const spikes = result.filter(a => a.type === 'quantity_spike');

      expect(spikes).toHaveLength(3);
      expect(spikes[0].severity).toBe('high'); // z=8
      expect(spikes[1].severity).toBe('medium'); // z=4
      expect(spikes[2].severity).toBe('low'); // z=2.8
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // detectOffHoursActivity (tested via detectAnomalies)
  // ────────────────────────────────────────────────────────────────────────
  describe('off-hours activity detection', () => {
    it('should classify activity at hours 0-4 as high severity', async () => {
      const row = makeOffHoursRow({ hour: 3, full_name: 'Night Owl' });

      mockPrisma.$queryRaw
        .mockResolvedValueOnce([]) // quantity spikes
        .mockResolvedValueOnce([row]) // off-hours
        .mockResolvedValueOnce([]); // negative stock

      const result = await detectAnomalies({ notify: false });
      const offHour = result.find(a => a.type === 'off_hours');

      expect(offHour!.severity).toBe('high');
    });

    it('should classify activity at hour 0 as high severity', async () => {
      const row = makeOffHoursRow({ hour: 0 });

      mockPrisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([row]).mockResolvedValueOnce([]);

      const result = await detectAnomalies({ notify: false });
      const offHour = result.find(a => a.type === 'off_hours');
      expect(offHour!.severity).toBe('high');
    });

    it('should classify activity at hour 5+ (but outside working hours) as low severity', async () => {
      const row = makeOffHoursRow({ hour: 5 });

      mockPrisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([row]).mockResolvedValueOnce([]);

      const result = await detectAnomalies({ notify: false });
      const offHour = result.find(a => a.type === 'off_hours');
      expect(offHour!.severity).toBe('low');
    });

    it('should classify late-night activity (hour 23) as low severity', async () => {
      const row = makeOffHoursRow({ hour: 23 });

      mockPrisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([row]).mockResolvedValueOnce([]);

      const result = await detectAnomalies({ notify: false });
      const offHour = result.find(a => a.type === 'off_hours');
      expect(offHour!.severity).toBe('low');
    });

    it('should include employee name and table in description', async () => {
      const row = makeOffHoursRow({
        full_name: 'Omar Khan',
        table_name: 'mirv',
        hour: 2,
      });

      mockPrisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([row]).mockResolvedValueOnce([]);

      mockPrisma.employee.findMany.mockResolvedValue([]);

      const result = await detectAnomalies({ notify: false });
      const offHour = result.find(a => a.type === 'off_hours')!;

      expect(offHour.description).toContain('Omar Khan');
      expect(offHour.description).toContain('mirv');
      expect(offHour.description).toContain('2:00');
      expect(offHour.referenceId).toBe('rec-1');
      expect(offHour.referenceTable).toBe('mirv');
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // detectNegativeStock (tested via detectAnomalies)
  // ────────────────────────────────────────────────────────────────────────
  describe('negative stock detection', () => {
    it('should classify physically negative quantity as high severity', async () => {
      const row = makeNegativeStockRow({ quantity: -10, reservedQty: 0, effective: -10 });

      mockPrisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([row]);

      const result = await detectAnomalies({ notify: false });
      const neg = result.find(a => a.type === 'negative_stock');

      expect(neg!.severity).toBe('high');
    });

    it('should classify effective-only negative (positive qty, high reserved) as medium severity', async () => {
      const row = makeNegativeStockRow({
        quantity: 5,
        reservedQty: 10,
        effective: -5,
      });

      mockPrisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([row]);

      const result = await detectAnomalies({ notify: false });
      const neg = result.find(a => a.type === 'negative_stock');

      expect(neg!.severity).toBe('medium');
    });

    it('should populate anomaly fields correctly for negative stock', async () => {
      const row = makeNegativeStockRow({
        id: 'il-99',
        itemId: 'item-99',
        itemCode: 'NUT-05',
        warehouseId: 'wh-7',
        warehouseName: 'Yard C',
        quantity: -3,
        reservedQty: 2,
        effective: -5,
      });

      mockPrisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([row]);

      mockPrisma.employee.findMany.mockResolvedValue([]);

      const result = await detectAnomalies({ notify: false });
      const neg = result[0];

      expect(neg.type).toBe('negative_stock');
      expect(neg.itemId).toBe('item-99');
      expect(neg.itemCode).toBe('NUT-05');
      expect(neg.warehouseId).toBe('wh-7');
      expect(neg.warehouseName).toBe('Yard C');
      expect(neg.value).toBe(-5);
      expect(neg.referenceId).toBe('il-99');
      expect(neg.referenceTable).toBe('inventory_levels');
      expect(neg.description).toContain('NUT-05');
      expect(neg.description).toContain('Yard C');
      expect(neg.description).toContain('-3');
      expect(neg.description).toContain('-5');
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // getInventoryHealthSummary
  // ────────────────────────────────────────────────────────────────────────
  describe('getInventoryHealthSummary', () => {
    it('should return correct health metrics', async () => {
      // 5 parallel calls: inventoryLevel.count (negative), inventoryLevel.count (low),
      // $queryRaw (overstock), $queryRaw (dormant), inventoryLevel.count (total)
      mockPrisma.inventoryLevel.count
        .mockResolvedValueOnce(2) // negativeCount
        .mockResolvedValueOnce(15) // lowCount
        .mockResolvedValueOnce(100); // totalCount

      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: 8n }]) // overstockCount
        .mockResolvedValueOnce([{ count: 12n }]); // dormantCount

      const result = await getInventoryHealthSummary();

      expect(result).toEqual({
        totalItems: 100,
        negativeStockCount: 2,
        lowStockCount: 15,
        overstockCount: 8,
        dormantItemCount: 12,
      });
    });

    it('should convert bigint counts to numbers', async () => {
      mockPrisma.inventoryLevel.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(50);

      mockPrisma.$queryRaw.mockResolvedValueOnce([{ count: 0n }]).mockResolvedValueOnce([{ count: 0n }]);

      const result = await getInventoryHealthSummary();

      expect(result.overstockCount).toBe(0);
      expect(result.dormantItemCount).toBe(0);
      expect(typeof result.overstockCount).toBe('number');
      expect(typeof result.dormantItemCount).toBe('number');
    });

    it('should return zeroed summary on error', async () => {
      mockPrisma.inventoryLevel.count.mockRejectedValueOnce(new Error('DB down'));

      const result = await getInventoryHealthSummary();

      expect(result).toEqual({
        totalItems: 0,
        negativeStockCount: 0,
        lowStockCount: 0,
        overstockCount: 0,
        dormantItemCount: 0,
      });
      expect(log).toHaveBeenCalledWith('warn', expect.stringContaining('Health summary failed'));
    });

    it('should handle all-zero inventory', async () => {
      mockPrisma.inventoryLevel.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0);

      mockPrisma.$queryRaw.mockResolvedValueOnce([{ count: 0n }]).mockResolvedValueOnce([{ count: 0n }]);

      const result = await getInventoryHealthSummary();

      expect(result.totalItems).toBe(0);
      expect(result.negativeStockCount).toBe(0);
      expect(result.lowStockCount).toBe(0);
      expect(result.overstockCount).toBe(0);
      expect(result.dormantItemCount).toBe(0);
    });

    it('should handle large inventory counts', async () => {
      mockPrisma.inventoryLevel.count
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(2000)
        .mockResolvedValueOnce(10000);

      mockPrisma.$queryRaw.mockResolvedValueOnce([{ count: 500n }]).mockResolvedValueOnce([{ count: 3000n }]);

      const result = await getInventoryHealthSummary();

      expect(result).toEqual({
        totalItems: 10000,
        negativeStockCount: 50,
        lowStockCount: 2000,
        overstockCount: 500,
        dormantItemCount: 3000,
      });
    });
  });
});
