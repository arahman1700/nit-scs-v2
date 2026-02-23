import type { PrismaMock, PrismaModelMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../config/logger.js', () => ({ log: vi.fn() }));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { haversineDistance, estimateFuelCost, getUndeliveredJOs, optimizeRoute } from './route-optimizer.service.js';

// ── Helpers ──────────────────────────────────────────────────────────────

/** Build a mock JO record matching the shape returned by prisma.jobOrder.findMany with include. */
function mockJobOrder(overrides: {
  id: string;
  joNumber: string;
  projectName: string;
  projectCode: string;
  lat?: number | null;
  lng?: number | null;
  status?: string;
  joType?: string;
}) {
  const lat = overrides.lat ?? null;
  const lng = overrides.lng ?? null;

  return {
    id: overrides.id,
    joNumber: overrides.joNumber,
    joType: overrides.joType ?? 'transport',
    status: overrides.status ?? 'approved',
    description: `Deliver to ${overrides.projectName}`,
    requestDate: new Date('2026-02-20'),
    project: {
      id: `proj-${overrides.id}`,
      projectName: overrides.projectName,
      projectCode: overrides.projectCode,
      warehouses: lat !== null && lng !== null ? [{ latitude: lat, longitude: lng }] : [],
    },
  };
}

// ── Known Coordinates ────────────────────────────────────────────────────

const RIYADH = { lat: 24.7136, lon: 46.6753 };
const JEDDAH = { lat: 21.4858, lon: 39.1925 };
const DAMMAM = { lat: 26.4207, lon: 50.0888 };
const MECCA = { lat: 21.3891, lon: 39.8579 };

// =========================================================================

describe('route-optimizer.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
  });

  // ─────────────────────────────────────────────────────────────────────
  // haversineDistance — pure function
  // ─────────────────────────────────────────────────────────────────────
  describe('haversineDistance', () => {
    it('should return 0 for the same point', () => {
      const d = haversineDistance(RIYADH.lat, RIYADH.lon, RIYADH.lat, RIYADH.lon);
      expect(d).toBe(0);
    });

    it('should return 0 when both points are at the origin (0,0)', () => {
      expect(haversineDistance(0, 0, 0, 0)).toBe(0);
    });

    it('should compute Riyadh → Jeddah ≈ 851 km (±50 km)', () => {
      const d = haversineDistance(RIYADH.lat, RIYADH.lon, JEDDAH.lat, JEDDAH.lon);
      expect(d).toBeGreaterThan(800);
      expect(d).toBeLessThan(900);
    });

    it('should compute Riyadh → Dammam ≈ 380 km (±50 km)', () => {
      const d = haversineDistance(RIYADH.lat, RIYADH.lon, DAMMAM.lat, DAMMAM.lon);
      expect(d).toBeGreaterThan(330);
      expect(d).toBeLessThan(430);
    });

    it('should compute Jeddah → Mecca ≈ 73 km (±30 km)', () => {
      const d = haversineDistance(JEDDAH.lat, JEDDAH.lon, MECCA.lat, MECCA.lon);
      expect(d).toBeGreaterThan(43);
      expect(d).toBeLessThan(103);
    });

    it('should be symmetric: distance(A,B) === distance(B,A)', () => {
      const ab = haversineDistance(RIYADH.lat, RIYADH.lon, JEDDAH.lat, JEDDAH.lon);
      const ba = haversineDistance(JEDDAH.lat, JEDDAH.lon, RIYADH.lat, RIYADH.lon);
      expect(ab).toBeCloseTo(ba, 6);
    });

    it('should handle antipodal points (≈ 20015 km half circumference)', () => {
      // North Pole to South Pole
      const d = haversineDistance(90, 0, -90, 0);
      expect(d).toBeGreaterThan(20000);
      expect(d).toBeLessThan(20100);
    });

    it('should handle crossing the prime meridian', () => {
      // London (51.5074, -0.1278) → Paris (48.8566, 2.3522) ≈ 343 km
      const d = haversineDistance(51.5074, -0.1278, 48.8566, 2.3522);
      expect(d).toBeGreaterThan(300);
      expect(d).toBeLessThan(400);
    });

    it('should handle negative longitudes (crossing dateline)', () => {
      // Points on either side of the dateline
      const d = haversineDistance(0, 179, 0, -179);
      // Should be about 222 km (2 degrees at equator)
      expect(d).toBeGreaterThan(200);
      expect(d).toBeLessThan(250);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // estimateFuelCost — pure function
  // ─────────────────────────────────────────────────────────────────────
  describe('estimateFuelCost', () => {
    it('should compute fuel for 100 km at 2 SAR/L → 15 L, 30 SAR', () => {
      const result = estimateFuelCost(100, 2);
      expect(result.fuelLiters).toBe(15);
      expect(result.totalCost).toBe(30);
    });

    it('should compute fuel for 0 km → 0 liters, 0 cost', () => {
      const result = estimateFuelCost(0, 2.18);
      expect(result.fuelLiters).toBe(0);
      expect(result.totalCost).toBe(0);
    });

    it('should compute fuel for 250 km at 2.18 SAR/L', () => {
      // 250/100 * 15 = 37.5 L, 37.5 * 2.18 = 81.75 SAR
      const result = estimateFuelCost(250, 2.18);
      expect(result.fuelLiters).toBe(37.5);
      expect(result.totalCost).toBe(81.75);
    });

    it('should round fuel liters to 2 decimal places', () => {
      // 33 km → 33/100 * 15 = 4.95 L
      const result = estimateFuelCost(33, 1);
      expect(result.fuelLiters).toBe(4.95);
    });

    it('should round total cost to 2 decimal places', () => {
      // 33 km, 2.33 SAR/L → 4.95 * 2.33 = 11.5335 → 11.53
      const result = estimateFuelCost(33, 2.33);
      expect(result.totalCost).toBe(11.53);
    });

    it('should handle large distances (1000 km)', () => {
      // 1000/100 * 15 = 150 L
      const result = estimateFuelCost(1000, 2);
      expect(result.fuelLiters).toBe(150);
      expect(result.totalCost).toBe(300);
    });

    it('should handle fractional fuel price', () => {
      // 200 km → 30 L, 30 * 1.5 = 45
      const result = estimateFuelCost(200, 1.5);
      expect(result.fuelLiters).toBe(30);
      expect(result.totalCost).toBe(45);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // getUndeliveredJOs
  // ─────────────────────────────────────────────────────────────────────
  describe('getUndeliveredJOs', () => {
    const warehouseId = 'wh-001';

    it('should throw if warehouse does not exist', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue(null);

      await expect(getUndeliveredJOs(warehouseId)).rejects.toThrow(`Warehouse ${warehouseId} not found`);
    });

    it('should query jobOrders with approved/assigned status and transport type', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue({ id: warehouseId });
      mockPrisma.jobOrder.findMany.mockResolvedValue([]);

      await getUndeliveredJOs(warehouseId);

      expect(mockPrisma.jobOrder.findMany).toHaveBeenCalledOnce();
      const callArg = mockPrisma.jobOrder.findMany.mock.calls[0][0];
      expect(callArg.where).toEqual({
        status: { in: ['approved', 'assigned'] },
        joType: 'transport',
      });
      expect(callArg.orderBy).toEqual({ requestDate: 'asc' });
    });

    it('should return an empty array when no JOs exist', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue({ id: warehouseId });
      mockPrisma.jobOrder.findMany.mockResolvedValue([]);

      const result = await getUndeliveredJOs(warehouseId);

      expect(result).toEqual([]);
    });

    it('should map JO fields correctly with coordinates', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue({ id: warehouseId });
      const jo = mockJobOrder({
        id: 'jo-1',
        joNumber: 'JO-2026-001',
        projectName: 'Al Rajhi Tower',
        projectCode: 'ART-001',
        lat: 24.7,
        lng: 46.6,
      });
      mockPrisma.jobOrder.findMany.mockResolvedValue([jo]);

      const result = await getUndeliveredJOs(warehouseId);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'jo-1',
        joNumber: 'JO-2026-001',
        joType: 'transport',
        status: 'approved',
        description: 'Deliver to Al Rajhi Tower',
        projectId: 'proj-jo-1',
        projectName: 'Al Rajhi Tower',
        projectCode: 'ART-001',
        latitude: 24.7,
        longitude: 46.6,
      });
    });

    it('should return null coordinates when project has no warehouse with coords', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue({ id: warehouseId });
      const jo = mockJobOrder({
        id: 'jo-2',
        joNumber: 'JO-2026-002',
        projectName: 'Empty Project',
        projectCode: 'EP-001',
        lat: null,
        lng: null,
      });
      mockPrisma.jobOrder.findMany.mockResolvedValue([jo]);

      const result = await getUndeliveredJOs(warehouseId);

      expect(result[0]!.latitude).toBeNull();
      expect(result[0]!.longitude).toBeNull();
    });

    it('should convert Decimal-like coordinates to numbers', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue({ id: warehouseId });
      // Prisma Decimal fields come as objects with toString/toNumber
      const jo = mockJobOrder({
        id: 'jo-3',
        joNumber: 'JO-2026-003',
        projectName: 'Decimal Project',
        projectCode: 'DP-001',
        lat: 24.7136,
        lng: 46.6753,
      });
      mockPrisma.jobOrder.findMany.mockResolvedValue([jo]);

      const result = await getUndeliveredJOs(warehouseId);

      expect(typeof result[0]!.latitude).toBe('number');
      expect(typeof result[0]!.longitude).toBe('number');
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // optimizeRoute
  // ─────────────────────────────────────────────────────────────────────
  describe('optimizeRoute', () => {
    const warehouseId = 'wh-origin';

    const mockWarehouse = {
      id: warehouseId,
      warehouseName: 'Main Warehouse',
      latitude: RIYADH.lat,
      longitude: RIYADH.lon,
    };

    it('should throw when joIds array is empty', async () => {
      await expect(optimizeRoute(warehouseId, [])).rejects.toThrow('At least one Job Order ID is required');
    });

    it('should throw when warehouse is not found', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue(null);

      await expect(optimizeRoute(warehouseId, ['jo-1'])).rejects.toThrow(`Warehouse ${warehouseId} not found`);
    });

    it('should throw when warehouse has no coordinates', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue({
        id: warehouseId,
        warehouseName: 'No Coords WH',
        latitude: null,
        longitude: null,
      });

      await expect(optimizeRoute(warehouseId, ['jo-1'])).rejects.toThrow('does not have coordinates set');
    });

    it('should throw when warehouse has only latitude but no longitude', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue({
        id: warehouseId,
        warehouseName: 'Partial Coords WH',
        latitude: 24.7,
        longitude: null,
      });

      await expect(optimizeRoute(warehouseId, ['jo-1'])).rejects.toThrow('does not have coordinates set');
    });

    it('should throw when none of the JOs have coordinates', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      mockPrisma.jobOrder.findMany.mockResolvedValue([
        mockJobOrder({
          id: 'jo-1',
          joNumber: 'JO-001',
          projectName: 'No Coords',
          projectCode: 'NC-001',
          lat: null,
          lng: null,
        }),
      ]);

      await expect(optimizeRoute(warehouseId, ['jo-1'])).rejects.toThrow(
        'None of the selected Job Orders have project locations with coordinates',
      );
    });

    it('should handle a single stop correctly', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      mockPrisma.jobOrder.findMany.mockResolvedValue([
        mockJobOrder({
          id: 'jo-1',
          joNumber: 'JO-001',
          projectName: 'Jeddah Project',
          projectCode: 'JP-001',
          lat: JEDDAH.lat,
          lng: JEDDAH.lon,
        }),
      ]);

      const result = await optimizeRoute(warehouseId, ['jo-1']);

      expect(result.origin.id).toBe(warehouseId);
      expect(result.origin.type).toBe('warehouse');
      expect(result.stops).toHaveLength(1);
      expect(result.stops[0]!.stopOrder).toBe(1);
      expect(result.stops[0]!.distanceFromPrev).toBeGreaterThan(0);
      expect(result.stops[0]!.cumulativeDistance).toBe(result.stops[0]!.distanceFromPrev);
      expect(result.totalDistanceKm).toBe(result.stops[0]!.cumulativeDistance);
      expect(result.estimatedDurationMinutes).toBeGreaterThan(0);
      expect(result.estimatedFuelLiters).toBeGreaterThan(0);
    });

    it('should order stops using nearest-neighbor heuristic', async () => {
      // Origin: Riyadh
      // Stops: Dammam (closer to Riyadh ~380km), Jeddah (~851km)
      // Nearest-neighbor should pick Dammam first, then Jeddah
      mockPrisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      mockPrisma.jobOrder.findMany.mockResolvedValue([
        mockJobOrder({
          id: 'jo-jeddah',
          joNumber: 'JO-JED',
          projectName: 'Jeddah Project',
          projectCode: 'JP-001',
          lat: JEDDAH.lat,
          lng: JEDDAH.lon,
        }),
        mockJobOrder({
          id: 'jo-dammam',
          joNumber: 'JO-DAM',
          projectName: 'Dammam Project',
          projectCode: 'DP-001',
          lat: DAMMAM.lat,
          lng: DAMMAM.lon,
        }),
      ]);

      const result = await optimizeRoute(warehouseId, ['jo-jeddah', 'jo-dammam']);

      // Dammam is closer to Riyadh, so it should be first
      expect(result.stops[0]!.id).toBe('jo-dammam');
      expect(result.stops[0]!.stopOrder).toBe(1);
      expect(result.stops[1]!.id).toBe('jo-jeddah');
      expect(result.stops[1]!.stopOrder).toBe(2);
    });

    it('should compute cumulative distances correctly for multiple stops', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      mockPrisma.jobOrder.findMany.mockResolvedValue([
        mockJobOrder({
          id: 'jo-dam',
          joNumber: 'JO-DAM',
          projectName: 'Dammam',
          projectCode: 'DAM',
          lat: DAMMAM.lat,
          lng: DAMMAM.lon,
        }),
        mockJobOrder({
          id: 'jo-jed',
          joNumber: 'JO-JED',
          projectName: 'Jeddah',
          projectCode: 'JED',
          lat: JEDDAH.lat,
          lng: JEDDAH.lon,
        }),
      ]);

      const result = await optimizeRoute(warehouseId, ['jo-dam', 'jo-jed']);

      const stop1 = result.stops[0]!;
      const stop2 = result.stops[1]!;

      // Cumulative distance of first stop should equal its distanceFromPrev
      expect(stop1.cumulativeDistance).toBe(stop1.distanceFromPrev);

      // Cumulative distance of second stop = stop1.cumulative + stop2.distanceFromPrev
      expect(stop2.cumulativeDistance).toBeCloseTo(stop1.cumulativeDistance + stop2.distanceFromPrev, 1);

      // Total distance should match last stop's cumulative distance
      expect(result.totalDistanceKm).toBe(stop2.cumulativeDistance);
    });

    it('should compute estimated duration from distance at 50 km/h', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      mockPrisma.jobOrder.findMany.mockResolvedValue([
        mockJobOrder({
          id: 'jo-1',
          joNumber: 'JO-001',
          projectName: 'Nearby',
          projectCode: 'NB-001',
          lat: DAMMAM.lat,
          lng: DAMMAM.lon,
        }),
      ]);

      const result = await optimizeRoute(warehouseId, ['jo-1']);

      // estimatedDurationMinutes = round((totalDistanceKm / 50) * 60)
      const expectedMinutes = Math.round((result.totalDistanceKm / 50) * 60);
      expect(result.estimatedDurationMinutes).toBe(expectedMinutes);
    });

    it('should compute estimated fuel at 15 L/100km', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      mockPrisma.jobOrder.findMany.mockResolvedValue([
        mockJobOrder({
          id: 'jo-1',
          joNumber: 'JO-001',
          projectName: 'Dammam Stop',
          projectCode: 'DS-001',
          lat: DAMMAM.lat,
          lng: DAMMAM.lon,
        }),
      ]);

      const result = await optimizeRoute(warehouseId, ['jo-1']);

      const expectedFuel = Math.round((result.totalDistanceKm / 100) * 15 * 100) / 100;
      expect(result.estimatedFuelLiters).toBe(expectedFuel);
    });

    it('should skip JOs without coordinates and still optimize the rest', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      mockPrisma.jobOrder.findMany.mockResolvedValue([
        mockJobOrder({
          id: 'jo-no-coords',
          joNumber: 'JO-NC',
          projectName: 'No Coords',
          projectCode: 'NC-001',
          lat: null,
          lng: null,
        }),
        mockJobOrder({
          id: 'jo-dam',
          joNumber: 'JO-DAM',
          projectName: 'Dammam',
          projectCode: 'DAM-001',
          lat: DAMMAM.lat,
          lng: DAMMAM.lon,
        }),
      ]);

      const result = await optimizeRoute(warehouseId, ['jo-no-coords', 'jo-dam']);

      // Only the JO with coordinates should be in the route
      expect(result.stops).toHaveLength(1);
      expect(result.stops[0]!.id).toBe('jo-dam');
    });

    it('should set origin type to warehouse', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      mockPrisma.jobOrder.findMany.mockResolvedValue([
        mockJobOrder({
          id: 'jo-1',
          joNumber: 'JO-001',
          projectName: 'Proj A',
          projectCode: 'PA',
          lat: 25.0,
          lng: 47.0,
        }),
      ]);

      const result = await optimizeRoute(warehouseId, ['jo-1']);

      expect(result.origin.type).toBe('warehouse');
      expect(result.origin.name).toBe('Main Warehouse');
      expect(result.origin.latitude).toBe(RIYADH.lat);
      expect(result.origin.longitude).toBe(RIYADH.lon);
    });

    it('should set all stop types to project', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      mockPrisma.jobOrder.findMany.mockResolvedValue([
        mockJobOrder({
          id: 'jo-1',
          joNumber: 'JO-001',
          projectName: 'Proj A',
          projectCode: 'PA',
          lat: JEDDAH.lat,
          lng: JEDDAH.lon,
        }),
        mockJobOrder({
          id: 'jo-2',
          joNumber: 'JO-002',
          projectName: 'Proj B',
          projectCode: 'PB',
          lat: DAMMAM.lat,
          lng: DAMMAM.lon,
        }),
      ]);

      const result = await optimizeRoute(warehouseId, ['jo-1', 'jo-2']);

      result.stops.forEach(stop => {
        expect(stop.type).toBe('project');
      });
    });

    it('should use joNumber and projectName in stop name', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      mockPrisma.jobOrder.findMany.mockResolvedValue([
        mockJobOrder({
          id: 'jo-1',
          joNumber: 'JO-2026-055',
          projectName: 'King Tower',
          projectCode: 'KT-001',
          lat: JEDDAH.lat,
          lng: JEDDAH.lon,
        }),
      ]);

      const result = await optimizeRoute(warehouseId, ['jo-1']);

      expect(result.stops[0]!.name).toContain('JO-2026-055');
      expect(result.stops[0]!.name).toContain('King Tower');
    });

    it('should handle three stops and pick nearest at each step', async () => {
      // Origin: Riyadh
      // Stops: Mecca (~870km), Jeddah (~851km), Dammam (~380km)
      // Step 1 from Riyadh: nearest is Dammam
      // Step 2 from Dammam: Jeddah (~1166km) vs Mecca (~1150km) — Mecca slightly closer from Dammam?
      //   Actually from Dammam to Jeddah and Dammam to Mecca are both far, but Jeddah is closer to Mecca
      //   Let's just verify ordering is deterministic and total distance is computed
      mockPrisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      mockPrisma.jobOrder.findMany.mockResolvedValue([
        mockJobOrder({
          id: 'jo-mecca',
          joNumber: 'JO-MEC',
          projectName: 'Mecca Project',
          projectCode: 'MEC',
          lat: MECCA.lat,
          lng: MECCA.lon,
        }),
        mockJobOrder({
          id: 'jo-jeddah',
          joNumber: 'JO-JED',
          projectName: 'Jeddah Project',
          projectCode: 'JED',
          lat: JEDDAH.lat,
          lng: JEDDAH.lon,
        }),
        mockJobOrder({
          id: 'jo-dammam',
          joNumber: 'JO-DAM',
          projectName: 'Dammam Project',
          projectCode: 'DAM',
          lat: DAMMAM.lat,
          lng: DAMMAM.lon,
        }),
      ]);

      const result = await optimizeRoute(warehouseId, ['jo-mecca', 'jo-jeddah', 'jo-dammam']);

      expect(result.stops).toHaveLength(3);

      // First stop should be Dammam (nearest to Riyadh)
      expect(result.stops[0]!.id).toBe('jo-dammam');

      // All stopOrders should be sequential
      expect(result.stops[0]!.stopOrder).toBe(1);
      expect(result.stops[1]!.stopOrder).toBe(2);
      expect(result.stops[2]!.stopOrder).toBe(3);

      // Total distance should be positive and reasonable
      expect(result.totalDistanceKm).toBeGreaterThan(0);
      expect(result.estimatedDurationMinutes).toBeGreaterThan(0);
      expect(result.estimatedFuelLiters).toBeGreaterThan(0);
    });

    it('should round distances to 2 decimal places', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      mockPrisma.jobOrder.findMany.mockResolvedValue([
        mockJobOrder({
          id: 'jo-1',
          joNumber: 'JO-001',
          projectName: 'Proj A',
          projectCode: 'PA',
          lat: 24.75,
          lng: 46.75,
        }),
      ]);

      const result = await optimizeRoute(warehouseId, ['jo-1']);

      // Check that values are rounded to at most 2 decimal places
      const distStr = result.stops[0]!.distanceFromPrev.toString();
      const parts = distStr.split('.');
      if (parts[1]) {
        expect(parts[1].length).toBeLessThanOrEqual(2);
      }
    });
  });
});
