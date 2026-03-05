/**
 * SLA Jobs — breach and warning detection.
 *
 * Self-registers two jobs:
 * - sla_breach: every 5 minutes (lock: 4 min)
 * - sla_warning: every 5 minutes (lock: 4 min)
 */

import { registerJob } from '../../../utils/job-registry.js';
import type { JobContext, PrismaDelegate } from '../../../utils/job-registry.js';

// ── SLA Breach Detection ─────────────────────────────────────────────────

async function checkSlaBreaches(ctx: JobContext): Promise<void> {
  try {
    await ctx.refreshSlaConfig();
    const now = new Date();

    await checkApprovalBasedSlaBreaches(ctx, now);
    await checkMrStockVerificationBreaches(ctx, now);
    await checkJoExecutionBreaches(ctx, now);
    await checkGatePassBreaches(ctx, now);
    await checkScrapBuyerPickupBreaches(ctx, now);
    await checkSurplusTimeoutBreaches(ctx, now);
    await checkQciInspectionBreaches(ctx, now);
  } catch (err) {
    ctx.log('error', `[Scheduler] SLA check failed: ${(err as Error).message}`);
  }
}

async function checkApprovalBasedSlaBreaches(ctx: JobContext, now: Date): Promise<void> {
  const models = [{ name: 'mirv', label: 'MIRV' }] as const;

  for (const model of models) {
    const delegate = ctx.getDelegate(model.name);

    const overdue = await delegate.findMany({
      where: {
        status: 'pending_approval',
        slaDueDate: { lt: now },
      },
      select: { id: true, slaDueDate: true },
    } as unknown);

    for (const doc of overdue) {
      const docId = doc.id as string;
      if (await ctx.hasRecentNotification(model.name, docId, 'SLA Breached', now)) continue;

      const pendingStep = await ctx.prisma.approvalStep.findFirst({
        where: {
          documentType: model.name,
          documentId: docId,
          status: 'pending',
        },
        orderBy: { level: 'asc' },
      });

      if (!pendingStep) continue;

      const adminIds = await ctx.getAdminIds();
      const approverIds = await ctx.getEmployeeIdsByRole(pendingStep.approverRole);
      const allRecipients = [...new Set([...adminIds, ...approverIds])];

      await ctx.notifySla({
        recipientIds: allRecipients,
        title: `SLA Breached: ${model.label}`,
        body: `${model.label} ${docId} has exceeded its SLA deadline. Requires ${pendingStep.approverRole} approval.`,
        notificationType: 'sla_breach',
        referenceTable: model.name,
        referenceId: docId,
        socketEvent: 'sla:breached',
        socketRoles: ['admin', pendingStep.approverRole],
      });

      ctx.log('warn', `[Scheduler] SLA breach: ${model.label} ${docId} (approver: ${pendingStep.approverRole})`);
    }
  }
}

async function checkMrStockVerificationBreaches(ctx: JobContext, now: Date): Promise<void> {
  const delegate = ctx.getDelegate('materialRequisition');
  const slaConfig = ctx.getSlaConfig();

  const overdueExplicit = await delegate.findMany({
    where: {
      status: { in: ['approved', 'checking_stock'] },
      slaBreached: false,
      stockVerificationSla: { lt: now },
    },
    select: { id: true, mrfNumber: true, stockVerificationSla: true },
  } as unknown);

  const cutoff = new Date(now.getTime() - ctx.slaHoursToMs(slaConfig.stock_verification));
  const overdueComputed = await delegate.findMany({
    where: {
      status: { in: ['approved', 'checking_stock'] },
      slaBreached: false,
      stockVerificationSla: null,
      approvalDate: { lt: cutoff },
    },
    select: { id: true, mrfNumber: true, approvalDate: true },
  } as unknown);

  const allOverdue = [...overdueExplicit, ...overdueComputed];

  for (const doc of allOverdue) {
    const docId = doc.id as string;
    const docNumber = (doc.mrfNumber as string) || docId;

    if (await ctx.hasRecentNotification('materialRequisition', docId, 'SLA Breached', now)) continue;

    await delegate.update({
      where: { id: docId },
      data: { slaBreached: true },
    } as unknown);

    const adminIds = await ctx.getAdminIds();
    const warehouseIds = await ctx.getEmployeeIdsByRole('warehouse_staff');
    const allRecipients = [...new Set([...adminIds, ...warehouseIds])];

    await ctx.notifySla({
      recipientIds: allRecipients,
      title: 'SLA Breached: Material Requisition',
      body: `MR ${docNumber} has exceeded its stock verification SLA (${slaConfig.stock_verification}h). Warehouse must respond.`,
      notificationType: 'sla_breach',
      referenceTable: 'materialRequisition',
      referenceId: docId,
      socketEvent: 'sla:breached',
      socketRoles: ['admin', 'warehouse_staff', 'warehouse_supervisor'],
    });

    ctx.log('warn', `[Scheduler] SLA breach: MR Stock Verification ${docNumber}`);
  }
}

