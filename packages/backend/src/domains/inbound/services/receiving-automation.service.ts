/**
 * Receiving Automation Service — P6
 *
 * Orchestrates the full GRN receiving workflow:
 * GRN Approval → LPN Creation → WMS Task Generation → Putaway Assignment
 *
 * This connects the inbound GRN flow with warehouse-ops task queue,
 * LPN tracking, and put-away rule engine.
 */
import { prisma } from '../../../utils/prisma.js';
import { NotFoundError } from '@nit-scs-v2/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReceivingPlan {
  grnId: string;
  grnNumber: string;
  warehouseId: string;
  lines: ReceivingLinePlan[];
}

export interface ReceivingLinePlan {
  lineId: string;
  itemId: string;
  itemCode: string;
  quantity: number;
  suggestedLpnType: string;
  suggestedZoneId: string | null;
  suggestedBinId: string | null;
  putawayRuleId: string | null;
  requiresInspection: boolean;
}

// ---------------------------------------------------------------------------
// Generate Receiving Plan — suggests LPN + putaway for each GRN line
// ---------------------------------------------------------------------------

export async function generateReceivingPlan(grnId: string): Promise<ReceivingPlan> {
  const grn = await prisma.mrrv.findUnique({
    where: { id: grnId },
    include: {
      mrrvLines: {
        include: {
          item: { select: { id: true, itemCode: true, category: true, itemDescription: true } },
        },
      },
    },
  });

  if (!grn) throw new NotFoundError('Mrrv', grnId);
  if (!['qc_approved', 'received', 'stored'].includes(grn.status)) {
    throw new Error(`GRN must be qc_approved/received/stored to generate receiving plan, got '${grn.status}'`);
  }

  // Load put-away rules for this warehouse, ordered by priority
  const putawayRules = await prisma.putAwayRule.findMany({
    where: { warehouseId: grn.warehouseId, isActive: true },
    orderBy: { priority: 'asc' },
  });

  // Load available zones for putaway suggestions
  const zones = await prisma.warehouseZone.findMany({
    where: { warehouseId: grn.warehouseId },
    include: {
      binLocations: {
        where: { isActive: true },
        orderBy: { currentOccupancy: 'asc' },
        take: 1,
      },
    },
  });

  const lines: ReceivingLinePlan[] = grn.mrrvLines.map(line => {
    const qty = Number(line.qtyReceived ?? 0);
    const category = line.item.category;

    // Match put-away rule by item category
    const matchedRule = putawayRules.find(r => r.itemCategory === category);

    // Suggest zone from rule or first available
    let suggestedZoneId: string | null = matchedRule?.targetZoneId ?? null;
    let suggestedBinId: string | null = null;

    if (suggestedZoneId) {
      const zone = zones.find(z => z.id === suggestedZoneId);
      if (zone?.binLocations[0]) {
        suggestedBinId = zone.binLocations[0].id;
      }
    } else if (zones.length > 0) {
      // Fallback: find zone with available bins
      for (const zone of zones) {
        if (zone.binLocations.length > 0) {
          suggestedZoneId = zone.id;
          suggestedBinId = zone.binLocations[0].id;
          break;
        }
      }
    }

    // Determine LPN type based on quantity
    const suggestedLpnType = qty > 100 ? 'pallet' : qty > 10 ? 'carton' : 'tote';

    return {
      lineId: line.id,
      itemId: line.itemId,
      itemCode: line.item.itemCode,
      quantity: qty,
      suggestedLpnType,
      suggestedZoneId,
      suggestedBinId,
      putawayRuleId: matchedRule?.id ?? null,
      requiresInspection: grn.rfimRequired ?? false,
    };
  });

  return {
    grnId: grn.id,
    grnNumber: grn.mrrvNumber,
    warehouseId: grn.warehouseId,
    lines,
  };
}

// ---------------------------------------------------------------------------
// Execute Receiving — create LPNs + WMS tasks from a plan
// ---------------------------------------------------------------------------

