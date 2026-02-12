import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { generateDocumentNumber } from './document-number.service.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';
import { eventBus } from '../events/event-bus.js';
import type { ShipmentCreateDto, ShipmentUpdateDto, ListParams } from '../types/dto.js';

const LIST_INCLUDE = {
  supplier: { select: { id: true, supplierName: true, supplierCode: true } },
  freightForwarder: { select: { id: true, supplierName: true } },
  project: { select: { id: true, projectName: true, projectCode: true } },
  portOfEntry: { select: { id: true, portName: true, portCode: true } },
  destinationWarehouse: { select: { id: true, warehouseName: true } },
  _count: { select: { shipmentLines: true, customsTracking: true } },
} satisfies Prisma.ShipmentInclude;

const DETAIL_INCLUDE = {
  shipmentLines: {
    include: {
      item: { select: { id: true, itemCode: true, itemDescription: true } },
      uom: { select: { id: true, uomCode: true, uomName: true } },
    },
  },
  customsTracking: { orderBy: { stageDate: 'asc' as const } },
  supplier: true,
  freightForwarder: true,
  project: true,
  portOfEntry: true,
  destinationWarehouse: true,
  mrrv: { select: { id: true, mrrvNumber: true, status: true } },
  transportJo: { select: { id: true, joNumber: true, status: true } },
} satisfies Prisma.ShipmentInclude;

export async function list(params: ListParams) {
  const where: Record<string, unknown> = {};
  if (params.search) {
    where.OR = [
      { shipmentNumber: { contains: params.search, mode: 'insensitive' } },
      { awbBlNumber: { contains: params.search, mode: 'insensitive' } },
      { containerNumber: { contains: params.search, mode: 'insensitive' } },
      { supplier: { supplierName: { contains: params.search, mode: 'insensitive' } } },
    ];
  }
  if (params.status) where.status = params.status;
  if (params.modeOfShipment) where.modeOfShipment = params.modeOfShipment;
  // Row-level security scope filters
  if (params.projectId) where.projectId = params.projectId;

  const [data, total] = await Promise.all([
    prisma.shipment.findMany({
      where,
      orderBy: { [params.sortBy]: params.sortDir },
      skip: params.skip,
      take: params.pageSize,
      include: LIST_INCLUDE,
    }),
    prisma.shipment.count({ where }),
  ]);
  return { data, total };
}

export async function getById(id: string) {
  const s = await prisma.shipment.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  if (!s) throw new NotFoundError('Shipment', id);
  return s;
}

export async function create(headerData: Omit<ShipmentCreateDto, 'lines'>, lines: ShipmentCreateDto['lines']) {
  return prisma.$transaction(async tx => {
    const shipmentNumber = await generateDocumentNumber('shipment');
    return tx.shipment.create({
      data: {
        shipmentNumber,
        poNumber: headerData.poNumber ?? null,
        supplierId: headerData.supplierId,
        freightForwarderId: headerData.freightForwarderId ?? null,
        projectId: headerData.projectId ?? null,
        originCountry: headerData.originCountry ?? null,
        modeOfShipment: headerData.modeOfShipment,
        portOfLoading: headerData.portOfLoading ?? null,
        portOfEntryId: headerData.portOfEntryId ?? null,
        destinationWarehouseId: headerData.destinationWarehouseId ?? null,
        orderDate: headerData.orderDate ? new Date(headerData.orderDate) : null,
        expectedShipDate: headerData.expectedShipDate ? new Date(headerData.expectedShipDate) : null,
        status: 'draft',
        awbBlNumber: headerData.awbBlNumber ?? null,
        containerNumber: headerData.containerNumber ?? null,
        vesselFlight: headerData.vesselFlight ?? null,
        trackingUrl: headerData.trackingUrl ?? null,
        commercialValue: headerData.commercialValue ?? null,
        freightCost: headerData.freightCost ?? null,
        insuranceCost: headerData.insuranceCost ?? null,
        dutiesEstimated: headerData.dutiesEstimated ?? null,
        description: headerData.description ?? null,
        notes: headerData.notes ?? null,
        shipmentLines: {
          create: lines.map(line => ({
            itemId: line.itemId ?? null,
            description: line.description,
            quantity: line.quantity,
            uomId: line.uomId ?? null,
            unitValue: line.unitValue ?? null,
            hsCode: line.hsCode ?? null,
          })),
        },
      },
      include: {
        shipmentLines: true,
        supplier: { select: { id: true, supplierName: true } },
      },
    });
  });
}

