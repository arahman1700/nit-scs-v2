import { prisma } from '../utils/prisma.js';
import { log } from '../config/logger.js';

// ── Types ───────────────────────────────────────────────────────────────

export interface AssignmentCreateDto {
  zoneId: string;
  warehouseId: string;
  itemId: string;
  sourceDocType: 'grn' | 'mi' | 'wt' | 'cross_dock';
  sourceDocId: string;
  quantity: number;
  direction: 'inbound' | 'outbound';
  maxDwellHours?: number;
  notes?: string;
}

export interface AssignmentListParams {
  warehouseId?: string;
  zoneId?: string;
  status?: string;
  direction?: string;
  page: number;
  pageSize: number;
}

// ── Includes ─────────────────────────────────────────────────────────────

const ASSIGNMENT_INCLUDE = {
  zone: {
    select: { id: true, zoneName: true, zoneCode: true, zoneType: true, capacity: true, currentOccupancy: true },
  },
  item: { select: { id: true, code: true, name: true, category: true } },
  assignedBy: { select: { id: true, name: true, employeeCode: true } },
} as const;

// ############################################################################
// STAGING ZONES
// ############################################################################

export async function listStagingZones(warehouseId: string) {
  const zones = await prisma.warehouseZone.findMany({
    where: {
      warehouseId,
      zoneType: { startsWith: 'staging_' },
    },
    orderBy: { zoneName: 'asc' },
  });

  // Count active assignments per zone
  const counts = await prisma.stagingAssignment.groupBy({
    by: ['zoneId'],
    where: {
      warehouseId,
      status: 'staged',
    },
    _count: { id: true },
    _sum: { quantity: true },
  });

  const countMap = new Map(counts.map(c => [c.zoneId, { count: c._count.id, totalQty: c._sum.quantity ?? 0 }]));

  return zones.map(zone => ({
    ...zone,
    activeAssignments: countMap.get(zone.id)?.count ?? 0,
    totalStagedQty: countMap.get(zone.id)?.totalQty ?? 0,
  }));
}

// ############################################################################
// ASSIGNMENTS CRUD
// ############################################################################

export async function listAssignments(params: AssignmentListParams) {
  const where: Record<string, unknown> = {};
  if (params.warehouseId) where.warehouseId = params.warehouseId;
  if (params.zoneId) where.zoneId = params.zoneId;
  if (params.status) where.status = params.status;
  if (params.direction) where.direction = params.direction;

  const [data, total] = await Promise.all([
    prisma.stagingAssignment.findMany({
      where,
      orderBy: { stagedAt: 'desc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: ASSIGNMENT_INCLUDE,
    }),
    prisma.stagingAssignment.count({ where }),
  ]);

  return { data, total };
}

export async function createAssignment(data: AssignmentCreateDto, userId: string) {
  const assignment = await prisma.stagingAssignment.create({
    data: {
      zoneId: data.zoneId,
      warehouseId: data.warehouseId,
      itemId: data.itemId,
      sourceDocType: data.sourceDocType,
      sourceDocId: data.sourceDocId,
      quantity: data.quantity,
      direction: data.direction,
      maxDwellHours: data.maxDwellHours ?? 24,
      notes: data.notes ?? null,
      assignedById: userId,
    },
    include: ASSIGNMENT_INCLUDE,
  });

  // Increment zone occupancy
  await prisma.warehouseZone.update({
    where: { id: data.zoneId },
    data: { currentOccupancy: { increment: 1 } },
  });

  log('info', `[Staging] Created assignment ${assignment.id} in zone ${data.zoneId}`);
  return assignment;
}

export async function moveFromStaging(id: string, _userId: string) {
  const assignment = await prisma.stagingAssignment.findUniqueOrThrow({ where: { id } });

  if (assignment.status !== 'staged') {
    throw new Error(`Cannot move assignment with status: ${assignment.status}`);
  }

  const updated = await prisma.stagingAssignment.update({
    where: { id },
    data: { status: 'moved', movedAt: new Date() },
    include: ASSIGNMENT_INCLUDE,
  });

  // Decrement zone occupancy
  await prisma.warehouseZone.update({
    where: { id: assignment.zoneId },
    data: { currentOccupancy: { decrement: 1 } },
  });

  log('info', `[Staging] Moved assignment ${id} from staging`);
  return updated;
}

// ############################################################################
// ALERTS & OCCUPANCY
// ############################################################################

export async function getOverstayAlerts(warehouseId: string) {
  const assignments = await prisma.stagingAssignment.findMany({
    where: { warehouseId, status: 'staged' },
    include: { ...ASSIGNMENT_INCLUDE },
  });

  const now = new Date();
  return assignments.filter(a => {
    const dwellMs = (a.maxDwellHours ?? 24) * 60 * 60 * 1000;
    return now.getTime() - a.stagedAt.getTime() > dwellMs;
  });
}

export async function getStagingOccupancy(warehouseId: string) {
  const zones = await prisma.warehouseZone.findMany({
    where: {
      warehouseId,
      zoneType: { startsWith: 'staging_' },
    },
    orderBy: { zoneName: 'asc' },
  });

  const stats = await prisma.stagingAssignment.groupBy({
    by: ['zoneId'],
    where: {
      warehouseId,
      status: 'staged',
    },
    _count: { id: true },
    _sum: { quantity: true },
  });

  const statsMap = new Map(stats.map(s => [s.zoneId, { count: s._count.id, totalQty: s._sum.quantity ?? 0 }]));

  return zones.map(zone => ({
    zoneId: zone.id,
    zoneName: zone.zoneName,
    zoneCode: zone.zoneCode,
    zoneType: zone.zoneType,
    capacity: zone.capacity ?? 0,
    currentOccupancy: zone.currentOccupancy ?? 0,
    stagedCount: statsMap.get(zone.id)?.count ?? 0,
    stagedQty: statsMap.get(zone.id)?.totalQty ?? 0,
    utilizationPct: zone.capacity ? Math.round(((zone.currentOccupancy ?? 0) / zone.capacity) * 100) : 0,
  }));
}
