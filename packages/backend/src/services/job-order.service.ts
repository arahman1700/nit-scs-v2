import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { generateDocumentNumber } from './document-number.service.js';
import { submitForApproval } from './approval.service.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs/shared';
import { assertTransition } from '@nit-scs/shared';
import type { Server as SocketIOServer } from 'socket.io';
import type { JoCreateDto, JoUpdateDto, ListParams } from '../types/dto.js';

const DOC_TYPE = 'jo';

const LIST_INCLUDE = {
  project: { select: { id: true, projectName: true, projectCode: true } },
  supplier: { select: { id: true, supplierName: true, supplierCode: true } },
  requestedBy: { select: { id: true, fullName: true } },
  entity: { select: { id: true, entityName: true } },
  slaTracking: { select: { slaDueDate: true, slaMet: true } },
  _count: { select: { approvals: true, payments: true, equipmentLines: true } },
} satisfies Prisma.JobOrderInclude;

const DETAIL_INCLUDE = {
  project: true,
  supplier: true,
  entity: true,
  requestedBy: { select: { id: true, fullName: true, email: true } },
  completedBy: { select: { id: true, fullName: true, email: true } },
  transportDetails: true,
  rentalDetails: true,
  generatorDetails: {
    include: { generator: { select: { id: true, generatorCode: true, generatorName: true, capacityKva: true } } },
  },
  scrapDetails: true,
  equipmentLines: { include: { equipmentType: { select: { id: true, typeName: true } } } },
  slaTracking: true,
  approvals: {
    include: { approver: { select: { id: true, fullName: true, email: true } } },
    orderBy: { approvedDate: 'desc' as const },
  },
  payments: { orderBy: { invoiceReceiptDate: 'desc' as const } },
  stockTransfers: { select: { id: true, transferNumber: true, status: true } },
  shipments: { select: { id: true, shipmentNumber: true, status: true } },
} satisfies Prisma.JobOrderInclude;

export async function list(params: ListParams) {
  const where: Record<string, unknown> = {};
  if (params.search) {
    where.OR = [
      { joNumber: { contains: params.search, mode: 'insensitive' } },
      { description: { contains: params.search, mode: 'insensitive' } },
    ];
  }
  if (params.status) where.status = params.status;
  if (params.joType) where.joType = params.joType;
  if (params.projectId) where.projectId = params.projectId;
  // Row-level security scope filters
  if (params.requestedById) where.requestedById = params.requestedById;

  const [data, total] = await Promise.all([
    prisma.jobOrder.findMany({
      where,
      orderBy: { [params.sortBy]: params.sortDir },
      skip: params.skip,
      take: params.pageSize,
      include: LIST_INCLUDE,
    }),
    prisma.jobOrder.count({ where }),
  ]);
  return { data, total };
}

export async function getById(id: string) {
  const jo = await prisma.jobOrder.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  if (!jo) throw new NotFoundError('Job Order', id);
  return jo;
}