async function checkJoExecutionBreaches(ctx: JobContext, now: Date): Promise<void> {
  const slaConfig = ctx.getSlaConfig();

  const overdueTracked = await ctx.prisma.joSlaTracking.findMany({
    where: {
      slaDueDate: { lt: now },
      slaMet: null,
      jobOrder: {
        status: { in: ['quoted', 'approved', 'assigned', 'in_progress'] },
      },
    },
    select: {
      id: true,
      jobOrderId: true,
      slaDueDate: true,
      jobOrder: { select: { id: true, joNumber: true, status: true } },
    },
  });

  for (const tracking of overdueTracked) {
    const jo = tracking.jobOrder as { id: string; joNumber: string; status: string };
    const docId = jo.id;

    if (await ctx.hasRecentNotification('jobOrder', docId, 'Execution SLA Breached', now)) continue;

    await ctx.prisma.joSlaTracking.update({
      where: { id: tracking.id },
      data: { slaMet: false },
    });

    const adminIds = await ctx.getAdminIds();
    const logisticsIds = await ctx.getEmployeeIdsByRole('logistics_coordinator');
    const allRecipients = [...new Set([...adminIds, ...logisticsIds])];

    await ctx.notifySla({
      recipientIds: allRecipients,
      title: 'Execution SLA Breached: Job Order',
      body: `JO ${jo.joNumber} has exceeded its execution SLA (${slaConfig.jo_execution}h). Status: ${jo.status}.`,
      notificationType: 'sla_breach',
      referenceTable: 'jobOrder',
      referenceId: docId,
      socketEvent: 'sla:breached',
      socketRoles: ['admin', 'logistics_coordinator', 'manager'],
    });

    ctx.log('warn', `[Scheduler] SLA breach: JO Execution ${jo.joNumber}`);
  }

  const cutoff = new Date(now.getTime() - ctx.slaHoursToMs(slaConfig.jo_execution));
  const overdueNoTracking = await ctx.getDelegate('jobOrder').findMany({
    where: {
      status: 'quoted',
      updatedAt: { lt: cutoff },
      slaTracking: null,
    },
    select: { id: true, joNumber: true },
  } as unknown);

  for (const doc of overdueNoTracking) {
    const docId = doc.id as string;
    const docNumber = (doc.joNumber as string) || docId;

    if (await ctx.hasRecentNotification('jobOrder', docId, 'Execution SLA Breached', now)) continue;

    const adminIds = await ctx.getAdminIds();
    const logisticsIds = await ctx.getEmployeeIdsByRole('logistics_coordinator');
    const allRecipients = [...new Set([...adminIds, ...logisticsIds])];

    await ctx.notifySla({
      recipientIds: allRecipients,
      title: 'Execution SLA Breached: Job Order',
      body: `JO ${docNumber} has exceeded its execution SLA (${slaConfig.jo_execution}h) since quotation.`,
      notificationType: 'sla_breach',
      referenceTable: 'jobOrder',
      referenceId: docId,
      socketEvent: 'sla:breached',
      socketRoles: ['admin', 'logistics_coordinator', 'manager'],
    });

    ctx.log('warn', `[Scheduler] SLA breach: JO Execution (no tracking) ${docNumber}`);
  }
}

