import { prisma } from '../utils/prisma.js';

const DELEGATE_SELECT = { id: true, fullName: true, email: true, department: true } as const;

export interface CreateDelegationDto {
  delegatorId: string;
  delegateId: string;
  startDate: string;
  endDate: string;
  scope?: string;
  notes?: string;
}

export interface UpdateDelegationDto {
  startDate?: string;
  endDate?: string;
  scope?: string;
  isActive?: boolean;
  notes?: string;
}

export interface DelegationListParams {
  userId?: string;
  page?: number;
  pageSize?: number;
  activeOnly?: boolean;
}

/**
 * Create a new delegation rule.
 */
export async function createDelegation(dto: CreateDelegationDto) {
  // Validate no self-delegation
  if (dto.delegatorId === dto.delegateId) {
    throw new Error('Cannot delegate to yourself');
  }

  // Validate date range
  const start = new Date(dto.startDate);
  const end = new Date(dto.endDate);
  if (end <= start) {
    throw new Error('End date must be after start date');
  }

  return prisma.delegationRule.create({
    data: {
      delegatorId: dto.delegatorId,
      delegateId: dto.delegateId,
      startDate: start,
      endDate: end,
      scope: dto.scope ?? 'all',
      notes: dto.notes,
    },
    include: {
      delegator: { select: DELEGATE_SELECT },
      delegate: { select: DELEGATE_SELECT },
    },
  });
}

/**
 * List delegation rules.
 * If userId is provided, shows rules where user is delegator or delegate.
 */
export async function listDelegations(params: DelegationListParams) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;

  const where: Record<string, unknown> = {};

  if (params.userId) {
    where.OR = [{ delegatorId: params.userId }, { delegateId: params.userId }];
  }

  if (params.activeOnly) {
    where.isActive = true;
    where.endDate = { gte: new Date() };
  }

  const [delegations, total] = await Promise.all([
    prisma.delegationRule.findMany({
      where,
      include: {
        delegator: { select: DELEGATE_SELECT },
        delegate: { select: DELEGATE_SELECT },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.delegationRule.count({ where }),
  ]);

  return { delegations, total, page, pageSize };
}

/**
 * Get a single delegation by ID.
 */
export async function getDelegation(id: string) {
  return prisma.delegationRule.findUnique({
    where: { id },
    include: {
      delegator: { select: DELEGATE_SELECT },
      delegate: { select: DELEGATE_SELECT },
    },
  });
}

/**
 * Update a delegation rule.
 */
export async function updateDelegation(id: string, dto: UpdateDelegationDto) {
  const data: Record<string, unknown> = {};
  if (dto.startDate) data.startDate = new Date(dto.startDate);
  if (dto.endDate) data.endDate = new Date(dto.endDate);
  if (dto.scope !== undefined) data.scope = dto.scope;
  if (dto.isActive !== undefined) data.isActive = dto.isActive;
  if (dto.notes !== undefined) data.notes = dto.notes;

  return prisma.delegationRule.update({
    where: { id },
    data,
    include: {
      delegator: { select: DELEGATE_SELECT },
      delegate: { select: DELEGATE_SELECT },
    },
  });
}

/**
 * Delete a delegation rule.
 */
export async function deleteDelegation(id: string) {
  return prisma.delegationRule.delete({ where: { id } });
}

/**
 * Toggle active/inactive status.
 */
export async function toggleDelegation(id: string) {
  const existing = await prisma.delegationRule.findUnique({ where: { id } });
  if (!existing) throw new Error('Delegation rule not found');

  return prisma.delegationRule.update({
    where: { id },
    data: { isActive: !existing.isActive },
    include: {
      delegator: { select: DELEGATE_SELECT },
      delegate: { select: DELEGATE_SELECT },
    },
  });
}