export async function create(body: JoCreateDto, userId: string) {
  const { transportDetails, rentalDetails, generatorDetails, scrapDetails, equipmentLines, ...headerData } = body;

  const jo = await prisma.$transaction(async tx => {
    const joNumber = await generateDocumentNumber('jo');
    const created = await tx.jobOrder.create({
      data: {
        joNumber,
        joType: headerData.joType,
        entityId: headerData.entityId ?? null,
        projectId: headerData.projectId,
        supplierId: headerData.supplierId ?? null,
        requestedById: userId,
        requestDate: new Date(headerData.requestDate),
        requiredDate: headerData.requiredDate ? new Date(headerData.requiredDate) : null,
        priority: headerData.priority ?? 'normal',
        description: headerData.description,
        notes: headerData.notes ?? null,
        totalAmount: headerData.totalAmount ?? 0,
        status: 'draft',
      },
    });

    // Type-specific subtables
    if (transportDetails && headerData.joType === 'transport') {
      const td = transportDetails;
      await tx.joTransportDetail.create({
        data: {
          jobOrderId: created.id,
          pickupLocation: td.pickupLocation,
          pickupLocationUrl: td.pickupLocationUrl ?? null,
          pickupContactName: td.pickupContactName ?? null,
          pickupContactPhone: td.pickupContactPhone ?? null,
          deliveryLocation: td.deliveryLocation,
          deliveryLocationUrl: td.deliveryLocationUrl ?? null,
          deliveryContactName: td.deliveryContactName ?? null,
          deliveryContactPhone: td.deliveryContactPhone ?? null,
          cargoType: td.cargoType,
          cargoWeightTons: td.cargoWeightTons ?? null,
          numberOfTrailers: td.numberOfTrailers ?? null,
          numberOfTrips: td.numberOfTrips ?? null,
          includeLoadingEquipment: td.includeLoadingEquipment ?? false,
          loadingEquipmentType: td.loadingEquipmentType ?? null,
          insuranceRequired: td.insuranceRequired ?? false,
          materialPriceSar: td.materialPriceSar ?? null,
        },
      });
    }

    if (rentalDetails && (headerData.joType === 'rental_monthly' || headerData.joType === 'rental_daily')) {
      const rd = rentalDetails;
      await tx.joRentalDetail.create({
        data: {
          jobOrderId: created.id,
          rentalStartDate: new Date(rd.rentalStartDate),
          rentalEndDate: new Date(rd.rentalEndDate),
          monthlyRate: rd.monthlyRate ?? null,
          dailyRate: rd.dailyRate ?? null,
          withOperator: rd.withOperator ?? false,
          overtimeHours: rd.overtimeHours ?? 0,
          overtimeApproved: rd.overtimeApproved ?? false,
        },
      });
    }

    if (
      generatorDetails &&
      (headerData.joType === 'generator_rental' || headerData.joType === 'generator_maintenance')
    ) {
      const gd = generatorDetails;
      await tx.joGeneratorDetail.create({
        data: {
          jobOrderId: created.id,
          generatorId: gd.generatorId ?? null,
          capacityKva: gd.capacityKva ?? null,
          maintenanceType: gd.maintenanceType ?? null,
          issueDescription: gd.issueDescription ?? null,
          shiftStartTime: gd.shiftStartTime ? new Date(`1970-01-01T${gd.shiftStartTime}`) : null,
        },
      });
    }

    if (scrapDetails && headerData.joType === 'scrap') {
      const sd = scrapDetails;
      await tx.joScrapDetail.create({
        data: {
          jobOrderId: created.id,
          scrapType: sd.scrapType,
          scrapWeightTons: sd.scrapWeightTons,
          scrapDescription: sd.scrapDescription ?? null,
          scrapDestination: sd.scrapDestination ?? null,
          materialPriceSar: sd.materialPriceSar ?? null,
        },
      });
    }

    if (equipmentLines && equipmentLines.length > 0 && headerData.joType === 'equipment') {
      await tx.joEquipmentLine.createMany({
        data: equipmentLines.map(line => ({
          jobOrderId: created.id,
          equipmentTypeId: line.equipmentTypeId,
          quantity: line.quantity,
          withOperator: line.withOperator ?? false,
          siteLocation: line.siteLocation ?? null,
          dailyRate: line.dailyRate ?? null,
          durationDays: line.durationDays ?? null,
        })),
      });
    }

    await tx.joSlaTracking.create({ data: { jobOrderId: created.id } });
    return created;
  });

  // Fetch full record
  const full = await prisma.jobOrder.findUnique({
    where: { id: jo.id },
    include: {
      transportDetails: true,
      rentalDetails: true,
      generatorDetails: true,
      scrapDetails: true,
      equipmentLines: true,
      slaTracking: true,
      project: { select: { id: true, projectName: true } },
      supplier: { select: { id: true, supplierName: true } },
    },
  });

  return full!;
}

export async function update(id: string, data: JoUpdateDto) {
  const existing = await prisma.jobOrder.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Job Order', id);
  if (existing.status !== 'draft') throw new BusinessRuleError('Only draft Job Orders can be updated');

  const updated = await prisma.jobOrder.update({
    where: { id },
    data: {
      ...data,
      ...(data.requestDate ? { requestDate: new Date(data.requestDate) } : {}),
      ...(data.requiredDate ? { requiredDate: new Date(data.requiredDate) } : {}),
    },
  });
  return { existing, updated };
}

export async function submit(id: string, userId: string, io?: SocketIOServer) {
  const jo = await prisma.jobOrder.findUnique({ where: { id } });
  if (!jo) throw new NotFoundError('Job Order', id);
  assertTransition(DOC_TYPE, jo.status, 'pending_approval');

  const approval = await submitForApproval({
    documentType: 'jo',
    documentId: jo.id,
    amount: Number(jo.totalAmount ?? 0),
    submittedById: userId,
    io,
  });

  await prisma.joSlaTracking.update({
    where: { jobOrderId: jo.id },
    data: {
      slaResponseHours: approval.slaHours,
      slaDueDate: (() => {
        const d = new Date();
        d.setHours(d.getHours() + approval.slaHours);
        return d;
      })(),
    },
  });

  return { id: jo.id, approverRole: approval.approverRole, slaHours: approval.slaHours };
}