async function checkGatePassBreaches(ctx: JobContext, now: Date): Promise<void> {
  const slaConfig = ctx.getSlaConfig();
  const cutoff = new Date(now.getTime() - ctx.slaHoursToMs(slaConfig.gate_pass));
  const delegate = ctx.getDelegate('gatePass');

  const overdue = await delegate.findMany({
    where: {
      status: { in: ['pending', 'approved'] },
      createdAt: { lt: cutoff },
    },
    select: { id: true, gatePassNumber: true, status: true, createdAt: true },
  } as unknown);

  for (const doc of overdue) {
    const docId = doc.id as string;
    const docNumber = (doc.gatePassNumber as string) || docId;

    if (await ctx.hasRecentNotification('gatePass', docId, 'SLA Breached', now)) continue;

    const adminIds = await ctx.getAdminIds();
    const warehouseIds = await ctx.getEmployeeIdsByRole('warehouse_staff');
    const supervisorIds = await ctx.getEmployeeIdsByRole('warehouse_supervisor');
    const allRecipients = [...new Set([...adminIds, ...warehouseIds, ...supervisorIds])];

    await ctx.notifySla({
      recipientIds: allRecipients,
      title: 'SLA Breached: Gate Pass',
      body: `Gate Pass ${docNumber} has exceeded its SLA (${slaConfig.gate_pass}h). Status: ${doc.status}. Must be released.`,
      notificationType: 'sla_breach',
      referenceTable: 'gatePass',
      referenceId: docId,
      socketEvent: 'sla:breached',
      socketRoles: ['admin', 'warehouse_staff', 'warehouse_supervisor'],
    });

    ctx.log('warn', `[Scheduler] SLA breach: Gate Pass ${docNumber}`);
  }
}

async function checkScrapBuyerPickupBreaches(ctx: JobContext, now: Date): Promise<void> {
  const slaConfig = ctx.getSlaConfig();
  const delegate = ctx.getDelegate('scrapItem');

  const overdueExplicit = await delegate.findMany({
    where: {
      status: 'sold',
      buyerPickupDeadline: { lt: now },
    },
    select: { id: true, scrapNumber: true, buyerName: true, buyerPickupDeadline: true },
  } as unknown);

  const cutoff = new Date(now.getTime() - ctx.slaHoursToMs(slaConfig.scrap_buyer_pickup));
  const overdueComputed = await delegate.findMany({
    where: {
      status: 'sold',
      buyerPickupDeadline: null,
      updatedAt: { lt: cutoff },
    },
    select: { id: true, scrapNumber: true, buyerName: true, updatedAt: true },
  } as unknown);

  const allOverdue = [...overdueExplicit, ...overdueComputed];

  for (const doc of allOverdue) {
    const docId = doc.id as string;
    const docNumber = (doc.scrapNumber as string) || docId;
    const buyerName = (doc.buyerName as string) || 'Unknown buyer';

    if (await ctx.hasRecentNotification('scrapItem', docId, 'SLA Breached', now)) continue;

    const adminIds = await ctx.getAdminIds();
    const scrapCommitteeIds = await ctx.getEmployeeIdsByRole('scrap_committee_member');
    const allRecipients = [...new Set([...adminIds, ...scrapCommitteeIds])];

    await ctx.notifySla({
      recipientIds: allRecipients,
      title: 'SLA Breached: Scrap Buyer Pickup',
      body: `Scrap ${docNumber} — buyer "${buyerName}" has not picked up within ${slaConfig.scrap_buyer_pickup / 24} days.`,
      notificationType: 'sla_breach',
      referenceTable: 'scrapItem',
      referenceId: docId,
      socketEvent: 'sla:breached',
      socketRoles: ['admin', 'scrap_committee_member', 'manager'],
    });

    ctx.log('warn', `[Scheduler] SLA breach: Scrap Buyer Pickup ${docNumber}`);
  }
}

