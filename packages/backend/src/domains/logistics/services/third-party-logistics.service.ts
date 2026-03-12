/**
 * Third-Party Logistics (3PL) Billing Service — V2
 *
 * Manages 3PL contracts with external logistics providers and their
 * associated charges. Supports the full billing lifecycle:
 * Contracts: draft -> active -> suspended/terminated
 * Charges:   draft -> approved -> invoiced -> paid (or disputed)
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../../utils/prisma.js';
import { NotFoundError } from '@nit-scs-v2/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContractFilters {
  supplierId?: string;
  status?: string;
  serviceType?: string;
  page?: number;
  pageSize?: number;
}

export interface ChargeFilters {
  contractId?: string;
  status?: string;
  chargeType?: string;
  warehouseId?: string;
  page?: number;
  pageSize?: number;
}

export interface ContractSummary {
  contractId: string;
  draft: number;
  approved: number;
  invoiced: number;
  paid: number;
  disputed: number;
  totalAmount: number;
}

// ---------------------------------------------------------------------------
// Include presets
// ---------------------------------------------------------------------------

const CONTRACT_DETAIL_INCLUDE = {
  supplier: { select: { id: true, supplierName: true, supplierCode: true } },
  charges: { select: { id: true, chargeType: true, totalAmount: true, status: true } },
} satisfies Prisma.ThirdPartyContractInclude;

const CHARGE_DETAIL_INCLUDE = {
  contract: {
    select: {
      id: true,
      contractCode: true,
      supplier: { select: { id: true, supplierName: true } },
    },
  },
  warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
} satisfies Prisma.ThirdPartyChargeInclude;

// ---------------------------------------------------------------------------
// Contract CRUD
// ---------------------------------------------------------------------------

/** Creates a new 3PL contract with supplier details. */
export async function createContract(data: Prisma.ThirdPartyContractUncheckedCreateInput) {
  return prisma.thirdPartyContract.create({
    data,
    include: CONTRACT_DETAIL_INCLUDE,
  });
}

/** Retrieves a 3PL contract by ID with supplier and charges, or throws NotFoundError. */
export async function getContractById(id: string) {
  const record = await prisma.thirdPartyContract.findUnique({
    where: { id },
    include: CONTRACT_DETAIL_INCLUDE,
  });
  if (!record) throw new NotFoundError('ThirdPartyContract', id);
  return record;
}

