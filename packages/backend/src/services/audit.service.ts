import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';

export interface AuditEntry {
  tableName: string;
  recordId: string;
  action: 'create' | 'update' | 'delete';
  changedFields?: Record<string, unknown>;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  performedById?: string;
  ipAddress?: string;
}

export async function createAuditLog(entry: AuditEntry) {
  return prisma.auditLog.create({
    data: {
      tableName: entry.tableName,
      recordId: entry.recordId,
      action: entry.action,
      changedFields: (entry.changedFields as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      oldValues: (entry.oldValues as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      newValues: (entry.newValues as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      performedById: entry.performedById,
      ipAddress: entry.ipAddress,
    },
  });
}

export async function getAuditLogs(params: {
  tableName?: string;
  recordId?: string;
  action?: string;
  performedById?: string;
  page: number;
  pageSize: number;
}) {
  const where: Record<string, unknown> = {};
  if (params.tableName) where.tableName = params.tableName;
  if (params.recordId) where.recordId = params.recordId;
  if (params.action) where.action = params.action;
  if (params.performedById) where.performedById = params.performedById;

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { performedAt: 'desc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: { performedBy: { select: { fullName: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { data, total };
}