async function checkSurplusTimeoutBreaches(ctx: JobContext, now: Date): Promise<void> {
  const slaConfig = ctx.getSlaConfig();
  const cutoff = new Date(now.getTime() - ctx.slaHoursToMs(slaConfig.surplus_timeout));
  const delegate = ctx.getDelegate('surplusItem');

  const overdue = await delegate.findMany({
    where: {
      status: { in: ['identified', 'evaluated'] },
      ouHeadApprovalDate: { lt: cutoff },
    },
    select: { id: true, surplusNumber: true, ouHeadApprovalDate: true, status: true },
  } as unknown);

  for (const doc of overdue) {
    const docId = doc.id as string;
    const docNumber = (doc.surplusNumber as string) || docId;

    if (await ctx.hasRecentNotification('surplusItem', docId, 'SLA Breached', now)) continue;

    const adminIds = await ctx.getAdminIds();
    const managerIds = await ctx.getEmployeeIdsByRole('manager');
    const allRecipients = [...new Set([...adminIds, ...managerIds])];

    await ctx.notifySla({
      recipientIds: allRecipients,
      title: 'SLA Breached: Surplus Timeout',
      body: `Surplus ${docNumber} has exceeded the ${slaConfig.surplus_timeout / 24}-day timeout since OU Head approval. SCM can now approve.`,
      notificationType: 'sla_breach',
      referenceTable: 'surplusItem',
      referenceId: docId,
      socketEvent: 'sla:breached',
      socketRoles: ['admin', 'manager'],
    });

    ctx.log('warn', `[Scheduler] SLA breach: Surplus Timeout ${docNumber}`);
  }
}

async function checkQciInspectionBreaches(ctx: JobContext, now: Date): Promise<void> {
  const slaConfig = ctx.getSlaConfig();
  const cutoff = new Date(now.getTime() - ctx.slaHoursToMs(slaConfig.qc_inspection));
  const delegate = ctx.getDelegate('rfim');

  const overdue = await delegate.findMany({
    where: {
      status: { in: ['pending', 'in_progress'] },
      createdAt: { lt: cutoff },
    },
    select: { id: true, rfimNumber: true, status: true, createdAt: true },
  } as unknown);

  for (const doc of overdue) {
    const docId = doc.id as string;
    const docNumber = (doc.rfimNumber as string) || docId;

    if (await ctx.hasRecentNotification('rfim', docId, 'SLA Breached', now)) continue;

    const adminIds = await ctx.getAdminIds();
    const qcIds = await ctx.getEmployeeIdsByRole('qc_officer');
    const allRecipients = [...new Set([...adminIds, ...qcIds])];

    await ctx.notifySla({
      recipientIds: allRecipients,
      title: 'SLA Breached: QC Inspection',
      body: `QCI ${docNumber} has exceeded its inspection SLA (${slaConfig.qc_inspection / 24} days). Status: ${doc.status}.`,
      notificationType: 'sla_breach',
      referenceTable: 'rfim',
      referenceId: docId,
      socketEvent: 'sla:breached',
      socketRoles: ['admin', 'qc_officer'],
    });

    ctx.log('warn', `[Scheduler] SLA breach: QCI Inspection ${docNumber}`);
  }
}

// ── SLA Warning Detection ────────────────────────────────────────────────

async function checkSlaWarnings(ctx: JobContext): Promise<void> {
  try {
    await ctx.refreshSlaConfig();
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    await checkApprovalBasedSlaWarnings(ctx, now, oneHourFromNow);
    await checkMrStockVerificationWarnings(ctx, now, oneHourFromNow);
    await checkJoExecutionWarnings(ctx, now, oneHourFromNow);
    await checkGatePassWarnings(ctx, now, oneHourFromNow);
    await checkScrapBuyerPickupWarnings(ctx, now, oneHourFromNow);
    await checkSurplusTimeoutWarnings(ctx, now, oneHourFromNow);
    await checkQciInspectionWarnings(ctx, now, oneHourFromNow);
  } catch (err) {
    ctx.log('error', `[Scheduler] SLA warning check failed: ${(err as Error).message}`);
  }
}

