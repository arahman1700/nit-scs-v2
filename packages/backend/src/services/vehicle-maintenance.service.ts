/**
 * Vehicle Maintenance Service — M8
 * Prisma model: VehicleMaintenance (table: vehicle_maintenance)
 * State flow: scheduled → in_progress → completed (or cancelled)
 *
 * Provides usage-based scheduling: tracks hours, mileage, and date thresholds
 * to proactively flag vehicles needing service.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';
import { assertTransition } from '@nit-scs-v2/shared';
import { eventBus } from '../events/event-bus.js';
import { generateDocumentNumber } from './document-number.service.js';
import { createNotification } from './notification.service.js';
import type {
  VehicleMaintenanceCreateDto,
  VehicleMaintenanceUpdateDto,
  VehicleMaintenanceCompleteDto,
  ListParams,
} from '../types/dto.js';

/** Helper to emit EventBus events for vehicle maintenance */
function emitEvent(action: string, entityId: string, payload: Record<string, unknown>, performedById?: string) {
  eventBus.publish({
    type: action === 'create' ? 'document:created' : 'document:status_changed',
    entityType: 'vehicle_maintenance',
    entityId,
    action,
    payload,
    performedById,
    timestamp: new Date().toISOString(),
  });
}

const DOC_TYPE = 'vehicle_maintenance';

