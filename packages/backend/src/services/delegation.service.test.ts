import type { PrismaMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  // vi.hoisted runs before imports, so we must inline the mock creation
  // We can't import createPrismaMock here, so we use a container object
  // that gets populated once the module loads
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import {
  createDelegation,
  listDelegations,
  getDelegation,
  updateDelegation,
  deleteDelegation,
  toggleDelegation,
} from './delegation.service.js';

const DELEGATE_SELECT = { id: true, fullName: true, email: true, department: true };

const INCLUDE_DELEGATES = {
  delegator: { select: DELEGATE_SELECT },
  delegate: { select: DELEGATE_SELECT },
};

describe('delegation.service', () => {
  beforeEach(() => {
    // Replace every property on mockPrisma with a fresh mock
    Object.assign(mockPrisma, createPrismaMock());
  });

  // ---------------------------------------------------------------------------
  // createDelegation
  // ---------------------------------------------------------------------------
  describe('createDelegation', () => {
    const validDto = {
      delegatorId: 'user-1',
      delegateId: 'user-2',
      startDate: '2026-03-01T00:00:00Z',
      endDate: '2026-03-31T00:00:00Z',
    };

    it('should throw when delegator and delegate are the same', async () => {
      await expect(createDelegation({ ...validDto, delegateId: 'user-1' })).rejects.toThrow(
        'Cannot delegate to yourself',
      );

      expect(mockPrisma.delegationRule.create).not.toHaveBeenCalled();
    });

    it('should throw when endDate equals startDate', async () => {
      await expect(createDelegation({ ...validDto, endDate: validDto.startDate })).rejects.toThrow(
        'End date must be after start date',
      );
    });

    it('should throw when endDate is before startDate', async () => {
      await expect(
        createDelegation({
          ...validDto,
          startDate: '2026-06-01T00:00:00Z',
          endDate: '2026-03-01T00:00:00Z',
        }),
      ).rejects.toThrow('End date must be after start date');
    });

    it('should create a delegation rule with correct data and include', async () => {
      const created = { id: 'del-1', ...validDto };
      mockPrisma.delegationRule.create.mockResolvedValue(created);

      const result = await createDelegation(validDto);

      expect(result).toEqual(created);
      expect(mockPrisma.delegationRule.create).toHaveBeenCalledWith({
        data: {
          delegatorId: 'user-1',
          delegateId: 'user-2',
          startDate: new Date('2026-03-01T00:00:00Z'),
          endDate: new Date('2026-03-31T00:00:00Z'),
          scope: 'all',
          notes: undefined,
        },
        include: INCLUDE_DELEGATES,
      });
    });

    it('should default scope to "all" when not provided', async () => {
      mockPrisma.delegationRule.create.mockResolvedValue({});

      await createDelegation(validDto);

      const callArgs = mockPrisma.delegationRule.create.mock.calls[0][0];
      expect(callArgs.data.scope).toBe('all');
    });

    it('should use provided scope and notes', async () => {
      mockPrisma.delegationRule.create.mockResolvedValue({});

      await createDelegation({
        ...validDto,
        scope: 'approvals',
        notes: 'Covering vacation',
      });

      const callArgs = mockPrisma.delegationRule.create.mock.calls[0][0];
      expect(callArgs.data.scope).toBe('approvals');
      expect(callArgs.data.notes).toBe('Covering vacation');
    });
  });

  // ---------------------------------------------------------------------------
  // listDelegations
  // ---------------------------------------------------------------------------
  describe('listDelegations', () => {
    it('should use default pagination (page 1, pageSize 25)', async () => {
      mockPrisma.delegationRule.findMany.mockResolvedValue([]);
      mockPrisma.delegationRule.count.mockResolvedValue(0);

      const result = await listDelegations({});

      expect(result).toEqual({ delegations: [], total: 0, page: 1, pageSize: 25 });
      expect(mockPrisma.delegationRule.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 25 }));
    });

    it('should apply custom pagination', async () => {
      mockPrisma.delegationRule.findMany.mockResolvedValue([]);
      mockPrisma.delegationRule.count.mockResolvedValue(0);

      const result = await listDelegations({ page: 3, pageSize: 10 });

      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(10);
      expect(mockPrisma.delegationRule.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
    });

    it('should filter by userId with OR clause', async () => {
      mockPrisma.delegationRule.findMany.mockResolvedValue([]);
      mockPrisma.delegationRule.count.mockResolvedValue(0);

      await listDelegations({ userId: 'user-1' });

      const findCall = mockPrisma.delegationRule.findMany.mock.calls[0][0];
      expect(findCall.where.OR).toEqual([{ delegatorId: 'user-1' }, { delegateId: 'user-1' }]);
    });

    it('should not add OR clause when userId is absent', async () => {
      mockPrisma.delegationRule.findMany.mockResolvedValue([]);
      mockPrisma.delegationRule.count.mockResolvedValue(0);

      await listDelegations({});

      const findCall = mockPrisma.delegationRule.findMany.mock.calls[0][0];
      expect(findCall.where.OR).toBeUndefined();
    });

    it('should add activeOnly filters when true', async () => {
      mockPrisma.delegationRule.findMany.mockResolvedValue([]);
      mockPrisma.delegationRule.count.mockResolvedValue(0);

      await listDelegations({ activeOnly: true });

      const findCall = mockPrisma.delegationRule.findMany.mock.calls[0][0];
      expect(findCall.where.isActive).toBe(true);
      expect(findCall.where.endDate).toEqual({ gte: expect.any(Date) });
    });

    it('should include delegator and delegate selects and order by createdAt desc', async () => {
      mockPrisma.delegationRule.findMany.mockResolvedValue([]);
      mockPrisma.delegationRule.count.mockResolvedValue(0);

      await listDelegations({});

      expect(mockPrisma.delegationRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: INCLUDE_DELEGATES,
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should pass the same where clause to both findMany and count', async () => {
      mockPrisma.delegationRule.findMany.mockResolvedValue([]);
      mockPrisma.delegationRule.count.mockResolvedValue(5);

      await listDelegations({ userId: 'user-1', activeOnly: true });

      const findWhere = mockPrisma.delegationRule.findMany.mock.calls[0][0].where;
      const countWhere = mockPrisma.delegationRule.count.mock.calls[0][0].where;
      expect(findWhere).toEqual(countWhere);
    });

    it('should return delegations array and total from prisma', async () => {
      const delegations = [{ id: 'del-1' }, { id: 'del-2' }];
      mockPrisma.delegationRule.findMany.mockResolvedValue(delegations);
      mockPrisma.delegationRule.count.mockResolvedValue(42);

      const result = await listDelegations({});

      expect(result.delegations).toEqual(delegations);
      expect(result.total).toBe(42);
    });
  });

  // ---------------------------------------------------------------------------
  // getDelegation
  // ---------------------------------------------------------------------------
  describe('getDelegation', () => {
    it('should call findUnique with id and include', async () => {
      const delegation = { id: 'del-1', delegatorId: 'user-1' };
      mockPrisma.delegationRule.findUnique.mockResolvedValue(delegation);

      const result = await getDelegation('del-1');

      expect(result).toEqual(delegation);
      expect(mockPrisma.delegationRule.findUnique).toHaveBeenCalledWith({
        where: { id: 'del-1' },
        include: INCLUDE_DELEGATES,
      });
    });

    it('should return null when delegation not found', async () => {
      mockPrisma.delegationRule.findUnique.mockResolvedValue(null);

      const result = await getDelegation('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // updateDelegation
  // ---------------------------------------------------------------------------
  describe('updateDelegation', () => {
    it('should convert startDate string to Date', async () => {
      mockPrisma.delegationRule.update.mockResolvedValue({});

      await updateDelegation('del-1', { startDate: '2026-04-01T00:00:00Z' });

      const callArgs = mockPrisma.delegationRule.update.mock.calls[0][0];
      expect(callArgs.data.startDate).toEqual(new Date('2026-04-01T00:00:00Z'));
    });

    it('should convert endDate string to Date', async () => {
      mockPrisma.delegationRule.update.mockResolvedValue({});

      await updateDelegation('del-1', { endDate: '2026-05-01T00:00:00Z' });

      const callArgs = mockPrisma.delegationRule.update.mock.calls[0][0];
      expect(callArgs.data.endDate).toEqual(new Date('2026-05-01T00:00:00Z'));
    });

    it('should pass scope, isActive, and notes when provided', async () => {
      mockPrisma.delegationRule.update.mockResolvedValue({});

      await updateDelegation('del-1', {
        scope: 'purchases',
        isActive: false,
        notes: 'Updated note',
      });

      const callArgs = mockPrisma.delegationRule.update.mock.calls[0][0];
      expect(callArgs.data.scope).toBe('purchases');
      expect(callArgs.data.isActive).toBe(false);
      expect(callArgs.data.notes).toBe('Updated note');
    });

    it('should build only provided fields in data', async () => {
      mockPrisma.delegationRule.update.mockResolvedValue({});

      await updateDelegation('del-1', { notes: 'Only notes' });

      const callArgs = mockPrisma.delegationRule.update.mock.calls[0][0];
      expect(callArgs.data).toEqual({ notes: 'Only notes' });
      expect(callArgs.data.startDate).toBeUndefined();
      expect(callArgs.data.endDate).toBeUndefined();
      expect(callArgs.data.scope).toBeUndefined();
      expect(callArgs.data.isActive).toBeUndefined();
    });

    it('should call update with correct where and include', async () => {
      mockPrisma.delegationRule.update.mockResolvedValue({});

      await updateDelegation('del-1', { scope: 'all' });

      expect(mockPrisma.delegationRule.update).toHaveBeenCalledWith({
        where: { id: 'del-1' },
        data: { scope: 'all' },
        include: INCLUDE_DELEGATES,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // deleteDelegation
  // ---------------------------------------------------------------------------
  describe('deleteDelegation', () => {
    it('should call delete with the provided id', async () => {
      mockPrisma.delegationRule.delete.mockResolvedValue({ id: 'del-1' });

      const result = await deleteDelegation('del-1');

      expect(result).toEqual({ id: 'del-1' });
      expect(mockPrisma.delegationRule.delete).toHaveBeenCalledWith({
        where: { id: 'del-1' },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // toggleDelegation
  // ---------------------------------------------------------------------------
  describe('toggleDelegation', () => {
    it('should throw when delegation is not found', async () => {
      mockPrisma.delegationRule.findUnique.mockResolvedValue(null);

      await expect(toggleDelegation('nonexistent')).rejects.toThrow('Delegation rule not found');

      expect(mockPrisma.delegationRule.update).not.toHaveBeenCalled();
    });

    it('should toggle isActive from true to false', async () => {
      mockPrisma.delegationRule.findUnique.mockResolvedValue({
        id: 'del-1',
        isActive: true,
      });
      mockPrisma.delegationRule.update.mockResolvedValue({
        id: 'del-1',
        isActive: false,
      });

      const result = await toggleDelegation('del-1');

      expect(result.isActive).toBe(false);
      expect(mockPrisma.delegationRule.update).toHaveBeenCalledWith({
        where: { id: 'del-1' },
        data: { isActive: false },
        include: INCLUDE_DELEGATES,
      });
    });

    it('should toggle isActive from false to true', async () => {
      mockPrisma.delegationRule.findUnique.mockResolvedValue({
        id: 'del-1',
        isActive: false,
      });
      mockPrisma.delegationRule.update.mockResolvedValue({
        id: 'del-1',
        isActive: true,
      });

      const result = await toggleDelegation('del-1');

      expect(result.isActive).toBe(true);
      expect(mockPrisma.delegationRule.update).toHaveBeenCalledWith({
        where: { id: 'del-1' },
        data: { isActive: true },
        include: INCLUDE_DELEGATES,
      });
    });

    it('should look up the delegation by id before toggling', async () => {
      mockPrisma.delegationRule.findUnique.mockResolvedValue({
        id: 'del-99',
        isActive: true,
      });
      mockPrisma.delegationRule.update.mockResolvedValue({});

      await toggleDelegation('del-99');

      expect(mockPrisma.delegationRule.findUnique).toHaveBeenCalledWith({
        where: { id: 'del-99' },
      });
    });
  });
});