async function checkApprovalBasedSlaWarnings(ctx: JobContext, now: Date, oneHourFromNow: Date): Promise<void> {
  const models = [{ name: 'mirv', label: 'MIRV' }] as const;

  for (const model of models) {
    const delegate = ctx.getDelegate(model.name);

    const atRisk = await delegate.findMany({
      where: {
        status: 'pending_approval',
        slaDueDate: { gt: now, lt: oneHourFromNow },
      },
      select: { id: true, slaDueDate: true },
    } as unknown);

    for (const doc of atRisk) {
      const docId = doc.id as string;
      if (await ctx.hasRecentNotification(model.name, docId, 'SLA Warning', now)) continue;

      const pendingStep = await ctx.prisma.approvalStep.findFirst({
        where: {
          documentType: model.name,
          documentId: docId,
          status: 'pending',
        },
        orderBy: { level: 'asc' },
      });

      if (!pendingStep) continue;

      const approverIds = await ctx.getEmployeeIdsByRole(pendingStep.approverRole);

      await ctx.notifySla({
        recipientIds: approverIds,
        title: `SLA Warning: ${model.label}`,
        body: `${model.label} ${docId} SLA deadline is within the next hour. Requires ${pendingStep.approverRole} approval.`,
        notificationType: 'sla_warning',
        referenceTable: model.name,
        referenceId: docId,
        socketEvent: 'sla:warning',
        socketRoles: [pendingStep.approverRole, 'admin'],
      });

      ctx.log('info', `[Scheduler] SLA warning: ${model.label} ${docId}`);
    }
  }
}

async function checkMrStockVerificationWarnings(ctx: JobContext, now: Date, oneHourFromNow: Date): Promise<void> {
  const delegate = ctx.getDelegate('materialRequisition');
  const slaConfig = ctx.getSlaConfig();

  const atRiskExplicit = await delegate.findMany({
    where: {
      status: { in: ['approved', 'checking_stock'] },
      slaBreached: false,
      stockVerificationSla: { gt: now, lt: oneHourFromNow },
    },
    select: { id: true, mrfNumber: true },
  } as unknown);

  const slaMs = ctx.slaHoursToMs(slaConfig.stock_verification);
  const windowStart = new Date(now.getTime() - slaMs);
  const windowEnd = new Date(oneHourFromNow.getTime() - slaMs);
  const atRiskComputed = await delegate.findMany({
    where: {
      status: { in: ['approved', 'checking_stock'] },
      slaBreached: false,
      stockVerificationSla: null,
      approvalDate: { gt: windowStart, lt: windowEnd },
    },
    select: { id: true, mrfNumber: true },
  } as unknown);

  const allAtRisk = [...atRiskExplicit, ...atRiskComputed];

  const warehouseIds = await ctx.getEmployeeIdsByRole('warehouse_staff');

  const atRiskIds = allAtRisk.map(d => d.id as string);
  const recentlyNotified = await ctx.getRecentNotificationRefs('materialRequisition', atRiskIds, 'SLA Warning', now);

  for (const doc of allAtRisk) {
    const docId = doc.id as string;
    const docNumber = (doc.mrfNumber as string) || docId;

    if (recentlyNotified.has(docId)) continue;

    await ctx.notifySla({
      recipientIds: warehouseIds,
      title: 'SLA Warning: Material Requisition',
      body: `MR ${docNumber} stock verification SLA deadline is within the next hour.`,
      notificationType: 'sla_warning',
      referenceTable: 'materialRequisition',
      referenceId: docId,
      socketEvent: 'sla:warning',
      socketRoles: ['warehouse_staff', 'warehouse_supervisor', 'admin'],
    });

    ctx.log('info', `[Scheduler] SLA warning: MR Stock Verification ${docNumber}`);
  }
}

async function checkJoExecutionWarnings(ctx: JobContext, now: Date, oneHourFromNow: Date): Promise<void> {
  const logisticsIds = await ctx.getEmployeeIdsByRole('logistics_coordinator');

  const atRisk = await ctx.prisma.joSlaTracking.findMany({
    where: {
      slaDueDate: { gt: now, lt: oneHourFromNow },
      slaMet: null,
      jobOrder: {
        status: { in: ['quoted', 'approved', 'assigned', 'in_progress'] },
      },
    },
    select: {
      id: true,
      jobOrderId: true,
      jobOrder: { select: { id: true, joNumber: true } },
    },
  });

  const atRiskDocIds = atRisk.map(t => (t.jobOrder as { id: string }).id);
  const recentlyNotified = await ctx.getRecentNotificationRefs('jobOrder', atRiskDocIds, 'Execution SLA Warning', now);

  for (const tracking of atRisk) {
    const jo = tracking.jobOrder as { id: string; joNumber: string };
    const docId = jo.id;

    if (recentlyNotified.has(docId)) continue;

    await ctx.notifySla({
      recipientIds: logisticsIds,
      title: 'Execution SLA Warning: Job Order',
      body: `JO ${jo.joNumber} execution SLA deadline is within the next hour.`,
      notificationType: 'sla_warning',
      referenceTable: 'jobOrder',
      referenceId: docId,
      socketEvent: 'sla:warning',
      socketRoles: ['logistics_coordinator', 'admin'],
    });

    ctx.log('info', `[Scheduler] SLA warning: JO Execution ${jo.joNumber}`);
  }
}