export async function executeReceiving(plan: ReceivingPlan, createdById?: string) {
  const results: {
    lpnId: string;
    lpnNumber: string;
    taskId: string;
    taskNumber: string;
    lineId: string;
  }[] = [];

  // Generate sequential numbers
  const timestamp = Date.now().toString(36).toUpperCase();

  for (let i = 0; i < plan.lines.length; i++) {
    const line = plan.lines[i];
    const seq = String(i + 1).padStart(3, '0');

    // 1. Create LPN
    const lpn = await prisma.licensePlate.create({
      data: {
        lpnNumber: `LPN-${timestamp}-${seq}`,
        warehouseId: plan.warehouseId,
        lpnType: line.suggestedLpnType,
        status: 'in_receiving',
        sourceDocType: 'grn',
        sourceDocId: plan.grnId,
        createdById,
      },
    });

    // 2. Add content to LPN
    await prisma.lpnContent.create({
      data: {
        lpnId: lpn.id,
        itemId: line.itemId,
        quantity: line.quantity,
      },
    });

    // 3. Create putaway WMS task
    const task = await prisma.wmsTask.create({
      data: {
        taskNumber: `TSK-PA-${timestamp}-${seq}`,
        warehouseId: plan.warehouseId,
        taskType: 'putaway',
        priority: line.requiresInspection ? 2 : 3,
        status: 'pending',
        sourceDocType: 'grn',
        sourceDocId: plan.grnId,
        toZoneId: line.suggestedZoneId,
        toBinId: line.suggestedBinId,
        itemId: line.itemId,
        quantity: line.quantity,
      },
    });

    results.push({
      lpnId: lpn.id,
      lpnNumber: lpn.lpnNumber,
      taskId: task.id,
      taskNumber: task.taskNumber,
      lineId: line.lineId,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Auto-receive GRN — full automation: plan + execute in one call
// ---------------------------------------------------------------------------

export async function autoReceiveGrn(grnId: string, createdById?: string) {
  const plan = await generateReceivingPlan(grnId);
  const results = await executeReceiving(plan, createdById);

  // Update GRN status to received if not already
  const grn = await prisma.mrrv.findUnique({ where: { id: grnId } });
  if (grn && grn.status !== 'received') {
    await prisma.mrrv.update({
      where: { id: grnId },
      data: { status: 'received' },
    });
  }

  return {
    grnId,
    grnNumber: plan.grnNumber,
    warehouseId: plan.warehouseId,
    lpnsCreated: results.length,
    tasksCreated: results.length,
    details: results,
  };
}

// ---------------------------------------------------------------------------
// Calculate customs duties for an ASN (tariff integration)
// ---------------------------------------------------------------------------

export async function calculateAsnDuties(asnId: string) {
  const asn = await prisma.advanceShippingNotice.findUnique({
    where: { id: asnId },
    include: {
      lines: {
        include: {
          item: { select: { id: true, itemCode: true, standardCost: true, category: true } },
        },
      },
    },
  });

  if (!asn) throw new NotFoundError('AdvanceShippingNotice', asnId);

  const duties: {
    itemId: string;
    itemCode: string;
    dutyRate: number;
    vatRate: number;
    estimatedDuty: number;
    estimatedVat: number;
  }[] = [];

  // Default Saudi VAT and duty rates
  const defaultVatRate = 15;
  const defaultDutyRate = 5;

  for (const line of asn.lines) {
    const unitCost = Number(line.item.standardCost ?? 0);
    const qty = Number(line.qtyExpected);
    const lineValue = unitCost * qty;

    const estimatedDuty = lineValue * (defaultDutyRate / 100);
    const estimatedVat = (lineValue + estimatedDuty) * (defaultVatRate / 100);

    duties.push({
      itemId: line.itemId,
      itemCode: line.item.itemCode,
      dutyRate: defaultDutyRate,
      vatRate: defaultVatRate,
      estimatedDuty: Math.round(estimatedDuty * 100) / 100,
      estimatedVat: Math.round(estimatedVat * 100) / 100,
    });
  }

  const totalDuty = duties.reduce((sum, d) => sum + d.estimatedDuty, 0);
  const totalVat = duties.reduce((sum, d) => sum + d.estimatedVat, 0);

  return {
    asnId,
    asnNumber: asn.asnNumber,
    lineCount: duties.length,
    totalEstimatedDuty: Math.round(totalDuty * 100) / 100,
    totalEstimatedVat: Math.round(totalVat * 100) / 100,
    totalEstimatedCost: Math.round((totalDuty + totalVat) * 100) / 100,
    lines: duties,
  };
}
