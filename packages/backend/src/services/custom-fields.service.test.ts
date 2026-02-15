import type { PrismaMock } from '../test-utils/prisma-mock.js';

const MockJsonNull = vi.hoisted(() => Symbol('JsonNull'));

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('@prisma/client', () => ({
  Prisma: { JsonNull: MockJsonNull, InputJsonValue: null },
}));
vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import {
  listFieldDefinitions,
  getFieldDefinition,
  createFieldDefinition,
  updateFieldDefinition,
  deleteFieldDefinition,
  getCustomFieldValues,
  setCustomFieldValues,
  deleteCustomFieldValues,
} from './custom-fields.service.js';

describe('custom-fields.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    // Add findUniqueOrThrow since PrismaModelMock doesn't include it
    (mockPrisma.customFieldDefinition as Record<string, unknown>).findUniqueOrThrow = vi.fn();
  });

  // ---------------------------------------------------------------------------
  // listFieldDefinitions
  // ---------------------------------------------------------------------------
  describe('listFieldDefinitions', () => {
    it('should return all definitions when no entityType is given', async () => {
      const definitions = [
        { id: 'def-1', entityType: 'grn', fieldKey: 'customNote', label: 'Custom Note' },
        { id: 'def-2', entityType: 'mi', fieldKey: 'priority', label: 'Priority' },
      ];
      mockPrisma.customFieldDefinition.findMany.mockResolvedValue(definitions);

      const result = await listFieldDefinitions();

      expect(mockPrisma.customFieldDefinition.findMany).toHaveBeenCalledOnce();
      expect(mockPrisma.customFieldDefinition.findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: [{ entityType: 'asc' }, { sortOrder: 'asc' }],
      });
      expect(result).toEqual(definitions);
    });

    it('should filter by entityType when provided', async () => {
      const definitions = [{ id: 'def-1', entityType: 'grn', fieldKey: 'customNote', label: 'Custom Note' }];
      mockPrisma.customFieldDefinition.findMany.mockResolvedValue(definitions);

      const result = await listFieldDefinitions('grn');

      expect(mockPrisma.customFieldDefinition.findMany).toHaveBeenCalledWith({
        where: { entityType: 'grn' },
        orderBy: [{ entityType: 'asc' }, { sortOrder: 'asc' }],
      });
      expect(result).toEqual(definitions);
    });

    it('should return empty array when no definitions exist', async () => {
      mockPrisma.customFieldDefinition.findMany.mockResolvedValue([]);

      const result = await listFieldDefinitions('nonexistent');

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // getFieldDefinition
  // ---------------------------------------------------------------------------
  describe('getFieldDefinition', () => {
    it('should delegate to findUniqueOrThrow with the correct id', async () => {
      const definition = {
        id: 'def-1',
        entityType: 'grn',
        fieldKey: 'customNote',
        label: 'Custom Note',
        fieldType: 'text',
      };
      const findUniqueOrThrow = (mockPrisma.customFieldDefinition as Record<string, ReturnType<typeof vi.fn>>)
        .findUniqueOrThrow;
      findUniqueOrThrow.mockResolvedValue(definition);

      const result = await getFieldDefinition('def-1');

      expect(findUniqueOrThrow).toHaveBeenCalledOnce();
      expect(findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: 'def-1' } });
      expect(result).toEqual(definition);
    });

    it('should propagate errors when definition not found', async () => {
      const findUniqueOrThrow = (mockPrisma.customFieldDefinition as Record<string, ReturnType<typeof vi.fn>>)
        .findUniqueOrThrow;
      findUniqueOrThrow.mockRejectedValue(new Error('Record not found'));

      await expect(getFieldDefinition('nonexistent')).rejects.toThrow('Record not found');
    });
  });

  // ---------------------------------------------------------------------------
  // createFieldDefinition
  // ---------------------------------------------------------------------------
  describe('createFieldDefinition', () => {
    it('should create with all fields provided', async () => {
      const input = {
        entityType: 'grn',
        fieldKey: 'customNote',
        label: 'Custom Note',
        fieldType: 'text',
        options: ['Option A', 'Option B'],
        isRequired: true,
        showInGrid: true,
        sortOrder: 5,
      };
      const created = { id: 'def-1', ...input };
      mockPrisma.customFieldDefinition.create.mockResolvedValue(created);

      const result = await createFieldDefinition(input);

      expect(mockPrisma.customFieldDefinition.create).toHaveBeenCalledOnce();
      expect(mockPrisma.customFieldDefinition.create).toHaveBeenCalledWith({
        data: {
          entityType: 'grn',
          fieldKey: 'customNote',
          label: 'Custom Note',
          fieldType: 'text',
          options: ['Option A', 'Option B'],
          isRequired: true,
          showInGrid: true,
          sortOrder: 5,
        },
      });
      expect(result).toEqual(created);
    });

    it('should apply defaults for isRequired, showInGrid, and sortOrder', async () => {
      const input = {
        entityType: 'mi',
        fieldKey: 'urgency',
        label: 'Urgency',
        fieldType: 'select',
        options: ['Low', 'Medium', 'High'],
      };
      mockPrisma.customFieldDefinition.create.mockResolvedValue({ id: 'def-2', ...input });

      await createFieldDefinition(input);

      expect(mockPrisma.customFieldDefinition.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isRequired: false,
          showInGrid: false,
          sortOrder: 0,
        }),
      });
    });

    it('should use Prisma.JsonNull when options is null', async () => {
      const input = {
        entityType: 'grn',
        fieldKey: 'textField',
        label: 'Text Field',
        fieldType: 'text',
        options: null as unknown as undefined,
      };
      mockPrisma.customFieldDefinition.create.mockResolvedValue({ id: 'def-3' });

      await createFieldDefinition(input);

      expect(mockPrisma.customFieldDefinition.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          options: MockJsonNull,
        }),
      });
    });

    it('should use Prisma.JsonNull when options is undefined', async () => {
      const input = {
        entityType: 'grn',
        fieldKey: 'textField',
        label: 'Text Field',
        fieldType: 'text',
      };
      mockPrisma.customFieldDefinition.create.mockResolvedValue({ id: 'def-4' });

      await createFieldDefinition(input);

      expect(mockPrisma.customFieldDefinition.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          options: MockJsonNull,
        }),
      });
    });

    it('should use options as InputJsonValue when truthy', async () => {
      const options = { choices: ['A', 'B'] };
      const input = {
        entityType: 'grn',
        fieldKey: 'selectField',
        label: 'Select Field',
        fieldType: 'select',
        options,
      };
      mockPrisma.customFieldDefinition.create.mockResolvedValue({ id: 'def-5' });

      await createFieldDefinition(input);

      expect(mockPrisma.customFieldDefinition.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          options: { choices: ['A', 'B'] },
        }),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // updateFieldDefinition
  // ---------------------------------------------------------------------------
  describe('updateFieldDefinition', () => {
    it('should only update fields that are defined in the data object', async () => {
      mockPrisma.customFieldDefinition.update.mockResolvedValue({ id: 'def-1', label: 'Updated' });

      await updateFieldDefinition('def-1', { label: 'Updated' });

      expect(mockPrisma.customFieldDefinition.update).toHaveBeenCalledOnce();
      expect(mockPrisma.customFieldDefinition.update).toHaveBeenCalledWith({
        where: { id: 'def-1' },
        data: { label: 'Updated' },
      });
    });

    it('should update multiple fields simultaneously', async () => {
      mockPrisma.customFieldDefinition.update.mockResolvedValue({ id: 'def-1' });

      await updateFieldDefinition('def-1', {
        label: 'New Label',
        fieldType: 'number',
        isRequired: true,
        showInGrid: true,
        sortOrder: 10,
      });

      expect(mockPrisma.customFieldDefinition.update).toHaveBeenCalledWith({
        where: { id: 'def-1' },
        data: {
          label: 'New Label',
          fieldType: 'number',
          isRequired: true,
          showInGrid: true,
          sortOrder: 10,
        },
      });
    });

    it('should use Prisma.JsonNull when options is falsy (null)', async () => {
      mockPrisma.customFieldDefinition.update.mockResolvedValue({ id: 'def-1' });

      await updateFieldDefinition('def-1', { options: null });

      expect(mockPrisma.customFieldDefinition.update).toHaveBeenCalledWith({
        where: { id: 'def-1' },
        data: { options: MockJsonNull },
      });
    });

    it('should use Prisma.JsonNull when options is empty string (falsy)', async () => {
      mockPrisma.customFieldDefinition.update.mockResolvedValue({ id: 'def-1' });

      await updateFieldDefinition('def-1', { options: '' });

      expect(mockPrisma.customFieldDefinition.update).toHaveBeenCalledWith({
        where: { id: 'def-1' },
        data: { options: MockJsonNull },
      });
    });

    it('should pass options as InputJsonValue when truthy', async () => {
      const options = ['Option1', 'Option2'];
      mockPrisma.customFieldDefinition.update.mockResolvedValue({ id: 'def-1' });

      await updateFieldDefinition('def-1', { options });

      expect(mockPrisma.customFieldDefinition.update).toHaveBeenCalledWith({
        where: { id: 'def-1' },
        data: { options: ['Option1', 'Option2'] },
      });
    });

    it('should not include options key when options is not in data', async () => {
      mockPrisma.customFieldDefinition.update.mockResolvedValue({ id: 'def-1' });

      await updateFieldDefinition('def-1', { label: 'Only Label' });

      const callData = mockPrisma.customFieldDefinition.update.mock.calls[0][0].data;
      expect(callData).not.toHaveProperty('options');
    });

    it('should pass empty data object when no fields are defined', async () => {
      mockPrisma.customFieldDefinition.update.mockResolvedValue({ id: 'def-1' });

      await updateFieldDefinition('def-1', {});

      expect(mockPrisma.customFieldDefinition.update).toHaveBeenCalledWith({
        where: { id: 'def-1' },
        data: {},
      });
    });

    it('should update label when provided', async () => {
      mockPrisma.customFieldDefinition.update.mockResolvedValue({ id: 'def-1' });

      await updateFieldDefinition('def-1', { label: 'Updated Label' });

      expect(mockPrisma.customFieldDefinition.update).toHaveBeenCalledWith({
        where: { id: 'def-1' },
        data: { label: 'Updated Label' },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // deleteFieldDefinition
  // ---------------------------------------------------------------------------
  describe('deleteFieldDefinition', () => {
    it('should delete all associated values before deleting the definition', async () => {
      mockPrisma.customFieldValue.deleteMany.mockResolvedValue({ count: 3 });
      mockPrisma.customFieldDefinition.delete.mockResolvedValue({ id: 'def-1' });

      const callOrder: string[] = [];
      mockPrisma.customFieldValue.deleteMany.mockImplementation(async () => {
        callOrder.push('deleteValues');
        return { count: 3 };
      });
      mockPrisma.customFieldDefinition.delete.mockImplementation(async () => {
        callOrder.push('deleteDefinition');
        return { id: 'def-1' };
      });

      await deleteFieldDefinition('def-1');

      expect(callOrder).toEqual(['deleteValues', 'deleteDefinition']);
    });

    it('should call deleteMany on customFieldValue with correct definitionId', async () => {
      mockPrisma.customFieldValue.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.customFieldDefinition.delete.mockResolvedValue({ id: 'def-1' });

      await deleteFieldDefinition('def-1');

      expect(mockPrisma.customFieldValue.deleteMany).toHaveBeenCalledOnce();
      expect(mockPrisma.customFieldValue.deleteMany).toHaveBeenCalledWith({
        where: { definitionId: 'def-1' },
      });
    });

    it('should call delete on customFieldDefinition with correct id', async () => {
      mockPrisma.customFieldValue.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.customFieldDefinition.delete.mockResolvedValue({ id: 'def-1' });

      await deleteFieldDefinition('def-1');

      expect(mockPrisma.customFieldDefinition.delete).toHaveBeenCalledOnce();
      expect(mockPrisma.customFieldDefinition.delete).toHaveBeenCalledWith({
        where: { id: 'def-1' },
      });
    });

    it('should return the deleted definition', async () => {
      const deleted = { id: 'def-1', entityType: 'grn', fieldKey: 'note' };
      mockPrisma.customFieldValue.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.customFieldDefinition.delete.mockResolvedValue(deleted);

      const result = await deleteFieldDefinition('def-1');

      expect(result).toEqual(deleted);
    });

    it('should propagate errors from deleteMany', async () => {
      mockPrisma.customFieldValue.deleteMany.mockRejectedValue(new Error('FK constraint'));

      await expect(deleteFieldDefinition('def-1')).rejects.toThrow('FK constraint');
      expect(mockPrisma.customFieldDefinition.delete).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // getCustomFieldValues
  // ---------------------------------------------------------------------------
  describe('getCustomFieldValues', () => {
    it('should return a flat object mapping fieldKey to value', async () => {
      const values = [
        { id: 'v-1', value: 'Hello', definition: { fieldKey: 'customNote' } },
        { id: 'v-2', value: 42, definition: { fieldKey: 'priority' } },
        { id: 'v-3', value: true, definition: { fieldKey: 'urgent' } },
      ];
      mockPrisma.customFieldValue.findMany.mockResolvedValue(values);

      const result = await getCustomFieldValues('grn', 'grn-001');

      expect(mockPrisma.customFieldValue.findMany).toHaveBeenCalledOnce();
      expect(mockPrisma.customFieldValue.findMany).toHaveBeenCalledWith({
        where: { entityType: 'grn', entityId: 'grn-001' },
        include: { definition: { select: { fieldKey: true } } },
      });
      expect(result).toEqual({
        customNote: 'Hello',
        priority: 42,
        urgent: true,
      });
    });

    it('should return an empty object when no values exist', async () => {
      mockPrisma.customFieldValue.findMany.mockResolvedValue([]);

      const result = await getCustomFieldValues('mi', 'mi-001');

      expect(result).toEqual({});
    });

    it('should handle null values correctly', async () => {
      const values = [{ id: 'v-1', value: null, definition: { fieldKey: 'optionalField' } }];
      mockPrisma.customFieldValue.findMany.mockResolvedValue(values);

      const result = await getCustomFieldValues('grn', 'grn-002');

      expect(result).toEqual({ optionalField: null });
    });

    it('should handle complex JSON values', async () => {
      const complexValue = { nested: { data: [1, 2, 3] } };
      const values = [{ id: 'v-1', value: complexValue, definition: { fieldKey: 'metadata' } }];
      mockPrisma.customFieldValue.findMany.mockResolvedValue(values);

      const result = await getCustomFieldValues('grn', 'grn-003');

      expect(result).toEqual({ metadata: complexValue });
    });
  });

  // ---------------------------------------------------------------------------
  // setCustomFieldValues
  // ---------------------------------------------------------------------------
  describe('setCustomFieldValues', () => {
    it('should upsert each value with correct composite key', async () => {
      const definitions = [
        { id: 'def-1', fieldKey: 'customNote', entityType: 'grn' },
        { id: 'def-2', fieldKey: 'priority', entityType: 'grn' },
      ];
      mockPrisma.customFieldDefinition.findMany.mockResolvedValue(definitions);
      mockPrisma.customFieldValue.upsert.mockResolvedValue({});

      await setCustomFieldValues('grn', 'grn-001', {
        customNote: 'Test note',
        priority: 'High',
      });

      expect(mockPrisma.customFieldDefinition.findMany).toHaveBeenCalledWith({
        where: { entityType: 'grn' },
      });

      expect(mockPrisma.customFieldValue.upsert).toHaveBeenCalledTimes(2);

      expect(mockPrisma.customFieldValue.upsert).toHaveBeenCalledWith({
        where: {
          definitionId_entityId: {
            definitionId: 'def-1',
            entityId: 'grn-001',
          },
        },
        update: { value: 'Test note' },
        create: {
          definitionId: 'def-1',
          entityType: 'grn',
          entityId: 'grn-001',
          value: 'Test note',
        },
      });

      expect(mockPrisma.customFieldValue.upsert).toHaveBeenCalledWith({
        where: {
          definitionId_entityId: {
            definitionId: 'def-2',
            entityId: 'grn-001',
          },
        },
        update: { value: 'High' },
        create: {
          definitionId: 'def-2',
          entityType: 'grn',
          entityId: 'grn-001',
          value: 'High',
        },
      });
    });

    it('should skip unknown field keys not in definitions', async () => {
      const definitions = [{ id: 'def-1', fieldKey: 'knownField', entityType: 'grn' }];
      mockPrisma.customFieldDefinition.findMany.mockResolvedValue(definitions);
      mockPrisma.customFieldValue.upsert.mockResolvedValue({});

      await setCustomFieldValues('grn', 'grn-001', {
        knownField: 'value1',
        unknownField: 'value2',
        anotherUnknown: 'value3',
      });

      expect(mockPrisma.customFieldValue.upsert).toHaveBeenCalledTimes(1);
      expect(mockPrisma.customFieldValue.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            definitionId_entityId: {
              definitionId: 'def-1',
              entityId: 'grn-001',
            },
          },
        }),
      );
    });

    it('should use Prisma.JsonNull for null values', async () => {
      const definitions = [{ id: 'def-1', fieldKey: 'clearableField', entityType: 'grn' }];
      mockPrisma.customFieldDefinition.findMany.mockResolvedValue(definitions);
      mockPrisma.customFieldValue.upsert.mockResolvedValue({});

      await setCustomFieldValues('grn', 'grn-001', { clearableField: null });

      expect(mockPrisma.customFieldValue.upsert).toHaveBeenCalledWith({
        where: {
          definitionId_entityId: {
            definitionId: 'def-1',
            entityId: 'grn-001',
          },
        },
        update: { value: MockJsonNull },
        create: {
          definitionId: 'def-1',
          entityType: 'grn',
          entityId: 'grn-001',
          value: MockJsonNull,
        },
      });
    });

    it('should use Prisma.JsonNull for undefined values', async () => {
      const definitions = [{ id: 'def-1', fieldKey: 'optionalField', entityType: 'mi' }];
      mockPrisma.customFieldDefinition.findMany.mockResolvedValue(definitions);
      mockPrisma.customFieldValue.upsert.mockResolvedValue({});

      await setCustomFieldValues('mi', 'mi-001', { optionalField: undefined });

      expect(mockPrisma.customFieldValue.upsert).toHaveBeenCalledWith({
        where: {
          definitionId_entityId: {
            definitionId: 'def-1',
            entityId: 'mi-001',
          },
        },
        update: { value: MockJsonNull },
        create: {
          definitionId: 'def-1',
          entityType: 'mi',
          entityId: 'mi-001',
          value: MockJsonNull,
        },
      });
    });

    it('should not upsert anything when values object is empty', async () => {
      mockPrisma.customFieldDefinition.findMany.mockResolvedValue([
        { id: 'def-1', fieldKey: 'field1', entityType: 'grn' },
      ]);

      await setCustomFieldValues('grn', 'grn-001', {});

      expect(mockPrisma.customFieldValue.upsert).not.toHaveBeenCalled();
    });

    it('should not upsert anything when no definitions exist', async () => {
      mockPrisma.customFieldDefinition.findMany.mockResolvedValue([]);

      await setCustomFieldValues('grn', 'grn-001', { someField: 'value' });

      expect(mockPrisma.customFieldValue.upsert).not.toHaveBeenCalled();
    });

    it('should handle numeric and boolean values as InputJsonValue', async () => {
      const definitions = [
        { id: 'def-1', fieldKey: 'count', entityType: 'grn' },
        { id: 'def-2', fieldKey: 'active', entityType: 'grn' },
      ];
      mockPrisma.customFieldDefinition.findMany.mockResolvedValue(definitions);
      mockPrisma.customFieldValue.upsert.mockResolvedValue({});

      await setCustomFieldValues('grn', 'grn-001', { count: 42, active: false });

      expect(mockPrisma.customFieldValue.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { value: 42 },
          create: expect.objectContaining({ value: 42 }),
        }),
      );
      // false is truthy-check relevant: false !== null && false !== undefined → uses value directly
      expect(mockPrisma.customFieldValue.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { value: false },
          create: expect.objectContaining({ value: false }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // deleteCustomFieldValues
  // ---------------------------------------------------------------------------
  describe('deleteCustomFieldValues', () => {
    it('should delete all values by entityType and entityId', async () => {
      mockPrisma.customFieldValue.deleteMany.mockResolvedValue({ count: 5 });

      await deleteCustomFieldValues('grn', 'grn-001');

      expect(mockPrisma.customFieldValue.deleteMany).toHaveBeenCalledOnce();
      expect(mockPrisma.customFieldValue.deleteMany).toHaveBeenCalledWith({
        where: { entityType: 'grn', entityId: 'grn-001' },
      });
    });

    it('should not throw when no values exist to delete', async () => {
      mockPrisma.customFieldValue.deleteMany.mockResolvedValue({ count: 0 });

      await expect(deleteCustomFieldValues('mi', 'mi-999')).resolves.toBeUndefined();

      expect(mockPrisma.customFieldValue.deleteMany).toHaveBeenCalledWith({
        where: { entityType: 'mi', entityId: 'mi-999' },
      });
    });

    it('should propagate prisma errors', async () => {
      mockPrisma.customFieldValue.deleteMany.mockRejectedValue(new Error('DB error'));

      await expect(deleteCustomFieldValues('grn', 'grn-001')).rejects.toThrow('DB error');
    });
  });
});