async function checkGatePassWarnings(ctx: JobContext, now: Date, oneHourFromNow: Date): Promise<void> {
  const slaConfig = ctx.getSlaConfig();
  const slaMs = ctx.slaHoursToMs(slaConfig.gate_pass);
  const windowStart = new Date(now.getTime() - slaMs);
  const windowEnd = new Date(oneHourFromNow.getTime() - slaMs);

  const delegate = ctx.getDelegate('gatePass');

  const atRisk = await delegate.findMany({
    where: {
      status: { in: ['pending', 'approved'] },
      createdAt: { gt: windowStart, lt: windowEnd },
    },
    select: { id: true, gatePassNumber: true },
  } as unknown);

  const warehouseIds = await ctx.getEmployeeIdsByRole('warehouse_staff');

  const atRiskIds = atRisk.map(d => d.id as string);
  const recentlyNotified = await ctx.getRecentNotificationRefs('gatePass', atRiskIds, 'SLA Warning', now);

  for (const doc of atRisk) {
    const docId = doc.id as string;
    const docNumber = (doc.gatePassNumber as string) || docId;

    if (recentlyNotified.has(docId)) continue;

    await ctx.notifySla({
      recipientIds: warehouseIds,
      title: 'SLA Warning: Gate Pass',
      body: `Gate Pass ${docNumber} SLA deadline is within the next hour.`,
      notificationType: 'sla_warning',
      referenceTable: 'gatePass',
      referenceId: docId,
      socketEvent: 'sla:warning',
      socketRoles: ['warehouse_staff', 'warehouse_supervisor', 'admin'],
    });

    ctx.log('info', `[Scheduler] SLA warning: Gate Pass ${docNumber}`);
  }
}

async function checkScrapBuyerPickupWarnings(ctx: JobContext, now: Date, oneHourFromNow: Date): Promise<void> {
  const slaConfig = ctx.getSlaConfig();
  const delegate = ctx.getDelegate('scrapItem');

  const atRiskExplicit = await delegate.findMany({
    where: {
      status: 'sold',
      buyerPickupDeadline: { gt: now, lt: oneHourFromNow },
    },
    select: { id: true, scrapNumber: true, buyerName: true },
  } as unknown);

  const slaMs = ctx.slaHoursToMs(slaConfig.scrap_buyer_pickup);
  const windowStart = new Date(now.getTime() - slaMs);
  const windowEnd = new Date(oneHourFromNow.getTime() - slaMs);
  const atRiskComputed = await delegate.findMany({
    where: {
      status: 'sold',
      buyerPickupDeadline: null,
      updatedAt: { gt: windowStart, lt: windowEnd },
    },
    select: { id: true, scrapNumber: true, buyerName: true },
  } as unknown);

  const allAtRisk = [...atRiskExplicit, ...atRiskComputed];

  const scrapCommitteeIds = await ctx.getEmployeeIdsByRole('scrap_committee_member');

  const atRiskIds = allAtRisk.map(d => d.id as string);
  const recentlyNotified = await ctx.getRecentNotificationRefs('scrapItem', atRiskIds, 'SLA Warning', now);

  for (const doc of allAtRisk) {
    const docId = doc.id as string;
    const docNumber = (doc.scrapNumber as string) || docId;

    if (recentlyNotified.has(docId)) continue;

    await ctx.notifySla({
      recipientIds: scrapCommitteeIds,
      title: 'SLA Warning: Scrap Buyer Pickup',
      body: `Scrap ${docNumber} buyer pickup SLA deadline is within the next hour.`,
      notificationType: 'sla_warning',
      referenceTable: 'scrapItem',
      referenceId: docId,
      socketEvent: 'sla:warning',
      socketRoles: ['scrap_committee_member', 'admin'],
    });

    ctx.log('info', `[Scheduler] SLA warning: Scrap Buyer Pickup ${docNumber}`);
  }
}