export async function update(id: string, data: ShipmentUpdateDto) {
  const existing = await prisma.shipment.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Shipment', id);

  const dateFields = ['orderDate', 'expectedShipDate', 'actualShipDate', 'etaPort', 'actualArrivalDate'] as const;
  const dateTransforms: Record<string, Date> = {};
  for (const field of dateFields) {
    if (data[field]) dateTransforms[field] = new Date(data[field] as string);
  }

  const updated = await prisma.shipment.update({
    where: { id },
    data: { ...data, ...dateTransforms },
  });
  return { existing, updated };
}

export async function updateStatus(
  id: string,
  status: string,
  extra: { actualShipDate?: string; etaPort?: string; actualArrivalDate?: string },
) {
  const existing = await prisma.shipment.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Shipment', id);

  const updateData: Record<string, unknown> = { status };
  if (extra.actualShipDate) updateData.actualShipDate = new Date(extra.actualShipDate);
  if (extra.etaPort) updateData.etaPort = new Date(extra.etaPort);
  if (extra.actualArrivalDate) updateData.actualArrivalDate = new Date(extra.actualArrivalDate);

  const updated = await prisma.shipment.update({ where: { id }, data: updateData });
  return { existing, updated };
}

export async function addCustomsStage(shipmentId: string, data: Record<string, unknown>) {
  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment) throw new NotFoundError('Shipment', shipmentId);

  const customs = await prisma.customsTracking.create({
    data: {
      shipmentId: shipment.id,
      stage: data.stage as string,
      stageDate: new Date(data.stageDate as string),
      customsDeclaration: (data.customsDeclaration as string) ?? null,
      customsRef: (data.customsRef as string) ?? null,
      inspectorName: (data.inspectorName as string) ?? null,
      inspectionType: (data.inspectionType as string) ?? null,
      dutiesAmount: (data.dutiesAmount as number) ?? null,
      vatAmount: (data.vatAmount as number) ?? null,
      otherFees: (data.otherFees as number) ?? null,
      paymentStatus: (data.paymentStatus as string) ?? null,
      issues: (data.issues as string) ?? null,
      resolution: (data.resolution as string) ?? null,
    },
  });

  const stageToStatus: Record<string, string> = {
    docs_submitted: 'customs_clearing',
    declaration_filed: 'customs_clearing',
    under_inspection: 'customs_clearing',
    awaiting_payment: 'customs_clearing',
    duties_paid: 'customs_clearing',
    ready_for_release: 'customs_clearing',
    released: 'cleared',
  };

  const newShipmentStatus = stageToStatus[data.stage as string];
  if (newShipmentStatus && shipment.status !== newShipmentStatus) {
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: { status: newShipmentStatus },
    });
  }

  return { customs, newShipmentStatus, shipmentId: shipment.id };
}

export async function updateCustomsStage(shipmentId: string, customsId: string, data: Record<string, unknown>) {
  const existing = await prisma.customsTracking.findFirst({
    where: { id: customsId, shipmentId },
  });
  if (!existing) throw new NotFoundError('Customs tracking stage', customsId);

  const updated = await prisma.customsTracking.update({
    where: { id: existing.id },
    data: {
      ...(data.stage !== undefined ? { stage: data.stage as string } : {}),
      ...(data.stageDate ? { stageDate: new Date(data.stageDate as string) } : {}),
      ...(data.customsDeclaration !== undefined ? { customsDeclaration: data.customsDeclaration as string } : {}),
      ...(data.customsRef !== undefined ? { customsRef: data.customsRef as string } : {}),
      ...(data.inspectorName !== undefined ? { inspectorName: data.inspectorName as string } : {}),
      ...(data.inspectionType !== undefined ? { inspectionType: data.inspectionType as string } : {}),
      ...(data.dutiesAmount !== undefined ? { dutiesAmount: data.dutiesAmount as number } : {}),
      ...(data.vatAmount !== undefined ? { vatAmount: data.vatAmount as number } : {}),
      ...(data.otherFees !== undefined ? { otherFees: data.otherFees as number } : {}),
      ...(data.paymentStatus !== undefined ? { paymentStatus: data.paymentStatus as string } : {}),
      ...(data.issues !== undefined ? { issues: data.issues as string } : {}),
      ...(data.resolution !== undefined ? { resolution: data.resolution as string } : {}),
      stageEndDate: data.resolution ? new Date() : undefined,
    },
  });

  return { existing, updated };
}