const LIST_INCLUDE = {
  vehicle: { select: { id: true, vehicleCode: true, vehicleType: true, plateNumber: true } },
  performedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.VehicleMaintenanceInclude;

const DETAIL_INCLUDE = {
  vehicle: true,
  performedBy: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.VehicleMaintenanceInclude;

export async function list(params: ListParams) {
  const where: Record<string, unknown> = {};
  if (params.search) {
    where.OR = [
      { maintenanceNumber: { contains: params.search, mode: 'insensitive' } },
      { vehicle: { vehicleCode: { contains: params.search, mode: 'insensitive' } } },
      { vehicle: { plateNumber: { contains: params.search, mode: 'insensitive' } } },
      { description: { contains: params.search, mode: 'insensitive' } },
    ];
  }
  if (params.status) where.status = params.status;
  if (params.vehicleId) where.vehicleId = params.vehicleId;
  if (params.maintenanceType) where.maintenanceType = params.maintenanceType;

  const [data, total] = await Promise.all([
    prisma.vehicleMaintenance.findMany({
      where,
      orderBy: { [params.sortBy]: params.sortDir },
      skip: params.skip,
      take: params.pageSize,
      include: LIST_INCLUDE,
    }),
    prisma.vehicleMaintenance.count({ where }),
  ]);
  return { data, total };
}

export async function getById(id: string) {
  const record = await prisma.vehicleMaintenance.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  if (!record) throw new NotFoundError('VehicleMaintenance', id);
  return record;
}

export async function create(data: VehicleMaintenanceCreateDto, userId: string) {
  // Verify vehicle exists
  const vehicle = await prisma.equipmentFleet.findUnique({ where: { id: data.vehicleId } });
  if (!vehicle) throw new NotFoundError('EquipmentFleet', data.vehicleId);

  const maintenanceNumber = await generateDocumentNumber('vm');

  const created = await prisma.vehicleMaintenance.create({
    data: {
      vehicleId: data.vehicleId,
      maintenanceNumber,
      maintenanceType: data.maintenanceType,
      scheduledDate: new Date(data.scheduledDate),
      description: data.description,
      currentHoursAtService: data.currentHoursAtService ?? null,
      currentMileageAtService: data.currentMileageAtService ?? null,
      vendorName: data.vendorName ?? null,
      performedById: data.performedById ?? null,
      nextServiceHours: data.nextServiceHours ?? null,
      nextServiceMileage: data.nextServiceMileage ?? null,
      nextServiceDate: data.nextServiceDate ? new Date(data.nextServiceDate) : null,
      notes: data.notes ?? null,
      status: 'scheduled',
    },
    include: LIST_INCLUDE,
  });

  emitEvent(
    'create',
    created.id,
    {
      vehicleId: data.vehicleId,
      maintenanceType: data.maintenanceType,
      maintenanceNumber,
    },
    userId,
  );

  return created;
}

export async function update(id: string, data: VehicleMaintenanceUpdateDto) {
  const existing = await prisma.vehicleMaintenance.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('VehicleMaintenance', id);

  if (existing.status === 'completed' || existing.status === 'cancelled') {
    throw new BusinessRuleError(`Cannot update a ${existing.status} maintenance record`);
  }

  const updated = await prisma.vehicleMaintenance.update({
    where: { id },
    data: {
      ...data,
      ...(data.scheduledDate ? { scheduledDate: new Date(data.scheduledDate) } : {}),
      ...(data.nextServiceDate ? { nextServiceDate: new Date(data.nextServiceDate) } : {}),
      ...(data.nextServiceDate === null ? { nextServiceDate: null } : {}),
    },
    include: DETAIL_INCLUDE,
  });
  return { existing, updated };
}

export async function complete(id: string, userId: string, body: VehicleMaintenanceCompleteDto) {
  const record = await prisma.vehicleMaintenance.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('VehicleMaintenance', id);
  assertTransition(DOC_TYPE, record.status, 'completed');

  const updated = await prisma.$transaction(async tx => {
    const result = await tx.vehicleMaintenance.update({
      where: { id: record.id },
      data: {
        status: 'completed',
        completedDate: new Date(),
        performedById: userId,
        workPerformed: body.workPerformed,
        partsUsed: body.partsUsed ?? null,
        cost: body.cost ?? null,
      },
      include: DETAIL_INCLUDE,
    });

    // Update the vehicle's next maintenance date if provided on the record
    if (record.nextServiceDate) {
      await tx.equipmentFleet.update({
        where: { id: record.vehicleId },
        data: { nextMaintenanceDate: record.nextServiceDate },
      });
    }

    return result;
  });

  emitEvent('status_change', record.id, { from: record.status, to: 'completed' }, userId);

  return updated;
}

export async function cancel(id: string, userId: string) {
  const record = await prisma.vehicleMaintenance.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('VehicleMaintenance', id);
  assertTransition(DOC_TYPE, record.status, 'cancelled');

  const updated = await prisma.vehicleMaintenance.update({
    where: { id: record.id },
    data: { status: 'cancelled' },
    include: DETAIL_INCLUDE,
  });

  emitEvent('status_change', record.id, { from: record.status, to: 'cancelled' }, userId);

  return updated;
}

/**
 * Check for vehicles due for maintenance based on usage thresholds.
 *
 * Scans VehicleMaintenance records where:
 *  - nextServiceDate <= today + 7 days, OR
 *  - scheduled date is approaching
 *
 * Also checks EquipmentFleet.nextMaintenanceDate for fleet-level scheduling.
 * Creates notifications for transport_supervisor role.
 */
export async function checkDueMaintenances(): Promise<void> {
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Find scheduled maintenance records due within 7 days
  const dueSoon = await prisma.vehicleMaintenance.findMany({
    where: {
      status: 'scheduled',
      scheduledDate: { lte: sevenDaysFromNow },
    },
    select: {
      id: true,
      maintenanceNumber: true,
      maintenanceType: true,
      scheduledDate: true,
      vehicle: { select: { vehicleCode: true, plateNumber: true } },
    },
  });

  if (dueSoon.length === 0) return;

  // Find transport supervisors
  const supervisors = await prisma.employee.findMany({
    where: { systemRole: { in: ['transport_supervisor'] }, isActive: true },
    select: { id: true },
  });

  if (supervisors.length === 0) return;

  for (const maint of dueSoon) {
    const isOverdue = maint.scheduledDate < now;
    const vehicleLabel = maint.vehicle.plateNumber
      ? `${maint.vehicle.vehicleCode} (${maint.vehicle.plateNumber})`
      : maint.vehicle.vehicleCode;
    const title = isOverdue ? 'Vehicle Maintenance Overdue' : 'Vehicle Maintenance Due Soon';
    const body = `${maint.maintenanceType} maintenance ${maint.maintenanceNumber} for ${vehicleLabel} is ${isOverdue ? 'overdue' : 'due soon'} (scheduled: ${maint.scheduledDate.toLocaleDateString()}).`;

    for (const sup of supervisors) {
      await createNotification({
        recipientId: sup.id,
        title,
        body,
        notificationType: 'vehicle_maintenance_due',
        referenceTable: 'vehicle_maintenance',
        referenceId: maint.id,
      });
    }
  }
}