async function checkSurplusTimeoutWarnings(ctx: JobContext, now: Date, oneHourFromNow: Date): Promise<void> {
  const slaConfig = ctx.getSlaConfig();
  const slaMs = ctx.slaHoursToMs(slaConfig.surplus_timeout);
  const windowStart = new Date(now.getTime() - slaMs);
  const windowEnd = new Date(oneHourFromNow.getTime() - slaMs);

  const delegate = ctx.getDelegate('surplusItem');

  const atRisk = await delegate.findMany({
    where: {
      status: { in: ['identified', 'evaluated'] },
      ouHeadApprovalDate: { gt: windowStart, lt: windowEnd },
    },
    select: { id: true, surplusNumber: true },
  } as unknown);

  const managerIds = await ctx.getEmployeeIdsByRole('manager');

  const atRiskIds = atRisk.map(d => d.id as string);
  const recentlyNotified = await ctx.getRecentNotificationRefs('surplusItem', atRiskIds, 'SLA Warning', now);

  for (const doc of atRisk) {
    const docId = doc.id as string;
    const docNumber = (doc.surplusNumber as string) || docId;

    if (recentlyNotified.has(docId)) continue;

    await ctx.notifySla({
      recipientIds: managerIds,
      title: 'SLA Warning: Surplus Timeout',
      body: `Surplus ${docNumber} timeout SLA deadline is within the next hour. SCM approval will be available.`,
      notificationType: 'sla_warning',
      referenceTable: 'surplusItem',
      referenceId: docId,
      socketEvent: 'sla:warning',
      socketRoles: ['manager', 'admin'],
    });

    ctx.log('info', `[Scheduler] SLA warning: Surplus Timeout ${docNumber}`);
  }
}

async function checkQciInspectionWarnings(ctx: JobContext, now: Date, oneHourFromNow: Date): Promise<void> {
  const slaConfig = ctx.getSlaConfig();
  const slaMs = ctx.slaHoursToMs(slaConfig.qc_inspection);
  const windowStart = new Date(now.getTime() - slaMs);
  const windowEnd = new Date(oneHourFromNow.getTime() - slaMs);

  const delegate = ctx.getDelegate('rfim');

  const atRisk = await delegate.findMany({
    where: {
      status: { in: ['pending', 'in_progress'] },
      createdAt: { gt: windowStart, lt: windowEnd },
    },
    select: { id: true, rfimNumber: true },
  } as unknown);

  const qcIds = await ctx.getEmployeeIdsByRole('qc_officer');

  const atRiskIds = atRisk.map(d => d.id as string);
  const recentlyNotified = await ctx.getRecentNotificationRefs('rfim', atRiskIds, 'SLA Warning', now);

  for (const doc of atRisk) {
    const docId = doc.id as string;
    const docNumber = (doc.rfimNumber as string) || docId;

    if (recentlyNotified.has(docId)) continue;

    await ctx.notifySla({
      recipientIds: qcIds,
      title: 'SLA Warning: QC Inspection',
      body: `QCI ${docNumber} inspection SLA deadline is within the next hour.`,
      notificationType: 'sla_warning',
      referenceTable: 'rfim',
      referenceId: docId,
      socketEvent: 'sla:warning',
      socketRoles: ['qc_officer', 'admin'],
    });

    ctx.log('info', `[Scheduler] SLA warning: QCI Inspection ${docNumber}`);
  }
}

// ── Register Jobs ────────────────────────────────────────────────────────

registerJob({
  name: 'sla_breach',
  intervalMs: 5 * 60 * 1000,
  lockTtlSec: 240,
  handler: checkSlaBreaches,
});

registerJob({
  name: 'sla_warning',
  intervalMs: 5 * 60 * 1000,
  lockTtlSec: 240,
  handler: checkSlaWarnings,
});
