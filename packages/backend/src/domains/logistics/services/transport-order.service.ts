import type { Prisma } from '@prisma/client';
import { prisma } from '../../../utils/prisma.js';
import { generateDocumentNumber } from '../../../services/document-number.service.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';
import { assertTransition } from '@nit-scs-v2/shared';
import { eventBus } from '../../../events/event-bus.js';
import type { ListParams } from '../../../types/dto.js';

const DOC_TYPE = 'transport_order';

const LIST_INCLUDE = {
  originWarehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
  destinationWarehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
  project: { select: { id: true, projectName: true, projectCode: true } },
  requestedBy: { select: { id: true, fullName: true } },
  _count: { select: { transportOrderItems: true } },
} satisfies Prisma.TransportOrderInclude;

const DETAIL_INCLUDE = {
  transportOrderItems: {
    include: {
      item: { select: { id: true, itemCode: true, itemDescription: true } },
      uom: { select: { id: true, uomCode: true, uomName: true } },
    },
  },
  originWarehouse: true,
  destinationWarehouse: true,
  project: true,
  jobOrder: { select: { id: true, joNumber: true, joType: true, status: true } },
  gatePass: { select: { id: true, gatePassNumber: true, status: true } },
  requestedBy: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.TransportOrderInclude;

export interface TransportOrderItemInput {
  itemId?: string;
  description: string;
  quantity: number;
  uomId?: string;
  weight?: number;
}

export interface TransportOrderCreateInput {
  jobOrderId?: string;
  originWarehouseId: string;
  destinationWarehouseId?: string;
  destinationAddress?: string;
  projectId?: string;
  loadDescription: string;
  vehicleType?: string;
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
  driverIdNumber?: string;
  scheduledDate: string;
  estimatedWeight?: number;
  gatePassId?: string;
  notes?: string;
  items: TransportOrderItemInput[];
}

export interface TransportOrderUpdateInput {
  jobOrderId?: string;
  originWarehouseId?: string;
  destinationWarehouseId?: string;
  destinationAddress?: string;
  projectId?: string;
  loadDescription?: string;
  vehicleType?: string;
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
  driverIdNumber?: string;
  scheduledDate?: string;
  estimatedWeight?: number;
  gatePassId?: string;
  notes?: string;
}

export async function list(params: ListParams) {
  const where: Record<string, unknown> = {};
  if (params.search) {
    where.OR = [
      { orderNumber: { contains: params.search, mode: 'insensitive' } },
      { loadDescription: { contains: params.search, mode: 'insensitive' } },
      { driverName: { contains: params.search, mode: 'insensitive' } },
      { vehicleNumber: { contains: params.search, mode: 'insensitive' } },
    ];
  }
  if (params.status) where.status = params.status;
  // Row-level security scope filters
  if (params.originWarehouseId) where.originWarehouseId = params.originWarehouseId;
  if (params.warehouseId) where.originWarehouseId = params.warehouseId;
  if (params.projectId) where.projectId = params.projectId;
  if (params.requestedById) where.requestedById = params.requestedById;

  const [data, total] = await Promise.all([
    prisma.transportOrder.findMany({
      where,
      orderBy: { [params.sortBy]: params.sortDir },
      skip: params.skip,
      take: params.pageSize,
      include: LIST_INCLUDE,
    }),
    prisma.transportOrder.count({ where }),
  ]);
  return { data, total };
}

export async function getById(id: string) {
  const to = await prisma.transportOrder.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  if (!to) throw new NotFoundError('Transport Order', id);
  return to;
}

export async function create(data: TransportOrderCreateInput, userId: string) {
  const { items, ...headerData } = data;

  return prisma.$transaction(async tx => {
    const orderNumber = await generateDocumentNumber('transport');
    return tx.transportOrder.create({
      data: {
        orderNumber,
        jobOrderId: headerData.jobOrderId ?? null,
        originWarehouseId: headerData.originWarehouseId,
        destinationWarehouseId: headerData.destinationWarehouseId ?? null,
        destinationAddress: headerData.destinationAddress ?? null,
        projectId: headerData.projectId ?? null,
        loadDescription: headerData.loadDescription,
        vehicleType: headerData.vehicleType ?? null,
        vehicleNumber: headerData.vehicleNumber ?? null,
        driverName: headerData.driverName ?? null,
        driverPhone: headerData.driverPhone ?? null,
        driverIdNumber: headerData.driverIdNumber ?? null,
        scheduledDate: new Date(headerData.scheduledDate),
        estimatedWeight: headerData.estimatedWeight ?? null,
        gatePassId: headerData.gatePassId ?? null,
        requestedById: userId,
        status: 'draft',
        notes: headerData.notes ?? null,
        transportOrderItems: {
          create: items.map(item => ({
            itemId: item.itemId ?? null,
            description: item.description,
            quantity: item.quantity,
            uomId: item.uomId ?? null,
            weight: item.weight ?? null,
          })),
        },
      },
      include: {
        transportOrderItems: true,
        originWarehouse: { select: { id: true, warehouseName: true } },
      },
    });
  });
}

export async function update(id: string, data: TransportOrderUpdateInput) {
  const existing = await prisma.transportOrder.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Transport Order', id);
  if (existing.status !== 'draft') throw new BusinessRuleError('Only draft Transport Orders can be updated');

  const updated = await prisma.transportOrder.update({
    where: { id },
    data: {
      ...data,
      ...(data.scheduledDate ? { scheduledDate: new Date(data.scheduledDate) } : {}),
    },
  });
  return { existing, updated };
}

export async function schedule(id: string) {
  const to = await prisma.transportOrder.findUnique({ where: { id } });
  if (!to) throw new NotFoundError('Transport Order', id);
  assertTransition(DOC_TYPE, to.status, 'scheduled');
  const updated = await prisma.transportOrder.update({ where: { id: to.id }, data: { status: 'scheduled' } });

  eventBus.publish({
    type: 'document:status_changed',
    entityType: 'transport_order',
    entityId: to.id,
    action: 'status_change',
    payload: { from: to.status, to: 'scheduled' },
    timestamp: new Date().toISOString(),
  });

  return updated;
}

export async function dispatch(id: string) {
  const to = await prisma.transportOrder.findUnique({ where: { id } });
  if (!to) throw new NotFoundError('Transport Order', id);
  assertTransition(DOC_TYPE, to.status, 'in_transit');

  const updated = await prisma.transportOrder.update({
    where: { id: to.id },
    data: { status: 'in_transit', actualPickupDate: new Date() },
  });

  eventBus.publish({
    type: 'document:status_changed',
    entityType: 'transport_order',
    entityId: to.id,
    action: 'status_change',
    payload: { from: to.status, to: 'in_transit' },
    timestamp: new Date().toISOString(),
  });

  return updated;
}

export async function deliver(id: string) {
  const to = await prisma.transportOrder.findUnique({ where: { id } });
  if (!to) throw new NotFoundError('Transport Order', id);
  assertTransition(DOC_TYPE, to.status, 'delivered');

  const updated = await prisma.transportOrder.update({
    where: { id: to.id },
    data: { status: 'delivered', actualDeliveryDate: new Date() },
  });

  eventBus.publish({
    type: 'document:status_changed',
    entityType: 'transport_order',
    entityId: to.id,
    action: 'status_change',
    payload: { from: to.status, to: 'delivered' },
    timestamp: new Date().toISOString(),
  });

  return updated;
}

export async function cancel(id: string) {
  const to = await prisma.transportOrder.findUnique({ where: { id } });
  if (!to) throw new NotFoundError('Transport Order', id);

  const nonCancellable = ['in_transit', 'delivered', 'cancelled'];
  if (nonCancellable.includes(to.status)) {
    throw new BusinessRuleError(`Transport Order cannot be cancelled from status: ${to.status}`);
  }

  const updated = await prisma.transportOrder.update({ where: { id: to.id }, data: { status: 'cancelled' } });

  eventBus.publish({
    type: 'document:status_changed',
    entityType: 'transport_order',
    entityId: to.id,
    action: 'status_change',
    payload: { from: to.status, to: 'cancelled' },
    timestamp: new Date().toISOString(),
  });

  return updated;
}
