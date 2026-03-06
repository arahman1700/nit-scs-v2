/**
 * Annual Maintenance Contract (AMC) Service — SOW M1
 * Prisma model: AnnualMaintenanceContract (table: annual_maintenance_contracts)
 * State flow: draft -> active -> expired / terminated
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../../utils/prisma.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';
import { eventBus } from '../../../events/event-bus.js';
import { generateDocumentNumber } from '../../system/services/document-number.service.js';
import { createNotification } from '../../system/services/notification.service.js';
import type { AmcCreateDto, AmcUpdateDto, ListParams } from '../../../types/dto.js';

const LIST_INCLUDE = {
  supplier: { select: { id: true, supplierName: true, supplierCode: true } },
  equipmentType: { select: { id: true, typeName: true } },
  createdBy: { select: { id: true, fullName: true } },
} satisfies Prisma.AnnualMaintenanceContractInclude;

const DETAIL_INCLUDE = {
  supplier: {
    select: { id: true, supplierName: true, supplierCode: true, contactPerson: true, phone: true, email: true },
  },
  equipmentType: { select: { id: true, typeName: true } },
  createdBy: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.AnnualMaintenanceContractInclude;

// ── List (paginated, searchable, filterable) ──────────────────────────────

export async function list(params: ListParams) {
  const where: Prisma.AnnualMaintenanceContractWhereInput = {};

  if (params.status) where.status = params.status as string;
  if (params.supplierId) where.supplierId = params.supplierId as string;
  if (params.equipmentTypeId) where.equipmentTypeId = params.equipmentTypeId as string;

  if (params.search) {
    where.OR = [
      { contractNumber: { contains: params.search, mode: 'insensitive' } },
      { supplier: { supplierName: { contains: params.search, mode: 'insensitive' } } },
      { notes: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const sortBy = params.sortBy || 'createdAt';
  const sortDir = params.sortDir || 'desc';

  const [data, total] = await Promise.all([
    prisma.annualMaintenanceContract.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      skip: params.skip,
      take: params.pageSize,
      include: LIST_INCLUDE,
    }),
    prisma.annualMaintenanceContract.count({ where }),
  ]);

  return { data, total };
}

// ── Get by ID ─────────────────────────────────────────────────────────────

export async function getById(id: string) {
  const record = await prisma.annualMaintenanceContract.findUnique({
    where: { id },
    include: DETAIL_INCLUDE,
  });
  if (!record) throw new NotFoundError('AnnualMaintenanceContract', id);
  return record;
}

// ── Create ────────────────────────────────────────────────────────────────

export async function create(data: AmcCreateDto, userId: string) {
  const contractNumber = await generateDocumentNumber('amc');

  // Validate dates
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  if (end <= start) {
    throw new BusinessRuleError('End date must be after start date');
  }

  const amc = await prisma.annualMaintenanceContract.create({
    data: {
      contractNumber,
      supplierId: data.supplierId,
      equipmentTypeId: data.equipmentTypeId,
      startDate: start,
      endDate: end,
      contractValue: data.contractValue,
      coverageType: data.coverageType,
      responseTimeSlaHours: data.responseTimeSlaHours,
      preventiveMaintenanceFrequency: data.preventiveMaintenanceFrequency,
      includesSpares: data.includesSpares ?? false,
      maxCallouts: data.maxCallouts ?? null,
      notes: data.notes ?? null,
      status: 'draft',
      createdById: userId,
    },
    include: LIST_INCLUDE,
  });

  eventBus.publish({
    type: 'document:created',
    entityType: 'amc',
    entityId: amc.id,
    action: 'create',
    payload: { contractNumber, supplierId: data.supplierId },
    performedById: userId,
    timestamp: new Date().toISOString(),
  });

  return amc;
}

// ── Update (only draft contracts) ─────────────────────────────────────────

export async function update(id: string, data: AmcUpdateDto) {
  const existing = await prisma.annualMaintenanceContract.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('AnnualMaintenanceContract', id);

  if (existing.status !== 'draft') {
    throw new BusinessRuleError('Only contracts in "draft" status can be updated');
  }

  // Validate dates if provided
  if (data.startDate || data.endDate) {
    const start = data.startDate ? new Date(data.startDate) : existing.startDate;
    const end = data.endDate ? new Date(data.endDate) : existing.endDate;
    if (end <= start) {
      throw new BusinessRuleError('End date must be after start date');
    }
  }

  return prisma.annualMaintenanceContract.update({
    where: { id },
    data: {
      ...data,
      ...(data.startDate ? { startDate: new Date(data.startDate) } : {}),
      ...(data.endDate ? { endDate: new Date(data.endDate) } : {}),
    },
    include: LIST_INCLUDE,
  });
}

// ── Activate ──────────────────────────────────────────────────────────────

export async function activate(id: string, userId: string) {
  const record = await prisma.annualMaintenanceContract.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('AnnualMaintenanceContract', id);

  if (record.status !== 'draft') {
    throw new BusinessRuleError(
      `Cannot activate a contract with status "${record.status}". Only "draft" contracts can be activated.`,
    );
  }

  const updated = await prisma.annualMaintenanceContract.update({
    where: { id },
    data: { status: 'active' },
    include: DETAIL_INCLUDE,
  });

  eventBus.publish({
    type: 'document:status_changed',
    entityType: 'amc',
    entityId: id,
    action: 'status_change',
    payload: { from: 'draft', to: 'active', contractNumber: record.contractNumber },
    performedById: userId,
    timestamp: new Date().toISOString(),
  });

  return updated;
}

// ── Terminate ─────────────────────────────────────────────────────────────

export async function terminate(id: string, userId: string, reason?: string) {
  const record = await prisma.annualMaintenanceContract.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('AnnualMaintenanceContract', id);

  if (record.status !== 'active') {
    throw new BusinessRuleError(
      `Cannot terminate a contract with status "${record.status}". Only "active" contracts can be terminated.`,
    );
  }

  const updated = await prisma.annualMaintenanceContract.update({
    where: { id },
    data: {
      status: 'terminated',
      terminationReason: reason ?? null,
    },
    include: DETAIL_INCLUDE,
  });

  eventBus.publish({
    type: 'document:status_changed',
    entityType: 'amc',
    entityId: id,
    action: 'status_change',
    payload: { from: 'active', to: 'terminated', contractNumber: record.contractNumber, reason },
    performedById: userId,
    timestamp: new Date().toISOString(),
  });

  return updated;
}

// ── Check Expiring Contracts (scheduler job) ──────────────────────────────

export async function checkExpiringContracts(): Promise<void> {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Find active AMCs expiring within the next 30 days
  const expiringContracts = await prisma.annualMaintenanceContract.findMany({
    where: {
      status: 'active',
      endDate: {
        gte: now,
        lte: thirtyDaysFromNow,
      },
    },
    include: {
      supplier: { select: { supplierName: true } },
      equipmentType: { select: { typeName: true } },
    },
  });

  if (expiringContracts.length === 0) return;

  // Find managers and admins to notify
  const recipients = await prisma.employee.findMany({
    where: {
      systemRole: { in: ['admin', 'manager', 'technical_manager'] },
      isActive: true,
    },
    select: { id: true },
  });

  if (recipients.length === 0) return;

  // Batch-check for recent notifications to avoid duplicates
  const contractIds = expiringContracts.map(c => c.id);
  const recentNotifs = await prisma.notification.findMany({
    where: {
      referenceTable: 'annual_maintenance_contracts',
      referenceId: { in: contractIds },
      title: { contains: 'AMC Expiring' },
      createdAt: { gt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
    },
    select: { referenceId: true },
  });
  const alreadyNotified = new Set(recentNotifs.map(n => n.referenceId).filter(Boolean));

  for (const contract of expiringContracts) {
    if (alreadyNotified.has(contract.id)) continue;

    const daysUntilExpiry = Math.ceil((contract.endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

    for (const recipient of recipients) {
      await createNotification({
        recipientId: recipient.id,
        title: 'AMC Expiring Soon',
        body: `Contract ${contract.contractNumber} for ${contract.equipmentType.typeName} (${contract.supplier.supplierName}) expires in ${daysUntilExpiry} days.`,
        notificationType: 'amc_expiring',
        referenceTable: 'annual_maintenance_contracts',
        referenceId: contract.id,
      });
    }
  }
}
