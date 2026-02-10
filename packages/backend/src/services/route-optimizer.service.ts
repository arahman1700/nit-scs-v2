/**
 * Route Optimizer Service
 *
 * Multi-stop route optimization for JO Transport using Haversine distance
 * and nearest-neighbor TSP heuristic. No external APIs required.
 */

import { prisma } from '../utils/prisma.js';
import { log } from '../config/logger.js';

// ── Types ───────────────────────────────────────────────────────────────

export interface RouteStop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  type: 'warehouse' | 'project';
}

export interface OptimizedRouteStop extends RouteStop {
  stopOrder: number;
  distanceFromPrev: number;
  cumulativeDistance: number;
}

export interface OptimizedRoute {
  origin: RouteStop;
  stops: OptimizedRouteStop[];
  totalDistanceKm: number;
  estimatedDurationMinutes: number;
  estimatedFuelLiters: number;
}

export interface UndeliveredJO {
  id: string;
  joNumber: string;
  joType: string;
  status: string;
  description: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  latitude: number | null;
  longitude: number | null;
}

// ── Haversine Distance ──────────────────────────────────────────────────

const EARTH_RADIUS_KM = 6371;

/**
 * Calculate the great-circle distance between two coordinates using the
 * Haversine formula. Returns distance in kilometers.
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

// ── Fuel Estimation ─────────────────────────────────────────────────────

const DEFAULT_FUEL_CONSUMPTION_PER_100KM = 15; // liters per 100km for trucks

/**
 * Estimate fuel cost for a given distance.
 */
export function estimateFuelCost(
  distanceKm: number,
  fuelPricePerLiter: number,
): { fuelLiters: number; totalCost: number } {
  const fuelLiters = (distanceKm / 100) * DEFAULT_FUEL_CONSUMPTION_PER_100KM;
  return {
    fuelLiters: Math.round(fuelLiters * 100) / 100,
    totalCost: Math.round(fuelLiters * fuelPricePerLiter * 100) / 100,
  };
}

// ── Undelivered JOs Query ───────────────────────────────────────────────

/**
 * Get JOs with status 'approved' or 'assigned' that belong to projects
 * with warehouse locations. For each JO, we attempt to resolve a delivery
 * location from the project's associated warehouses.
 */
export async function getUndeliveredJOs(warehouseId: string): Promise<UndeliveredJO[]> {
  // First, validate the warehouse exists
  const warehouse = await prisma.warehouse.findUnique({
    where: { id: warehouseId },
    select: { id: true },
  });

  if (!warehouse) {
    throw new Error(`Warehouse ${warehouseId} not found`);
  }

  // Find JOs in approved/assigned status
  const jobOrders = await prisma.jobOrder.findMany({
    where: {
      status: { in: ['approved', 'assigned'] },
      joType: 'transport',
    },
    include: {
      project: {
        select: {
          id: true,
          projectName: true,
          projectCode: true,
          warehouses: {
            select: {
              latitude: true,
              longitude: true,
            },
            where: {
              latitude: { not: null },
              longitude: { not: null },
            },
            take: 1,
          },
        },
      },
    },
    orderBy: { requestDate: 'asc' },
  });

  return jobOrders.map(jo => {
    // Try to get coordinates from the project's associated warehouse
    const projectWarehouse = jo.project.warehouses[0];
    const lat = projectWarehouse ? Number(projectWarehouse.latitude) : null;
    const lng = projectWarehouse ? Number(projectWarehouse.longitude) : null;

    return {
      id: jo.id,
      joNumber: jo.joNumber,
      joType: jo.joType,
      status: jo.status,
      description: jo.description,
      projectId: jo.project.id,
      projectName: jo.project.projectName,
      projectCode: jo.project.projectCode,
      latitude: lat,
      longitude: lng,
    };
  });
}

// ── Route Optimization (Nearest-Neighbor TSP) ───────────────────────────

/**
 * Optimize the delivery route for a set of JOs starting from a given warehouse.
 *
 * Algorithm: Nearest-neighbor heuristic
 *  1. Start at the origin warehouse
 *  2. Find the nearest unvisited delivery stop
 *  3. Move to it, mark as visited
 *  4. Repeat until all stops visited
 *  5. Return ordered list with distance and time estimates
 *
 * Average speed assumption: 50 km/h for trucks on mixed roads.
 * Fuel consumption: 15 L / 100 km.
 */
