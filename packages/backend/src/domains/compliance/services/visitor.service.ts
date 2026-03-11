/**
 * Visitor Management Service — SOW M5-F03
 * Prisma model: VisitorPass (table: visitor_passes)
 * State flow: scheduled -> checked_in -> checked_out
 *                                     -> overstay (via scheduler)
 *             scheduled -> cancelled
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../../utils/prisma.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';
import { eventBus } from '../../../events/event-bus.js';
import { generateDocumentNumber } from '../../system/services/document-number.service.js';
import { createNotification } from '../../notifications/services/notification.service.js';
import type { VisitorPassCreateDto, VisitorPassUpdateDto, VisitorCheckInDto } from '../../../types/dto.js';

const LIST_INCLUDE = {
  hostEmployee: { select: { id: true, fullName: true } },
  warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
  registeredBy: { select: { id: true, fullName: true } },
} satisfies Prisma.VisitorPassInclude;

const DETAIL_INCLUDE = {
  hostEmployee: { select: { id: true, fullName: true, email: true, phone: true, department: true } },
  warehouse: { select: { id: true, warehouseName: true, warehouseCode: true, address: true } },
  registeredBy: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.VisitorPassInclude;

// ── List (paginated, searchable, filterable) ──────────────────────────────

export interface VisitorListParams {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  warehouseId?: string;
  hostEmployeeId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export async function list(params: VisitorListParams) {
  const where: Prisma.VisitorPassWhereInput = {};

  if (params.status) where.status = params.status;
  if (params.warehouseId) where.warehouseId = params.warehouseId;
  if (params.hostEmployeeId) where.hostEmployeeId = params.hostEmployeeId;

  if (params.dateFrom || params.dateTo) {
    where.visitDate = {};
    if (params.dateFrom) where.visitDate.gte = new Date(params.dateFrom);
    if (params.dateTo) where.visitDate.lte = new Date(params.dateTo);
  }

  if (params.search) {
    where.OR = [
      { visitorName: { contains: params.search, mode: 'insensitive' } },
      { visitorCompany: { contains: params.search, mode: 'insensitive' } },
      { passNumber: { contains: params.search, mode: 'insensitive' } },
      { visitorIdNumber: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const sortBy = params.sortBy || 'createdAt';
  const sortDir = params.sortDir || 'desc';
  const skip = (params.page - 1) * params.pageSize;

  const [data, total] = await Promise.all([
    prisma.visitorPass.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      skip,
      take: params.pageSize,
      include: LIST_INCLUDE,
    }),
    prisma.visitorPass.count({ where }),
  ]);

  return { data, total };
}

// ── Get by ID ─────────────────────────────────────────────────────────────

export async function getById(id: string) {
  const record = await prisma.visitorPass.findUnique({
    where: { id },
    include: DETAIL_INCLUDE,
  });
  if (!record) throw new NotFoundError('VisitorPass', id);
  return record;
}

// ── Register (create) ─────────────────────────────────────────────────────

export async function register(data: VisitorPassCreateDto, registeredById: string) {
  const passNumber = await generateDocumentNumber('visitor_pass');

  const visitorPass = await prisma.visitorPass.create({
    data: {
      passNumber,
      visitorName: data.visitorName,
      visitorCompany: data.visitorCompany ?? null,
      visitorIdNumber: data.visitorIdNumber,
      visitorPhone: data.visitorPhone ?? null,
      visitorEmail: data.visitorEmail ?? null,
      hostEmployeeId: data.hostEmployeeId,
      warehouseId: data.warehouseId,
      purpose: data.purpose,
      visitDate: new Date(data.visitDate),
      expectedDuration: data.expectedDuration,
      vehicleNumber: data.vehicleNumber ?? null,
      vehicleType: data.vehicleType ?? null,
      badgeNumber: data.badgeNumber ?? null,
      status: 'scheduled',
      registeredById,
      notes: data.notes ?? null,
    },
    include: LIST_INCLUDE,
  });

  // Notify host employee about the scheduled visit
  await createNotification({
    recipientId: data.hostEmployeeId,
    title: 'Visitor Scheduled',
    body: `${data.visitorName}${data.visitorCompany ? ` (${data.visitorCompany})` : ''} has a scheduled visit. Pass: ${passNumber}. Purpose: ${data.purpose}`,
    notificationType: 'visitor_scheduled',
    referenceTable: 'visitor_passes',
    referenceId: visitorPass.id,
  });

  eventBus.publish({
    type: 'document:created',
    entityType: 'visitor_pass',
    entityId: visitorPass.id,
    action: 'create',
    payload: { passNumber, visitorName: data.visitorName, hostEmployeeId: data.hostEmployeeId },
    performedById: registeredById,
    timestamp: new Date().toISOString(),
  });

  return visitorPass;
}

// ── Update (only scheduled visits) ────────────────────────────────────────

export async function update(id: string, data: VisitorPassUpdateDto) {
  const existing = await prisma.visitorPass.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('VisitorPass', id);

  if (existing.status !== 'scheduled') {
    throw new BusinessRuleError('Only visitor passes in "scheduled" status can be updated');
  }

  return prisma.visitorPass.update({
    where: { id },
    data: {
      ...data,
      ...(data.visitDate ? { visitDate: new Date(data.visitDate) } : {}),
    },
    include: LIST_INCLUDE,
  });
}

// ── Check In ──────────────────────────────────────────────────────────────

export async function checkIn(id: string, data?: VisitorCheckInDto) {
  const record = await prisma.visitorPass.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('VisitorPass', id);

  if (record.status !== 'scheduled') {
    throw new BusinessRuleError(
      `Cannot check in a visitor with status "${record.status}". Only "scheduled" passes can be checked in.`,
    );
  }

  const updated = await prisma.visitorPass.update({
    where: { id },
    data: {
      status: 'checked_in',
      checkInTime: new Date(),
      ...(data?.badgeNumber ? { badgeNumber: data.badgeNumber } : {}),
    },
    include: DETAIL_INCLUDE,
  });

  // Notify host employee that their visitor has arrived
  await createNotification({
    recipientId: record.hostEmployeeId,
    title: 'Visitor Arrived',
    body: `${record.visitorName} has checked in at the gate. Pass: ${record.passNumber}`,
    notificationType: 'visitor_checked_in',
    referenceTable: 'visitor_passes',
    referenceId: id,
  });

  eventBus.publish({
    type: 'document:status_changed',
    entityType: 'visitor_pass',
    entityId: id,
    action: 'status_change',
    payload: { from: 'scheduled', to: 'checked_in', visitorName: record.visitorName },
    timestamp: new Date().toISOString(),
  });

  return updated;
}

// ── Check Out ─────────────────────────────────────────────────────────────

export async function checkOut(id: string) {
  const record = await prisma.visitorPass.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('VisitorPass', id);

  if (record.status !== 'checked_in' && record.status !== 'overstay') {
    throw new BusinessRuleError(
      `Cannot check out a visitor with status "${record.status}". Only "checked_in" or "overstay" passes can be checked out.`,
    );
  }

  const updated = await prisma.visitorPass.update({
    where: { id },
    data: {
      status: 'checked_out',
      checkOutTime: new Date(),
    },
    include: DETAIL_INCLUDE,
  });

  eventBus.publish({
    type: 'document:status_changed',
    entityType: 'visitor_pass',
    entityId: id,
    action: 'status_change',
    payload: { from: record.status, to: 'checked_out', visitorName: record.visitorName },
    timestamp: new Date().toISOString(),
  });

  return updated;
}

// ── Cancel ────────────────────────────────────────────────────────────────

export async function cancel(id: string) {
  const record = await prisma.visitorPass.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('VisitorPass', id);

  if (record.status !== 'scheduled') {
    throw new BusinessRuleError(
      `Cannot cancel a visitor pass with status "${record.status}". Only "scheduled" passes can be cancelled.`,
    );
  }

  const updated = await prisma.visitorPass.update({
    where: { id },
    data: { status: 'cancelled' },
    include: LIST_INCLUDE,
  });

  eventBus.publish({
    type: 'document:status_changed',
    entityType: 'visitor_pass',
    entityId: id,
    action: 'status_change',
    payload: { from: 'scheduled', to: 'cancelled', visitorName: record.visitorName },
    timestamp: new Date().toISOString(),
  });

  return updated;
}