export async function deliver(id: string, userId?: string) {
  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: {
      shipmentLines: true,
      supplier: { select: { id: true } },
    },
  });
  if (!shipment) throw new NotFoundError('Shipment', id);

  const deliverable = ['cleared', 'in_delivery'];
  if (!deliverable.includes(shipment.status)) {
    throw new BusinessRuleError(`Shipment cannot be delivered from status: ${shipment.status}`);
  }

  const result = await prisma.$transaction(async tx => {
    const updated = await tx.shipment.update({
      where: { id: shipment.id },
      data: { status: 'delivered', deliveryDate: new Date() },
    });

    let grnId: string | null = null;

    if (shipment.mrrvId) {
      // Update existing linked GRN
      grnId = shipment.mrrvId;
      await tx.mrrv
        .update({
          where: { id: shipment.mrrvId },
          data: { status: 'received' },
        })
        .catch(() => {});
    } else if (shipment.destinationWarehouseId && shipment.shipmentLines.length > 0 && userId) {
      // Auto-create draft GRN from shipment lines
      const grnNumber = await generateDocumentNumber('grn');
      const grn = await tx.mrrv.create({
        data: {
          mrrvNumber: grnNumber,
          supplierId: shipment.supplierId,
          poNumber: shipment.poNumber,
          warehouseId: shipment.destinationWarehouseId,
          projectId: shipment.projectId,
          receivedById: userId,
          receiveDate: new Date(),
          deliveryNote: shipment.awbBlNumber ?? shipment.containerNumber ?? null,
          rfimRequired: false,
          totalValue: Number(shipment.commercialValue ?? 0),
          status: 'draft',
          notes: `Auto-created from shipment ${shipment.shipmentNumber}`,
          mrrvLines: {
            create: shipment.shipmentLines
              .filter(line => line.itemId != null && line.uomId != null)
              .map(line => ({
                itemId: line.itemId!,
                qtyReceived: line.quantity,
                uomId: line.uomId!,
                unitCost: line.unitValue,
                condition: 'good',
              })),
          },
        },
      });
      grnId = grn.id;

      // Link shipment to the new GRN
      await tx.shipment.update({
        where: { id: shipment.id },
        data: { mrrvId: grn.id },
      });
    }

    return { updated, grnId };
  });

  // Publish event for downstream listeners
  if (result.grnId) {
    eventBus.publish({
      type: 'document:created',
      entityType: 'mrrv',
      entityId: result.grnId,
      action: 'create',
      payload: { sourceShipmentId: shipment.id, autoCreated: true },
      timestamp: new Date().toISOString(),
    });
  }

  eventBus.publish({
    type: 'document:status_changed',
    entityType: 'shipment',
    entityId: shipment.id,
    action: 'status_change',
    payload: { from: shipment.status, to: 'delivered', grnId: result.grnId },
    timestamp: new Date().toISOString(),
  });

  return { ...result.updated, autoCreatedGrnId: result.grnId };
}

export async function cancel(id: string) {
  const shipment = await prisma.shipment.findUnique({ where: { id } });
  if (!shipment) throw new NotFoundError('Shipment', id);

  const nonCancellable = ['delivered', 'cancelled'];
  if (nonCancellable.includes(shipment.status)) {
    throw new BusinessRuleError(`Shipment cannot be cancelled from status: ${shipment.status}`);
  }

  return prisma.shipment.update({ where: { id: shipment.id }, data: { status: 'cancelled' } });
}