export async function optimizeRoute(warehouseId: string, joIds: string[]): Promise<OptimizedRoute> {
  if (joIds.length === 0) {
    throw new Error('At least one Job Order ID is required');
  }

  // Fetch the origin warehouse with coordinates
  const warehouse = await prisma.warehouse.findUnique({
    where: { id: warehouseId },
    select: {
      id: true,
      warehouseName: true,
      latitude: true,
      longitude: true,
    },
  });

  if (!warehouse) {
    throw new Error(`Warehouse ${warehouseId} not found`);
  }
  if (!warehouse.latitude || !warehouse.longitude) {
    throw new Error(`Warehouse ${warehouse.warehouseName} does not have coordinates set`);
  }

  const origin: RouteStop = {
    id: warehouse.id,
    name: warehouse.warehouseName,
    latitude: Number(warehouse.latitude),
    longitude: Number(warehouse.longitude),
    type: 'warehouse',
  };

  // Fetch JOs with their project data
  const jobOrders = await prisma.jobOrder.findMany({
    where: { id: { in: joIds } },
    include: {
      project: {
        select: {
          id: true,
          projectName: true,
          projectCode: true,
          warehouses: {
            select: {
              latitude: true,
              longitude: true,
            },
            where: {
              latitude: { not: null },
              longitude: { not: null },
            },
            take: 1,
          },
        },
      },
    },
  });

  // Build unvisited stops
  const unvisited: Array<RouteStop & { joNumber: string }> = [];
  const skipped: string[] = [];

  for (const jo of jobOrders) {
    const projectWarehouse = jo.project.warehouses[0];
    const lat = projectWarehouse ? Number(projectWarehouse.latitude) : null;
    const lng = projectWarehouse ? Number(projectWarehouse.longitude) : null;

    if (lat !== null && lng !== null) {
      unvisited.push({
        id: jo.id,
        name: `${jo.joNumber} — ${jo.project.projectName}`,
        latitude: lat,
        longitude: lng,
        type: 'project',
        joNumber: jo.joNumber,
      });
    } else {
      skipped.push(jo.joNumber);
    }
  }

  if (skipped.length > 0) {
    log('warn', `[RouteOptimizer] Skipped JOs without coordinates: ${skipped.join(', ')}`);
  }

  if (unvisited.length === 0) {
    throw new Error('None of the selected Job Orders have project locations with coordinates');
  }

  // Nearest-neighbor TSP
  let currentLat = origin.latitude;
  let currentLon = origin.longitude;
  let cumulativeDistance = 0;
  const orderedStops: OptimizedRouteStop[] = [];

  while (unvisited.length > 0) {
    let bestIdx = 0;
    let bestDist = haversineDistance(currentLat, currentLon, unvisited[0]!.latitude, unvisited[0]!.longitude);

    for (let i = 1; i < unvisited.length; i++) {
      const d = haversineDistance(currentLat, currentLon, unvisited[i]!.latitude, unvisited[i]!.longitude);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }

    const nearest = unvisited.splice(bestIdx, 1)[0]!;
    const distFromPrev = Math.round(bestDist * 100) / 100;
    cumulativeDistance += distFromPrev;

    orderedStops.push({
      id: nearest.id,
      name: nearest.name,
      latitude: nearest.latitude,
      longitude: nearest.longitude,
      type: nearest.type,
      stopOrder: orderedStops.length + 1,
      distanceFromPrev: distFromPrev,
      cumulativeDistance: Math.round(cumulativeDistance * 100) / 100,
    });

    currentLat = nearest.latitude;
    currentLon = nearest.longitude;
  }

  const totalDistanceKm = Math.round(cumulativeDistance * 100) / 100;
  const estimatedDurationMinutes = Math.round((totalDistanceKm / 50) * 60); // 50 km/h avg
  const estimatedFuelLiters = Math.round((totalDistanceKm / 100) * DEFAULT_FUEL_CONSUMPTION_PER_100KM * 100) / 100;

  log(
    'info',
    `[RouteOptimizer] Optimized route: ${orderedStops.length} stops, ${totalDistanceKm}km, ~${estimatedDurationMinutes}min`,
  );

  return {
    origin,
    stops: orderedStops,
    totalDistanceKm,
    estimatedDurationMinutes,
    estimatedFuelLiters,
  };
}
