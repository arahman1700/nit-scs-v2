import { prisma } from '../utils/prisma.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';

// ---------------------------------------------------------------------------
// Packing Station Service
// ---------------------------------------------------------------------------

const SESSION_INCLUDE = {
  mirv: {
    include: {
      project: { select: { id: true, projectName: true, projectCode: true } },
    },
  },
  warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
  packedBy: { select: { id: true, firstName: true, lastName: true } },
  lines: {
    include: {
      item: { select: { id: true, itemCode: true, itemDescription: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
};

// ── Packing Queue ───────────────────────────────────────────────────────
// Returns approved MIs that don't yet have a completed packing session.
export async function getPackingQueue(warehouseId: string) {
  const mirvs = await prisma.mirv.findMany({
    where: {
      warehouseId,
      status: 'approved',
      packingSessions: { none: { status: 'completed' } },
    },
    include: {
      project: { select: { id: true, projectName: true, projectCode: true } },
      mirvLines: {
        include: {
          item: { select: { id: true, itemCode: true, itemDescription: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  return mirvs;
}

// ── Create Session ──────────────────────────────────────────────────────
export async function createSession(mirvId: string, packedById: string, warehouseId: string) {
  // Verify MI exists and is approved
  const mirv = await prisma.mirv.findUnique({ where: { id: mirvId } });
  if (!mirv) throw new NotFoundError('MI not found');
  if (mirv.status !== 'approved') {
    throw new BusinessRuleError('MI must be in approved status to start packing');
  }

  // Check no active session already exists for this MI
  const existing = await prisma.packingSession.findFirst({
    where: { mirvId, status: 'in_progress' },
  });
  if (existing) {
    throw new BusinessRuleError('An active packing session already exists for this MI');
  }

  // Generate session number: PACK-YYYY-NNNN
  const year = new Date().getFullYear();
  const count = await prisma.packingSession.count({
    where: {
      sessionNumber: { startsWith: `PACK-${year}-` },
    },
  });
  const sessionNumber = `PACK-${year}-${String(count + 1).padStart(4, '0')}`;

  const session = await prisma.packingSession.create({
    data: {
      sessionNumber,
      mirvId,
      packedById,
      warehouseId,
      status: 'in_progress',
      cartonCount: 0,
      palletCount: 0,
    },
    include: SESSION_INCLUDE,
  });

  return session;
}

// ── Add Packing Line ────────────────────────────────────────────────────
export async function addPackingLine(
  sessionId: string,
  data: {
    itemId: string;
    qtyPacked: number;
    containerType: string;
    containerLabel?: string;
    weight?: number;
    volume?: number;
    scannedBarcode?: string;
  },
) {
  const session = await prisma.packingSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) throw new NotFoundError('Packing session not found');
  if (session.status !== 'in_progress') {
    throw new BusinessRuleError('Cannot add lines to a non-active session');
  }

  const line = await prisma.packingLine.create({
    data: {
      packingSessionId: sessionId,
      itemId: data.itemId,
      qtyPacked: data.qtyPacked,
      containerType: data.containerType,
      containerLabel: data.containerLabel,
      weight: data.weight,
      volume: data.volume,
      scannedBarcode: data.scannedBarcode,
    },
    include: {
      item: { select: { id: true, itemCode: true, itemDescription: true } },
    },
  });

  // Update carton/pallet counts on the session
  if (data.containerType === 'carton') {
    await prisma.packingSession.update({
      where: { id: sessionId },
      data: { cartonCount: { increment: 1 } },
    });
  } else if (data.containerType === 'pallet') {
    await prisma.packingSession.update({
      where: { id: sessionId },
      data: { palletCount: { increment: 1 } },
    });
  }

  return line;
}

// ── Complete Session ────────────────────────────────────────────────────
export async function completeSession(sessionId: string) {
  const session = await prisma.packingSession.findUnique({
    where: { id: sessionId },
    include: { lines: true },
  });
  if (!session) throw new NotFoundError('Packing session not found');
  if (session.status !== 'in_progress') {
    throw new BusinessRuleError('Only in-progress sessions can be completed');
  }
  if (session.lines.length === 0) {
    throw new BusinessRuleError('Cannot complete a session with no packed lines');
  }

  // Sum weight and volume from lines
  const totalWeight = session.lines.reduce((sum, l) => sum + (Number(l.weight) || 0), 0);
  const totalVolume = session.lines.reduce((sum, l) => sum + (Number(l.volume) || 0), 0);

  const updated = await prisma.packingSession.update({
    where: { id: sessionId },
    data: {
      status: 'completed',
      completedAt: new Date(),
      totalWeight,
      totalVolume,
    },
    include: SESSION_INCLUDE,
  });

  return updated;
}

// ── Get Session By Id ───────────────────────────────────────────────────
export async function getSessionById(id: string) {
  const session = await prisma.packingSession.findUnique({
    where: { id },
    include: SESSION_INCLUDE,
  });
  if (!session) throw new NotFoundError('Packing session not found');
  return session;
}

// ── Cancel Session ──────────────────────────────────────────────────────
export async function cancelSession(sessionId: string) {
  const session = await prisma.packingSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) throw new NotFoundError('Packing session not found');
  if (session.status !== 'in_progress') {
    throw new BusinessRuleError('Only in-progress sessions can be cancelled');
  }

  const updated = await prisma.packingSession.update({
    where: { id: sessionId },
    data: { status: 'cancelled' },
    include: SESSION_INCLUDE,
  });

  return updated;
}
