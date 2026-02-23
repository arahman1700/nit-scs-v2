import type { PrismaMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { NotFoundError } from '@nit-scs-v2/shared';
import {
  list,
  getById,
  create,
  update,
  remove,
  getChecklistsByCategory,
  listItems,
  addItem,
  updateItem,
  removeItem,
  reorderItems,
} from './inspection-checklist.service.js';

describe('inspection-checklist.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    (mockPrisma as Record<string, unknown>).inspectionChecklist = {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    };
    (mockPrisma as Record<string, unknown>).inspectionChecklistItem = {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
  });

  // Typed accessors for convenience
  const checklist = () => (mockPrisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>).inspectionChecklist;
  const checklistItem = () =>
    (mockPrisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>).inspectionChecklistItem;

  // ---------------------------------------------------------------------------
  // list
  // ---------------------------------------------------------------------------
  describe('list', () => {
    it('should return all checklists with no filters', async () => {
      const data = [
        { id: 'cl-1', name: 'Concrete QCI', category: 'structural', isActive: true, _count: { items: 3 } },
        { id: 'cl-2', name: 'Steel QCI', category: 'structural', isActive: false, _count: { items: 5 } },
      ];
      checklist().findMany.mockResolvedValue(data);

      const result = await list();

      expect(checklist().findMany).toHaveBeenCalledOnce();
      expect(checklist().findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { items: true } } },
      });
      expect(result).toEqual(data);
    });

    it('should filter by category', async () => {
      checklist().findMany.mockResolvedValue([]);

      await list({ category: 'electrical' });

      expect(checklist().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { category: 'electrical' },
        }),
      );
    });

    it('should filter by isActive', async () => {
      checklist().findMany.mockResolvedValue([]);

      await list({ isActive: true });

      expect(checklist().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        }),
      );
    });

    it('should filter by isActive=false explicitly', async () => {
      checklist().findMany.mockResolvedValue([]);

      await list({ isActive: false });

      expect(checklist().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: false },
        }),
      );
    });

    it('should add OR clause for search across name and description', async () => {
      checklist().findMany.mockResolvedValue([]);

      await list({ search: 'concrete' });

      expect(checklist().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { name: { contains: 'concrete', mode: 'insensitive' } },
              { description: { contains: 'concrete', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });

    it('should combine category, isActive, and search filters', async () => {
      checklist().findMany.mockResolvedValue([]);

      await list({ category: 'mep', isActive: true, search: 'pipe' });

      expect(checklist().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            category: 'mep',
            isActive: true,
            OR: [
              { name: { contains: 'pipe', mode: 'insensitive' } },
              { description: { contains: 'pipe', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getById
  // ---------------------------------------------------------------------------
  describe('getById', () => {
    it('should return a checklist with items ordered by itemOrder', async () => {
      const data = {
        id: 'cl-1',
        name: 'Concrete QCI',
        items: [
          { id: 'item-1', description: 'Check cracks', itemOrder: 1 },
          { id: 'item-2', description: 'Check alignment', itemOrder: 2 },
        ],
      };
      checklist().findUnique.mockResolvedValue(data);

      const result = await getById('cl-1');

      expect(checklist().findUnique).toHaveBeenCalledOnce();
      expect(checklist().findUnique).toHaveBeenCalledWith({
        where: { id: 'cl-1' },
        include: { items: { orderBy: { itemOrder: 'asc' } } },
      });
      expect(result).toEqual(data);
    });

    it('should throw NotFoundError when checklist does not exist', async () => {
      checklist().findUnique.mockResolvedValue(null);

      await expect(getById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------
  describe('create', () => {
    it('should create a checklist without items', async () => {
      const input = { name: 'New Checklist', description: 'A test checklist', category: 'general' };
      const created = { id: 'cl-new', ...input, isActive: true, items: [] };
      checklist().create.mockResolvedValue(created);

      const result = await create(input);

      expect(checklist().create).toHaveBeenCalledOnce();
      expect(checklist().create).toHaveBeenCalledWith({
        data: { name: 'New Checklist', description: 'A test checklist', category: 'general' },
        include: { items: { orderBy: { itemOrder: 'asc' } } },
      });
      expect(result).toEqual(created);
    });

    it('should create a checklist with nested items', async () => {
      const input = {
        name: 'With Items',
        items: [
          { description: 'Item A', itemOrder: 1, isMandatory: false, inspectionType: 'measurement' },
          { description: 'Item B', itemOrder: 2 },
        ],
      };
      const created = { id: 'cl-new', name: 'With Items', items: [] };
      checklist().create.mockResolvedValue(created);

      await create(input);

      expect(checklist().create).toHaveBeenCalledWith({
        data: {
          name: 'With Items',
          items: {
            create: [
              { description: 'Item A', itemOrder: 1, isMandatory: false, inspectionType: 'measurement' },
              { description: 'Item B', itemOrder: 2, isMandatory: true, inspectionType: 'visual' },
            ],
          },
        },
        include: { items: { orderBy: { itemOrder: 'asc' } } },
      });
    });

    it('should default isMandatory=true and inspectionType=visual for items', async () => {
      const input = {
        name: 'Defaults Test',
        items: [{ description: 'Just a description', itemOrder: 1 }],
      };
      checklist().create.mockResolvedValue({ id: 'cl-new', items: [] });

      await create(input);

      const createCall = checklist().create.mock.calls[0][0];
      expect(createCall.data.items.create[0]).toEqual({
        description: 'Just a description',
        itemOrder: 1,
        isMandatory: true,
        inspectionType: 'visual',
      });
    });

    it('should use index+1 as itemOrder when not provided', async () => {
      const input = {
        name: 'Auto Order',
        items: [
          { description: 'First', itemOrder: undefined as unknown as number },
          { description: 'Second', itemOrder: undefined as unknown as number },
        ],
      };
      checklist().create.mockResolvedValue({ id: 'cl-new', items: [] });

      await create(input);

      const createCall = checklist().create.mock.calls[0][0];
      expect(createCall.data.items.create[0].itemOrder).toBe(1);
      expect(createCall.data.items.create[1].itemOrder).toBe(2);
    });

    it('should not include items key when items array is empty', async () => {
      const input = { name: 'No Items', items: [] };
      checklist().create.mockResolvedValue({ id: 'cl-new', items: [] });

      await create(input);

      const createCall = checklist().create.mock.calls[0][0];
      expect(createCall.data).not.toHaveProperty('items');
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------
  describe('update', () => {
    it('should update checklist metadata and return with items', async () => {
      const existing = { id: 'cl-1', name: 'Old Name' };
      checklist().findUnique.mockResolvedValue(existing);
      const updated = { id: 'cl-1', name: 'New Name', items: [] };
      checklist().update.mockResolvedValue(updated);

      const result = await update('cl-1', { name: 'New Name' });

      expect(checklist().findUnique).toHaveBeenCalledWith({ where: { id: 'cl-1' } });
      expect(checklist().update).toHaveBeenCalledWith({
        where: { id: 'cl-1' },
        data: { name: 'New Name' },
        include: { items: { orderBy: { itemOrder: 'asc' } } },
      });
      expect(result).toEqual(updated);
    });

    it('should throw NotFoundError when updating nonexistent checklist', async () => {
      checklist().findUnique.mockResolvedValue(null);

      await expect(update('nonexistent', { name: 'X' })).rejects.toThrow(NotFoundError);
      expect(checklist().update).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // remove
  // ---------------------------------------------------------------------------
  describe('remove', () => {
    it('should delete checklist and return { deleted: true }', async () => {
      checklist().findUnique.mockResolvedValue({ id: 'cl-1' });
      checklist().delete.mockResolvedValue({ id: 'cl-1' });

      const result = await remove('cl-1');

      expect(checklist().findUnique).toHaveBeenCalledWith({ where: { id: 'cl-1' } });
      expect(checklist().delete).toHaveBeenCalledWith({ where: { id: 'cl-1' } });
      expect(result).toEqual({ deleted: true });
    });

    it('should throw NotFoundError when deleting nonexistent checklist', async () => {
      checklist().findUnique.mockResolvedValue(null);

      await expect(remove('nonexistent')).rejects.toThrow(NotFoundError);
      expect(checklist().delete).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // getChecklistsByCategory
  // ---------------------------------------------------------------------------
  describe('getChecklistsByCategory', () => {
    it('should return active checklists for a given category ordered by name', async () => {
      const data = [
        { id: 'cl-1', name: 'Alpha', category: 'structural', isActive: true, _count: { items: 2 } },
        { id: 'cl-2', name: 'Beta', category: 'structural', isActive: true, _count: { items: 4 } },
      ];
      checklist().findMany.mockResolvedValue(data);

      const result = await getChecklistsByCategory('structural');

      expect(checklist().findMany).toHaveBeenCalledOnce();
      expect(checklist().findMany).toHaveBeenCalledWith({
        where: { category: 'structural', isActive: true },
        orderBy: { name: 'asc' },
        include: { _count: { select: { items: true } } },
      });
      expect(result).toEqual(data);
    });

    it('should return empty array when no active checklists exist for category', async () => {
      checklist().findMany.mockResolvedValue([]);

      const result = await getChecklistsByCategory('nonexistent');

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // listItems
  // ---------------------------------------------------------------------------
  describe('listItems', () => {
    it('should return items ordered by itemOrder for a valid checklist', async () => {
      checklist().findUnique.mockResolvedValue({ id: 'cl-1' });
      const items = [
        { id: 'item-1', description: 'First', itemOrder: 1 },
        { id: 'item-2', description: 'Second', itemOrder: 2 },
      ];
      checklistItem().findMany.mockResolvedValue(items);

      const result = await listItems('cl-1');

      expect(checklist().findUnique).toHaveBeenCalledWith({ where: { id: 'cl-1' } });
      expect(checklistItem().findMany).toHaveBeenCalledWith({
        where: { checklistId: 'cl-1' },
        orderBy: { itemOrder: 'asc' },
      });
      expect(result).toEqual(items);
    });

    it('should throw NotFoundError when checklist does not exist', async () => {
      checklist().findUnique.mockResolvedValue(null);

      await expect(listItems('nonexistent')).rejects.toThrow(NotFoundError);
      expect(checklistItem().findMany).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // addItem
  // ---------------------------------------------------------------------------
  describe('addItem', () => {
    it('should add an item with explicit values', async () => {
      checklist().findUnique.mockResolvedValue({ id: 'cl-1' });
      const created = {
        id: 'item-new',
        checklistId: 'cl-1',
        description: 'Check bolts',
        itemOrder: 3,
        isMandatory: false,
        inspectionType: 'measurement',
      };
      checklistItem().create.mockResolvedValue(created);

      const result = await addItem('cl-1', {
        description: 'Check bolts',
        itemOrder: 3,
        isMandatory: false,
        inspectionType: 'measurement',
      });

      expect(checklist().findUnique).toHaveBeenCalledWith({ where: { id: 'cl-1' } });
      expect(checklistItem().create).toHaveBeenCalledWith({
        data: {
          checklistId: 'cl-1',
          description: 'Check bolts',
          itemOrder: 3,
          isMandatory: false,
          inspectionType: 'measurement',
        },
      });
      expect(result).toEqual(created);
    });

    it('should default isMandatory=true and inspectionType=visual', async () => {
      checklist().findUnique.mockResolvedValue({ id: 'cl-1' });
      checklistItem().create.mockResolvedValue({ id: 'item-new' });

      await addItem('cl-1', { description: 'Visual check', itemOrder: 1 });

      expect(checklistItem().create).toHaveBeenCalledWith({
        data: {
          checklistId: 'cl-1',
          description: 'Visual check',
          itemOrder: 1,
          isMandatory: true,
          inspectionType: 'visual',
        },
      });
    });

    it('should throw NotFoundError when checklist does not exist', async () => {
      checklist().findUnique.mockResolvedValue(null);

      await expect(addItem('nonexistent', { description: 'Test', itemOrder: 1 })).rejects.toThrow(NotFoundError);
      expect(checklistItem().create).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // updateItem
  // ---------------------------------------------------------------------------
  describe('updateItem', () => {
    it('should partially update only provided fields', async () => {
      checklistItem().findUnique.mockResolvedValue({ id: 'item-1', description: 'Old' });
      checklistItem().update.mockResolvedValue({ id: 'item-1', description: 'New' });

      const result = await updateItem('item-1', { description: 'New' });

      expect(checklistItem().findUnique).toHaveBeenCalledWith({ where: { id: 'item-1' } });
      expect(checklistItem().update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { description: 'New' },
      });
      expect(result).toEqual({ id: 'item-1', description: 'New' });
    });

    it('should update multiple fields at once', async () => {
      checklistItem().findUnique.mockResolvedValue({ id: 'item-1' });
      checklistItem().update.mockResolvedValue({ id: 'item-1' });

      await updateItem('item-1', {
        description: 'Updated',
        itemOrder: 5,
        isMandatory: false,
        inspectionType: 'measurement',
      });

      expect(checklistItem().update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: {
          description: 'Updated',
          itemOrder: 5,
          isMandatory: false,
          inspectionType: 'measurement',
        },
      });
    });

    it('should not include undefined fields in the update data', async () => {
      checklistItem().findUnique.mockResolvedValue({ id: 'item-1' });
      checklistItem().update.mockResolvedValue({ id: 'item-1' });

      await updateItem('item-1', { description: 'Only description' });

      const callData = checklistItem().update.mock.calls[0][0].data;
      expect(callData).toEqual({ description: 'Only description' });
      expect(callData).not.toHaveProperty('itemOrder');
      expect(callData).not.toHaveProperty('isMandatory');
      expect(callData).not.toHaveProperty('inspectionType');
    });

    it('should throw NotFoundError when item does not exist', async () => {
      checklistItem().findUnique.mockResolvedValue(null);

      await expect(updateItem('nonexistent', { description: 'X' })).rejects.toThrow(NotFoundError);
      expect(checklistItem().update).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // removeItem
  // ---------------------------------------------------------------------------
  describe('removeItem', () => {
    it('should delete the item and return { deleted: true }', async () => {
      checklistItem().findUnique.mockResolvedValue({ id: 'item-1' });
      checklistItem().delete.mockResolvedValue({ id: 'item-1' });

      const result = await removeItem('item-1');

      expect(checklistItem().findUnique).toHaveBeenCalledWith({ where: { id: 'item-1' } });
      expect(checklistItem().delete).toHaveBeenCalledWith({ where: { id: 'item-1' } });
      expect(result).toEqual({ deleted: true });
    });

    it('should throw NotFoundError when item does not exist', async () => {
      checklistItem().findUnique.mockResolvedValue(null);

      await expect(removeItem('nonexistent')).rejects.toThrow(NotFoundError);
      expect(checklistItem().delete).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // reorderItems
  // ---------------------------------------------------------------------------
  describe('reorderItems', () => {
    it('should update itemOrder for each item via $transaction and return reordered list', async () => {
      checklist().findUnique.mockResolvedValue({ id: 'cl-1' });
      // Each update call returns a resolved promise
      checklistItem().update.mockResolvedValue({});
      const reorderedItems = [
        { id: 'item-b', itemOrder: 1 },
        { id: 'item-a', itemOrder: 2 },
        { id: 'item-c', itemOrder: 3 },
      ];
      checklistItem().findMany.mockResolvedValue(reorderedItems);

      const result = await reorderItems('cl-1', ['item-b', 'item-a', 'item-c']);

      expect(checklist().findUnique).toHaveBeenCalledWith({ where: { id: 'cl-1' } });
      // $transaction is called with an array of update promises
      expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
      // Each update sets itemOrder = index + 1
      expect(checklistItem().update).toHaveBeenCalledTimes(3);
      expect(checklistItem().update).toHaveBeenCalledWith({
        where: { id: 'item-b' },
        data: { itemOrder: 1 },
      });
      expect(checklistItem().update).toHaveBeenCalledWith({
        where: { id: 'item-a' },
        data: { itemOrder: 2 },
      });
      expect(checklistItem().update).toHaveBeenCalledWith({
        where: { id: 'item-c' },
        data: { itemOrder: 3 },
      });
      // Returns the re-fetched items
      expect(checklistItem().findMany).toHaveBeenCalledWith({
        where: { checklistId: 'cl-1' },
        orderBy: { itemOrder: 'asc' },
      });
      expect(result).toEqual(reorderedItems);
    });

    it('should throw NotFoundError when checklist does not exist', async () => {
      checklist().findUnique.mockResolvedValue(null);

      await expect(reorderItems('nonexistent', ['item-1'])).rejects.toThrow(NotFoundError);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should handle empty itemIds array', async () => {
      checklist().findUnique.mockResolvedValue({ id: 'cl-1' });
      checklistItem().findMany.mockResolvedValue([]);

      const result = await reorderItems('cl-1', []);

      expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
      expect(checklistItem().update).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });
});