/** Lists 3PL contracts with optional supplier/status/serviceType filters and pagination. */
export async function getContracts(filters: ContractFilters) {
  const where: Prisma.ThirdPartyContractWhereInput = {};
  if (filters.supplierId) where.supplierId = filters.supplierId;
  if (filters.status) where.status = filters.status;
  if (filters.serviceType) where.serviceType = filters.serviceType;

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const [data, total] = await Promise.all([
    prisma.thirdPartyContract.findMany({
      where,
      include: CONTRACT_DETAIL_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.thirdPartyContract.count({ where }),
  ]);

  return { data, total, page, pageSize };
}

// ---------------------------------------------------------------------------
// Contract State Transitions
// ---------------------------------------------------------------------------

/** Transitions a draft contract to active status. */
export async function activateContract(id: string) {
  const record = await prisma.thirdPartyContract.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('ThirdPartyContract', id);
  if (record.status !== 'draft') {
    throw new Error(`Cannot activate contract in status '${record.status}'. Must be 'draft'.`);
  }

  return prisma.thirdPartyContract.update({
    where: { id },
    data: { status: 'active' },
    include: CONTRACT_DETAIL_INCLUDE,
  });
}

/** Suspends an active contract. */
export async function suspendContract(id: string) {
  const record = await prisma.thirdPartyContract.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('ThirdPartyContract', id);
  if (record.status !== 'active') {
    throw new Error(`Cannot suspend contract in status '${record.status}'. Must be 'active'.`);
  }

  return prisma.thirdPartyContract.update({
    where: { id },
    data: { status: 'suspended' },
    include: CONTRACT_DETAIL_INCLUDE,
  });
}

/** Terminates a contract that is not already terminated. */
export async function terminateContract(id: string) {
  const record = await prisma.thirdPartyContract.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('ThirdPartyContract', id);
  if (record.status === 'terminated') {
    throw new Error(`Contract is already terminated.`);
  }

  return prisma.thirdPartyContract.update({
    where: { id },
    data: { status: 'terminated' },
    include: CONTRACT_DETAIL_INCLUDE,
  });
}

// ---------------------------------------------------------------------------
// Charge CRUD
// ---------------------------------------------------------------------------

/** Creates a new charge record against a 3PL contract. Rejects terminated contracts. */
export async function createCharge(data: Prisma.ThirdPartyChargeUncheckedCreateInput) {
  if (data.contractId) {
    const contract = await prisma.thirdPartyContract.findUnique({
      where: { id: data.contractId },
    });
    if (contract && contract.status === 'terminated') {
      throw new Error('Cannot create charge on a terminated contract.');
    }
  }

  return prisma.thirdPartyCharge.create({
    data,
    include: CHARGE_DETAIL_INCLUDE,
  });
}

/** Lists 3PL charges with optional contract/status/type/warehouse filters and pagination. */
export async function getCharges(filters: ChargeFilters) {
  const where: Prisma.ThirdPartyChargeWhereInput = {};
  if (filters.contractId) where.contractId = filters.contractId;
  if (filters.status) where.status = filters.status;
  if (filters.chargeType) where.chargeType = filters.chargeType;
  if (filters.warehouseId) where.warehouseId = filters.warehouseId;

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const [data, total] = await Promise.all([
    prisma.thirdPartyCharge.findMany({
      where,
      include: CHARGE_DETAIL_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.thirdPartyCharge.count({ where }),
  ]);

  return { data, total, page, pageSize };
}

// ---------------------------------------------------------------------------
// Charge State Transitions
// ---------------------------------------------------------------------------

/** Approves a draft charge and records the approver. */
export async function approveCharge(id: string, approvedById: string) {
  const record = await prisma.thirdPartyCharge.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('ThirdPartyCharge', id);
  if (record.status !== 'draft') {
    throw new Error(`Cannot approve charge in status '${record.status}'. Must be 'draft'.`);
  }

  return prisma.thirdPartyCharge.update({
    where: { id },
    data: { status: 'approved', approvedById, approvedAt: new Date() },
    include: CHARGE_DETAIL_INCLUDE,
  });
}

/** Marks an approved charge as invoiced. */
export async function invoiceCharge(id: string) {
  const record = await prisma.thirdPartyCharge.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('ThirdPartyCharge', id);
  if (record.status !== 'approved') {
    throw new Error(`Cannot invoice charge in status '${record.status}'. Must be 'approved'.`);
  }

  return prisma.thirdPartyCharge.update({
    where: { id },
    data: { status: 'invoiced' },
    include: CHARGE_DETAIL_INCLUDE,
  });
}

/** Marks an invoiced charge as paid. */
export async function payCharge(id: string) {
  const record = await prisma.thirdPartyCharge.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('ThirdPartyCharge', id);
  if (record.status !== 'invoiced') {
    throw new Error(`Cannot pay charge in status '${record.status}'. Must be 'invoiced'.`);
  }

  return prisma.thirdPartyCharge.update({
    where: { id },
    data: { status: 'paid' },
    include: CHARGE_DETAIL_INCLUDE,
  });
}

/** Flags a non-paid charge as disputed. */
export async function disputeCharge(id: string) {
  const record = await prisma.thirdPartyCharge.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('ThirdPartyCharge', id);
  if (record.status === 'disputed') {
    throw new Error(`Charge is already disputed.`);
  }
  if (record.status === 'paid') {
    throw new Error(`Cannot dispute a paid charge.`);
  }

  return prisma.thirdPartyCharge.update({
    where: { id },
    data: { status: 'disputed' },
    include: CHARGE_DETAIL_INCLUDE,
  });
}

// ---------------------------------------------------------------------------
// Contract Summary
// ---------------------------------------------------------------------------

/** Returns an aggregated billing summary for a contract, broken down by charge status. */
export async function getContractSummary(contractId: string): Promise<ContractSummary> {
  const contract = await prisma.thirdPartyContract.findUnique({ where: { id: contractId } });
  if (!contract) throw new NotFoundError('ThirdPartyContract', contractId);

  const charges = await prisma.thirdPartyCharge.findMany({
    where: { contractId },
    select: { status: true, totalAmount: true },
  });

  const summary: ContractSummary = {
    contractId,
    draft: 0,
    approved: 0,
    invoiced: 0,
    paid: 0,
    disputed: 0,
    totalAmount: 0,
  };

  for (const charge of charges) {
    const amount = Number(charge.totalAmount);
    summary.totalAmount += amount;

    switch (charge.status) {
      case 'draft':
        summary.draft += amount;
        break;
      case 'approved':
        summary.approved += amount;
        break;
      case 'invoiced':
        summary.invoiced += amount;
        break;
      case 'paid':
        summary.paid += amount;
        break;
      case 'disputed':
        summary.disputed += amount;
        break;
    }
  }

  return summary;
}