export async function approve(id: string, userId: string, approved: boolean, quoteAmount?: number, comments?: string) {
  const jo = await prisma.jobOrder.findUnique({ where: { id }, include: { approvals: true } });
  if (!jo) throw new NotFoundError('Job Order', id);
  if (jo.status !== 'pending_approval' && jo.status !== 'quoted') {
    throw new BusinessRuleError('Job Order must be pending approval or quoted');
  }

  if (!approved) {
    await prisma.$transaction(async tx => {
      await tx.joApproval.create({
        data: {
          jobOrderId: jo.id,
          approvalType: 'standard',
          approverId: userId,
          approvedDate: new Date(),
          approved: false,
          quoteAmount: quoteAmount ?? null,
          comments: comments ?? null,
        },
      });
      await tx.jobOrder.update({ where: { id: jo.id }, data: { status: 'rejected' } });
    });
    return { id: jo.id, status: 'rejected' };
  }

  await prisma.$transaction(async tx => {
    await tx.joApproval.create({
      data: {
        jobOrderId: jo.id,
        approvalType: 'standard',
        approverId: userId,
        approvedDate: new Date(),
        approved: true,
        quoteAmount: quoteAmount ?? null,
        comments: comments ?? null,
      },
    });
    await tx.jobOrder.update({ where: { id: jo.id }, data: { status: 'approved' } });
  });

  const sla = await prisma.joSlaTracking.findUnique({ where: { jobOrderId: jo.id } });
  if (sla?.slaDueDate) {
    await prisma.joSlaTracking.update({
      where: { jobOrderId: jo.id },
      data: { slaMet: new Date() <= sla.slaDueDate },
    });
  }

  return { id: jo.id, status: 'approved' };
}

export async function reject(id: string, userId: string, comments?: string) {
  const jo = await prisma.jobOrder.findUnique({ where: { id } });
  if (!jo) throw new NotFoundError('Job Order', id);
  if (jo.status !== 'pending_approval' && jo.status !== 'quoted') {
    throw new BusinessRuleError('Job Order must be pending approval or quoted to reject');
  }

  await prisma.$transaction(async tx => {
    await tx.joApproval.create({
      data: {
        jobOrderId: jo.id,
        approvalType: 'standard',
        approverId: userId,
        approvedDate: new Date(),
        approved: false,
        comments: comments ?? null,
      },
    });
    await tx.jobOrder.update({ where: { id: jo.id }, data: { status: 'rejected' } });
  });
  return { id: jo.id, status: 'rejected' };
}

export async function assign(id: string, supplierId?: string) {
  const jo = await prisma.jobOrder.findUnique({ where: { id } });
  if (!jo) throw new NotFoundError('Job Order', id);
  assertTransition(DOC_TYPE, jo.status, 'assigned');

  return prisma.jobOrder.update({
    where: { id: jo.id },
    data: { status: 'assigned', supplierId: supplierId ?? jo.supplierId },
  });
}

export async function start(id: string) {
  const jo = await prisma.jobOrder.findUnique({ where: { id } });
  if (!jo) throw new NotFoundError('Job Order', id);
  assertTransition(DOC_TYPE, jo.status, 'in_progress');

  return prisma.jobOrder.update({
    where: { id: jo.id },
    data: { status: 'in_progress', startDate: new Date() },
  });
}

export async function hold(id: string, reason?: string) {
  const jo = await prisma.jobOrder.findUnique({ where: { id } });
  if (!jo) throw new NotFoundError('Job Order', id);
  assertTransition(DOC_TYPE, jo.status, 'on_hold');

  await prisma.$transaction(async tx => {
    await tx.jobOrder.update({ where: { id: jo.id }, data: { status: 'on_hold' } });
    await tx.joSlaTracking.update({
      where: { jobOrderId: jo.id },
      data: { stopClockStart: new Date(), stopClockReason: reason ?? null },
    });
  });
  return { id: jo.id };
}

export async function resume(id: string) {
  const jo = await prisma.jobOrder.findUnique({ where: { id } });
  if (!jo) throw new NotFoundError('Job Order', id);
  assertTransition(DOC_TYPE, jo.status, 'in_progress');

  await prisma.$transaction(async tx => {
    await tx.jobOrder.update({ where: { id: jo.id }, data: { status: 'in_progress' } });
    const sla = await tx.joSlaTracking.findUnique({ where: { jobOrderId: jo.id } });
    if (sla?.stopClockStart && sla.slaDueDate) {
      const pausedMs = Date.now() - sla.stopClockStart.getTime();
      await tx.joSlaTracking.update({
        where: { jobOrderId: jo.id },
        data: { stopClockEnd: new Date(), slaDueDate: new Date(sla.slaDueDate.getTime() + pausedMs) },
      });
    } else {
      await tx.joSlaTracking.update({
        where: { jobOrderId: jo.id },
        data: { stopClockEnd: new Date() },
      });
    }
  });
  return { id: jo.id };
}

export async function complete(id: string, userId: string) {
  const jo = await prisma.jobOrder.findUnique({ where: { id }, include: { slaTracking: true } });
  if (!jo) throw new NotFoundError('Job Order', id);
  assertTransition(DOC_TYPE, jo.status, 'completed');

  const now = new Date();
  let slaMet: boolean | null = null;
  if (jo.slaTracking?.slaDueDate) slaMet = now <= jo.slaTracking.slaDueDate;

  await prisma.$transaction(async tx => {
    await tx.jobOrder.update({
      where: { id: jo.id },
      data: { status: 'completed', completionDate: now, completedById: userId },
    });
    if (slaMet !== null) {
      await tx.joSlaTracking.update({ where: { jobOrderId: jo.id }, data: { slaMet } });
    }
  });

  return { id: jo.id, slaMet };
}

export async function invoice(id: string, paymentData: Record<string, unknown>) {
  const jo = await prisma.jobOrder.findUnique({ where: { id } });
  if (!jo) throw new NotFoundError('Job Order', id);
  assertTransition(DOC_TYPE, jo.status, 'invoiced');

  const result = await prisma.$transaction(async tx => {
    const updated = await tx.jobOrder.update({ where: { id: jo.id }, data: { status: 'invoiced' } });
    const payment = await tx.joPayment.create({
      data: {
        jobOrderId: jo.id,
        invoiceNumber: (paymentData.invoiceNumber as string) ?? null,
        invoiceReceiptDate: paymentData.invoiceReceiptDate ? new Date(paymentData.invoiceReceiptDate as string) : null,
        costExclVat: (paymentData.costExclVat as number) ?? null,
        vatAmount: (paymentData.vatAmount as number) ?? null,
        grandTotal: (paymentData.grandTotal as number) ?? null,
        paymentStatus: (paymentData.paymentStatus as string) ?? 'pending',
        oracleVoucher: (paymentData.oracleVoucher as string) ?? null,
        attachmentUrl: (paymentData.attachmentUrl as string) ?? null,
      },
    });
    return { updated, payment };
  });
  return result;
}

export async function cancel(id: string) {
  const jo = await prisma.jobOrder.findUnique({ where: { id } });
  if (!jo) throw new NotFoundError('Job Order', id);

  const nonCancellable = ['completed', 'invoiced', 'cancelled'];
  if (nonCancellable.includes(jo.status)) {
    throw new BusinessRuleError(`Job Order cannot be cancelled from status: ${jo.status}`);
  }

  return prisma.jobOrder.update({ where: { id: jo.id }, data: { status: 'cancelled' } });
}

export async function addPayment(id: string, paymentData: Record<string, unknown>) {
  const jo = await prisma.jobOrder.findUnique({ where: { id } });
  if (!jo) throw new NotFoundError('Job Order', id);

  return prisma.joPayment.create({
    data: {
      jobOrderId: jo.id,
      invoiceNumber: (paymentData.invoiceNumber as string) ?? null,
      invoiceReceiptDate: paymentData.invoiceReceiptDate ? new Date(paymentData.invoiceReceiptDate as string) : null,
      costExclVat: (paymentData.costExclVat as number) ?? null,
      vatAmount: (paymentData.vatAmount as number) ?? null,
      grandTotal: (paymentData.grandTotal as number) ?? null,
      paymentStatus: (paymentData.paymentStatus as string) ?? 'pending',
      oracleVoucher: (paymentData.oracleVoucher as string) ?? null,
      attachmentUrl: (paymentData.attachmentUrl as string) ?? null,
    },
  });
}

export async function updatePayment(joId: string, paymentId: string, data: Record<string, unknown>) {
  const existing = await prisma.joPayment.findFirst({
    where: { id: paymentId, jobOrderId: joId },
  });
  if (!existing) throw new NotFoundError('Payment', paymentId);

  const updated = await prisma.joPayment.update({
    where: { id: existing.id },
    data: {
      ...(data.invoiceNumber !== undefined ? { invoiceNumber: data.invoiceNumber as string } : {}),
      ...(data.invoiceReceiptDate ? { invoiceReceiptDate: new Date(data.invoiceReceiptDate as string) } : {}),
      ...(data.costExclVat !== undefined ? { costExclVat: data.costExclVat as number } : {}),
      ...(data.vatAmount !== undefined ? { vatAmount: data.vatAmount as number } : {}),
      ...(data.grandTotal !== undefined ? { grandTotal: data.grandTotal as number } : {}),
      ...(data.paymentStatus ? { paymentStatus: data.paymentStatus as string } : {}),
      ...(data.oracleVoucher !== undefined ? { oracleVoucher: data.oracleVoucher as string } : {}),
      ...(data.attachmentUrl !== undefined ? { attachmentUrl: data.attachmentUrl as string } : {}),
      ...(data.paymentStatus === 'approved' ? { paymentApprovedDate: new Date() } : {}),
      ...(data.paymentStatus === 'paid' ? { actualPaymentDate: new Date() } : {}),
    },
  });

  return { existing, updated };
}
