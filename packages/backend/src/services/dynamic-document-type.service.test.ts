import type { PrismaMock } from '../test-utils/prisma-mock.js';

const MockJsonNull = vi.hoisted(() => Symbol('JsonNull'));

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('@prisma/client', () => ({
  Prisma: { JsonNull: MockJsonNull, InputJsonValue: null },
}));
vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../config/logger.js', () => ({ log: vi.fn() }));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import {
  listDocumentTypes,
  getDocumentTypeById,
  getDocumentTypeByCode,
  createDocumentType,
  updateDocumentType,
  deleteDocumentType,
  addField,
  updateField,
  deleteField,
  reorderFields,
  getActiveTypesForRole,
} from './dynamic-document-type.service.js';

describe('dynamic-document-type.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
  });

  // ---------------------------------------------------------------------------
  // listDocumentTypes
  // ---------------------------------------------------------------------------
  describe('listDocumentTypes', () => {
    it('should return paginated list with counts', async () => {
      const types = [
        {
          id: 'type-1',
          code: 'CUST_001',
          name: 'Custom Request',
          _count: { fields: 5, documents: 10 },
        },
        {
          id: 'type-2',
          code: 'CUST_002',
          name: 'Custom Report',
          _count: { fields: 3, documents: 2 },
        },
      ];
      mockPrisma.dynamicDocumentType.findMany.mockResolvedValue(types);
      mockPrisma.dynamicDocumentType.count.mockResolvedValue(2);

      const result = await listDocumentTypes({
        skip: 0,
        pageSize: 10,
        sortBy: 'createdAt',
        sortDir: 'desc',
      });

      expect(mockPrisma.dynamicDocumentType.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
        include: { _count: { select: { fields: true, documents: true } } },
      });
      expect(mockPrisma.dynamicDocumentType.count).toHaveBeenCalledWith({ where: {} });
      expect(result).toEqual({ data: types, total: 2 });
    });

    it('should filter by search term (name and code)', async () => {
      mockPrisma.dynamicDocumentType.findMany.mockResolvedValue([]);
      mockPrisma.dynamicDocumentType.count.mockResolvedValue(0);

      await listDocumentTypes({
        skip: 0,
        pageSize: 10,
        sortBy: 'name',
        sortDir: 'asc',
        search: 'custom',
      });

      expect(mockPrisma.dynamicDocumentType.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: 'custom', mode: 'insensitive' } },
            { code: { contains: 'custom', mode: 'insensitive' } },
          ],
        },
        orderBy: { name: 'asc' },
        skip: 0,
        take: 10,
        include: { _count: { select: { fields: true, documents: true } } },
      });
    });

    it('should filter by category', async () => {
      mockPrisma.dynamicDocumentType.findMany.mockResolvedValue([]);
      mockPrisma.dynamicDocumentType.count.mockResolvedValue(0);

      await listDocumentTypes({
        skip: 0,
        pageSize: 10,
        sortBy: 'createdAt',
        sortDir: 'desc',
        category: 'logistics',
      });

      expect(mockPrisma.dynamicDocumentType.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { category: 'logistics' },
        }),
      );
    });

    it('should filter by isActive=true', async () => {
      mockPrisma.dynamicDocumentType.findMany.mockResolvedValue([]);
      mockPrisma.dynamicDocumentType.count.mockResolvedValue(0);

      await listDocumentTypes({
        skip: 0,
        pageSize: 10,
        sortBy: 'createdAt',
        sortDir: 'desc',
        isActive: 'true',
      });

      expect(mockPrisma.dynamicDocumentType.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        }),
      );
    });

    it('should filter by isActive=false', async () => {
      mockPrisma.dynamicDocumentType.findMany.mockResolvedValue([]);
      mockPrisma.dynamicDocumentType.count.mockResolvedValue(0);

      await listDocumentTypes({
        skip: 0,
        pageSize: 10,
        sortBy: 'createdAt',
        sortDir: 'desc',
        isActive: 'false',
      });

      expect(mockPrisma.dynamicDocumentType.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: false },
        }),
      );
    });

    it('should combine all filters', async () => {
      mockPrisma.dynamicDocumentType.findMany.mockResolvedValue([]);
      mockPrisma.dynamicDocumentType.count.mockResolvedValue(0);

      await listDocumentTypes({
        skip: 10,
        pageSize: 20,
        sortBy: 'name',
        sortDir: 'asc',
        search: 'req',
        category: 'procurement',
        isActive: 'true',
      });

      expect(mockPrisma.dynamicDocumentType.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ name: { contains: 'req', mode: 'insensitive' } }, { code: { contains: 'req', mode: 'insensitive' } }],
          category: 'procurement',
          isActive: true,
        },
        orderBy: { name: 'asc' },
        skip: 10,
        take: 20,
        include: { _count: { select: { fields: true, documents: true } } },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // getDocumentTypeById
  // ---------------------------------------------------------------------------
  describe('getDocumentTypeById', () => {
    it('should return document type with fields and creator', async () => {
      const docType = {
        id: 'type-1',
        code: 'CUST_001',
        name: 'Custom Request',
        fields: [
          { id: 'field-1', fieldKey: 'priority', sortOrder: 0 },
          { id: 'field-2', fieldKey: 'department', sortOrder: 1 },
        ],
        createdBy: { fullName: 'Admin User', email: 'admin@test.com' },
      };
      mockPrisma.dynamicDocumentType.findUnique.mockResolvedValue(docType);

      const result = await getDocumentTypeById('type-1');

      expect(mockPrisma.dynamicDocumentType.findUnique).toHaveBeenCalledWith({
        where: { id: 'type-1' },
        include: {
          fields: { orderBy: { sortOrder: 'asc' } },
          createdBy: { select: { fullName: true, email: true } },
        },
      });
      expect(result).toEqual(docType);
    });

    it('should throw NotFoundError when document type does not exist', async () => {
      mockPrisma.dynamicDocumentType.findUnique.mockResolvedValue(null);

      await expect(getDocumentTypeById('nonexistent')).rejects.toThrow('Document type not found');
    });
  });

  // ---------------------------------------------------------------------------
  // getDocumentTypeByCode
  // ---------------------------------------------------------------------------
  describe('getDocumentTypeByCode', () => {
    it('should return document type with fields ordered by sortOrder', async () => {
      const docType = {
        id: 'type-1',
        code: 'CUST_001',
        name: 'Custom Request',
        fields: [
          { id: 'field-1', fieldKey: 'title', sortOrder: 0 },
          { id: 'field-2', fieldKey: 'description', sortOrder: 1 },
        ],
      };
      mockPrisma.dynamicDocumentType.findUnique.mockResolvedValue(docType);

      const result = await getDocumentTypeByCode('CUST_001');

      expect(mockPrisma.dynamicDocumentType.findUnique).toHaveBeenCalledWith({
        where: { code: 'CUST_001' },
        include: {
          fields: { orderBy: { sortOrder: 'asc' } },
        },
      });
      expect(result).toEqual(docType);
    });

    it('should throw NotFoundError with code in message', async () => {
      mockPrisma.dynamicDocumentType.findUnique.mockResolvedValue(null);

      await expect(getDocumentTypeByCode('MISSING')).rejects.toThrow("Document type 'MISSING' not found");
    });
  });

  // ---------------------------------------------------------------------------
  // createDocumentType
  // ---------------------------------------------------------------------------
  describe('createDocumentType', () => {
    it('should create document type with all fields provided', async () => {
      const input = {
        code: 'CUST_001',
        name: 'Custom Request',
        description: 'A custom request form',
        icon: 'FileText',
        category: 'operations',
        statusFlow: { initialStatus: 'draft', statuses: [], transitions: {} },
        approvalConfig: { levels: [] },
        permissionConfig: { canEdit: ['admin'] },
        settings: { autoNumber: true },
        visibleToRoles: ['admin', 'manager'],
      };
      const created = { id: 'type-1', ...input };
      mockPrisma.dynamicDocumentType.create.mockResolvedValue(created);

      const result = await createDocumentType(input, 'user-1');

      expect(mockPrisma.dynamicDocumentType.create).toHaveBeenCalledWith({
        data: {
          code: 'CUST_001',
          name: 'Custom Request',
          description: 'A custom request form',
          icon: 'FileText',
          category: 'operations',
          statusFlow: { initialStatus: 'draft', statuses: [], transitions: {} },
          approvalConfig: { levels: [] },
          permissionConfig: { canEdit: ['admin'] },
          settings: { autoNumber: true },
          visibleToRoles: ['admin', 'manager'],
          createdById: 'user-1',
        },
      });
      expect(result).toEqual(created);
    });

    it('should apply defaults for category, statusFlow, settings, and visibleToRoles', async () => {
      const input = {
        code: 'SIMPLE',
        name: 'Simple Form',
      };
      mockPrisma.dynamicDocumentType.create.mockResolvedValue({ id: 'type-2', ...input });

      await createDocumentType(input, 'user-1');

      expect(mockPrisma.dynamicDocumentType.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          category: 'custom',
          statusFlow: {
            initialStatus: 'draft',
            statuses: [{ key: 'draft', label: 'Draft', color: 'gray' }],
            transitions: {},
          },
          approvalConfig: MockJsonNull,
          permissionConfig: MockJsonNull,
          settings: {},
          visibleToRoles: ['admin'],
        }),
      });
    });

    it('should use Prisma.JsonNull for null approvalConfig', async () => {
      const input = {
        code: 'NO_APPROVAL',
        name: 'No Approval Form',
        approvalConfig: undefined,
      };
      mockPrisma.dynamicDocumentType.create.mockResolvedValue({ id: 'type-3' });

      await createDocumentType(input, 'user-1');

      expect(mockPrisma.dynamicDocumentType.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          approvalConfig: MockJsonNull,
        }),
      });
    });

    it('should use Prisma.JsonNull for null permissionConfig', async () => {
      const input = {
        code: 'NO_PERMS',
        name: 'No Permissions Form',
        permissionConfig: undefined,
      };
      mockPrisma.dynamicDocumentType.create.mockResolvedValue({ id: 'type-4' });

      await createDocumentType(input, 'user-1');

      expect(mockPrisma.dynamicDocumentType.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          permissionConfig: MockJsonNull,
        }),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // updateDocumentType
  // ---------------------------------------------------------------------------
  describe('updateDocumentType', () => {
    it('should throw NotFoundError when document type does not exist', async () => {
      mockPrisma.dynamicDocumentType.findUnique.mockResolvedValue(null);

      await expect(updateDocumentType('nonexistent', { name: 'New Name' })).rejects.toThrow('Document type not found');
    });

    it('should update only provided fields and increment version', async () => {
      const existing = { id: 'type-1', name: 'Old Name', version: 1 };
      const updated = { id: 'type-1', name: 'New Name', version: 2 };
      mockPrisma.dynamicDocumentType.findUnique.mockResolvedValue(existing);
      mockPrisma.dynamicDocumentType.update.mockResolvedValue(updated);

      const result = await updateDocumentType('type-1', { name: 'New Name' });

      expect(mockPrisma.dynamicDocumentType.update).toHaveBeenCalledWith({
        where: { id: 'type-1' },
        data: {
          version: { increment: 1 },
          name: 'New Name',
        },
      });
      expect(result).toEqual({ existing, updated });
    });

    it('should update multiple fields simultaneously', async () => {
      mockPrisma.dynamicDocumentType.findUnique.mockResolvedValue({ id: 'type-1', version: 0 });
      mockPrisma.dynamicDocumentType.update.mockResolvedValue({ id: 'type-1', version: 1 });

      await updateDocumentType('type-1', {
        name: 'Updated Name',
        description: 'Updated description',
        icon: 'Settings',
        category: 'admin',
        isActive: false,
      });

      expect(mockPrisma.dynamicDocumentType.update).toHaveBeenCalledWith({
        where: { id: 'type-1' },
        data: {
          version: { increment: 1 },
          name: 'Updated Name',
          description: 'Updated description',
          icon: 'Settings',
          category: 'admin',
          isActive: false,
        },
      });
    });

    it('should update JSON fields (statusFlow, approvalConfig, permissionConfig, settings, visibleToRoles)', async () => {
      mockPrisma.dynamicDocumentType.findUnique.mockResolvedValue({ id: 'type-1', version: 0 });
      mockPrisma.dynamicDocumentType.update.mockResolvedValue({ id: 'type-1', version: 1 });

      const statusFlow = { initialStatus: 'pending', statuses: [], transitions: {} };
      const approvalConfig = { levels: [{ role: 'manager' }] };
      const permissionConfig = { canEdit: ['admin', 'manager'] };
      const settings = { enableComments: true };
      const visibleToRoles = ['*'];

      await updateDocumentType('type-1', {
        statusFlow,
        approvalConfig,
        permissionConfig,
        settings,
        visibleToRoles,
      });

      expect(mockPrisma.dynamicDocumentType.update).toHaveBeenCalledWith({
        where: { id: 'type-1' },
        data: {
          version: { increment: 1 },
          statusFlow,
          approvalConfig,
          permissionConfig,
          settings,
          visibleToRoles,
        },
      });
    });

    it('should only increment version when no fields are provided', async () => {
      mockPrisma.dynamicDocumentType.findUnique.mockResolvedValue({ id: 'type-1', version: 5 });
      mockPrisma.dynamicDocumentType.update.mockResolvedValue({ id: 'type-1', version: 6 });

      await updateDocumentType('type-1', {});

      expect(mockPrisma.dynamicDocumentType.update).toHaveBeenCalledWith({
        where: { id: 'type-1' },
        data: {
          version: { increment: 1 },
        },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // deleteDocumentType
  // ---------------------------------------------------------------------------
  describe('deleteDocumentType', () => {
    it('should throw NotFoundError when document type does not exist', async () => {
      mockPrisma.dynamicDocumentType.findUnique.mockResolvedValue(null);

      await expect(deleteDocumentType('nonexistent')).rejects.toThrow('Document type not found');
    });

    it('should throw error when documents exist', async () => {
      const existing = {
        id: 'type-1',
        code: 'CUST_001',
        _count: { documents: 5 },
      };
      mockPrisma.dynamicDocumentType.findUnique.mockResolvedValue(existing);

      await expect(deleteDocumentType('type-1')).rejects.toThrow(
        "Cannot delete document type 'CUST_001': 5 documents exist. Deactivate instead.",
      );
      expect(mockPrisma.dynamicDocumentType.delete).not.toHaveBeenCalled();
    });

    it('should delete when no documents exist', async () => {
      const existing = {
        id: 'type-1',
        code: 'CUST_001',
        _count: { documents: 0 },
      };
      mockPrisma.dynamicDocumentType.findUnique.mockResolvedValue(existing);
      mockPrisma.dynamicDocumentType.delete.mockResolvedValue(existing);

      await deleteDocumentType('type-1');

      expect(mockPrisma.dynamicDocumentType.delete).toHaveBeenCalledWith({ where: { id: 'type-1' } });
    });
  });

  // ---------------------------------------------------------------------------
  // addField
  // ---------------------------------------------------------------------------
  describe('addField', () => {
    it('should throw NotFoundError when document type does not exist', async () => {
      mockPrisma.dynamicDocumentType.findUnique.mockResolvedValue(null);

      await expect(
        addField('nonexistent', {
          fieldKey: 'test',
          label: 'Test',
          fieldType: 'text',
        }),
      ).rejects.toThrow('Document type not found');
    });

    it('should auto-assign sortOrder when not provided (first field)', async () => {
      mockPrisma.dynamicDocumentType.findUnique.mockResolvedValue({ id: 'type-1' });
      mockPrisma.dynamicFieldDefinition.aggregate.mockResolvedValue({ _max: { sortOrder: null } });
      mockPrisma.dynamicFieldDefinition.create.mockResolvedValue({ id: 'field-1' });

      await addField('type-1', {
        fieldKey: 'title',
        label: 'Title',
        fieldType: 'text',
      });

      expect(mockPrisma.dynamicFieldDefinition.aggregate).toHaveBeenCalledWith({
        where: { documentTypeId: 'type-1' },
        _max: { sortOrder: true },
      });
      expect(mockPrisma.dynamicFieldDefinition.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sortOrder: 0,
        }),
      });
    });

    it('should auto-assign sortOrder when not provided (subsequent field)', async () => {
      mockPrisma.dynamicDocumentType.findUnique.mockResolvedValue({ id: 'type-1' });
      mockPrisma.dynamicFieldDefinition.aggregate.mockResolvedValue({ _max: { sortOrder: 4 } });
      mockPrisma.dynamicFieldDefinition.create.mockResolvedValue({ id: 'field-2' });

      await addField('type-1', {
        fieldKey: 'description',
        label: 'Description',
        fieldType: 'textarea',
      });

      expect(mockPrisma.dynamicFieldDefinition.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sortOrder: 5,
        }),
      });
    });

    it('should use provided sortOrder when specified', async () => {
      mockPrisma.dynamicDocumentType.findUnique.mockResolvedValue({ id: 'type-1' });
      mockPrisma.dynamicFieldDefinition.create.mockResolvedValue({ id: 'field-3' });

      await addField('type-1', {
        fieldKey: 'priority',
        label: 'Priority',
        fieldType: 'select',
        sortOrder: 10,
      });

      expect(mockPrisma.dynamicFieldDefinition.aggregate).not.toHaveBeenCalled();
      expect(mockPrisma.dynamicFieldDefinition.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sortOrder: 10,
        }),
      });
    });

    it('should create field with all properties', async () => {
      mockPrisma.dynamicDocumentType.findUnique.mockResolvedValue({ id: 'type-1' });
      mockPrisma.dynamicFieldDefinition.create.mockResolvedValue({ id: 'field-4' });

      const input = {
        fieldKey: 'status',
        label: 'Status',
        fieldType: 'select',
        options: ['Draft', 'Pending', 'Approved'],
        isRequired: true,
        showInGrid: true,
        showInForm: true,
        sectionName: 'General',
        sortOrder: 0,
        validationRules: { maxLength: 50 },
        defaultValue: 'Draft',
        colSpan: 4,
        isLineItem: false,
        isReadOnly: false,
        conditionalDisplay: { field: 'type', value: 'request' },
      };

      await addField('type-1', input);

      expect(mockPrisma.dynamicFieldDefinition.create).toHaveBeenCalledWith({
        data: {
          documentTypeId: 'type-1',
          fieldKey: 'status',
          label: 'Status',
          fieldType: 'select',
          options: ['Draft', 'Pending', 'Approved'],
          isRequired: true,
          showInGrid: true,
          showInForm: true,
          sectionName: 'General',
          sortOrder: 0,
          validationRules: { maxLength: 50 },
          defaultValue: 'Draft',
          colSpan: 4,
          isLineItem: false,
          isReadOnly: false,
          conditionalDisplay: { field: 'type', value: 'request' },
        },
      });
    });

    it('should apply defaults for boolean and numeric fields', async () => {
      mockPrisma.dynamicDocumentType.findUnique.mockResolvedValue({ id: 'type-1' });
      mockPrisma.dynamicFieldDefinition.aggregate.mockResolvedValue({ _max: { sortOrder: 0 } });
      mockPrisma.dynamicFieldDefinition.create.mockResolvedValue({ id: 'field-5' });

      await addField('type-1', {
        fieldKey: 'simple',
        label: 'Simple Field',
        fieldType: 'text',
      });

      expect(mockPrisma.dynamicFieldDefinition.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isRequired: false,
          showInGrid: false,
          showInForm: true,
          colSpan: 2,
          isLineItem: false,
          isReadOnly: false,
        }),
      });
    });

    it('should use Prisma.JsonNull for undefined JSON fields', async () => {
      mockPrisma.dynamicDocumentType.findUnique.mockResolvedValue({ id: 'type-1' });
      mockPrisma.dynamicFieldDefinition.aggregate.mockResolvedValue({ _max: { sortOrder: 2 } });
      mockPrisma.dynamicFieldDefinition.create.mockResolvedValue({ id: 'field-6' });

      await addField('type-1', {
        fieldKey: 'minimal',
        label: 'Minimal',
        fieldType: 'text',
      });

      expect(mockPrisma.dynamicFieldDefinition.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          options: MockJsonNull,
          validationRules: MockJsonNull,
          conditionalDisplay: MockJsonNull,
        }),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // updateField
  // ---------------------------------------------------------------------------
  describe('updateField', () => {
    it('should throw NotFoundError when field does not exist', async () => {
      mockPrisma.dynamicFieldDefinition.findUnique.mockResolvedValue(null);

      await expect(updateField('nonexistent', { label: 'New Label' })).rejects.toThrow('Field not found');
    });

    it('should update specified fields only', async () => {
      mockPrisma.dynamicFieldDefinition.findUnique.mockResolvedValue({ id: 'field-1' });
      mockPrisma.dynamicFieldDefinition.update.mockResolvedValue({ id: 'field-1', label: 'Updated' });

      await updateField('field-1', {
        label: 'Updated',
        isRequired: true,
      });

      expect(mockPrisma.dynamicFieldDefinition.update).toHaveBeenCalledWith({
        where: { id: 'field-1' },
        data: {
          label: 'Updated',
          fieldType: undefined,
          options: MockJsonNull,
          isRequired: true,
          showInGrid: undefined,
          showInForm: undefined,
          sectionName: undefined,
          sortOrder: undefined,
          validationRules: MockJsonNull,
          defaultValue: undefined,
          colSpan: undefined,
          isLineItem: undefined,
          isReadOnly: undefined,
          conditionalDisplay: MockJsonNull,
        },
      });
    });

    it('should update all fields when provided', async () => {
      mockPrisma.dynamicFieldDefinition.findUnique.mockResolvedValue({ id: 'field-1' });
      mockPrisma.dynamicFieldDefinition.update.mockResolvedValue({ id: 'field-1' });

      const input = {
        label: 'Full Update',
        fieldType: 'number',
        options: [1, 2, 3],
        isRequired: false,
        showInGrid: true,
        showInForm: false,
        sectionName: 'Details',
        sortOrder: 5,
        validationRules: { min: 0, max: 100 },
        defaultValue: '50',
        colSpan: 6,
        isLineItem: true,
        isReadOnly: true,
        conditionalDisplay: { enabled: true },
      };

      await updateField('field-1', input);

      expect(mockPrisma.dynamicFieldDefinition.update).toHaveBeenCalledWith({
        where: { id: 'field-1' },
        data: {
          label: 'Full Update',
          fieldType: 'number',
          options: [1, 2, 3],
          isRequired: false,
          showInGrid: true,
          showInForm: false,
          sectionName: 'Details',
          sortOrder: 5,
          validationRules: { min: 0, max: 100 },
          defaultValue: '50',
          colSpan: 6,
          isLineItem: true,
          isReadOnly: true,
          conditionalDisplay: { enabled: true },
        },
      });
    });

    it('should use Prisma.JsonNull for undefined JSON fields', async () => {
      mockPrisma.dynamicFieldDefinition.findUnique.mockResolvedValue({ id: 'field-1' });
      mockPrisma.dynamicFieldDefinition.update.mockResolvedValue({ id: 'field-1' });

      await updateField('field-1', { label: 'Only Label' });

      const callData = mockPrisma.dynamicFieldDefinition.update.mock.calls[0][0].data;
      expect(callData).toEqual(
        expect.objectContaining({
          options: MockJsonNull,
          validationRules: MockJsonNull,
          conditionalDisplay: MockJsonNull,
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // deleteField
  // ---------------------------------------------------------------------------
  describe('deleteField', () => {
    it('should throw NotFoundError when field does not exist', async () => {
      mockPrisma.dynamicFieldDefinition.findUnique.mockResolvedValue(null);

      await expect(deleteField('nonexistent')).rejects.toThrow('Field not found');
    });

    it('should delete the field', async () => {
      mockPrisma.dynamicFieldDefinition.findUnique.mockResolvedValue({ id: 'field-1' });
      mockPrisma.dynamicFieldDefinition.delete.mockResolvedValue({ id: 'field-1' });

      await deleteField('field-1');

      expect(mockPrisma.dynamicFieldDefinition.delete).toHaveBeenCalledWith({
        where: { id: 'field-1' },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // reorderFields
  // ---------------------------------------------------------------------------
  describe('reorderFields', () => {
    it('should update sortOrder for each field in transaction', async () => {
      const fieldIds = ['field-3', 'field-1', 'field-2'];

      await reorderFields('type-1', fieldIds);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      const updateOps = mockPrisma.$transaction.mock.calls[0][0];
      expect(updateOps).toHaveLength(3);
    });

    it('should assign sortOrder based on array index', async () => {
      const fieldIds = ['field-b', 'field-a', 'field-c'];
      const capturedUpdates: unknown[] = [];

      mockPrisma.dynamicFieldDefinition.update.mockImplementation((args: unknown) => {
        capturedUpdates.push(args);
        return Promise.resolve({} as never);
      });

      await reorderFields('type-1', fieldIds);

      const transactionArg = mockPrisma.$transaction.mock.calls[0][0];
      await Promise.all(transactionArg);

      expect(capturedUpdates).toEqual([
        { where: { id: 'field-b' }, data: { sortOrder: 0 } },
        { where: { id: 'field-a' }, data: { sortOrder: 1 } },
        { where: { id: 'field-c' }, data: { sortOrder: 2 } },
      ]);
    });

    it('should handle empty array', async () => {
      await reorderFields('type-1', []);

      expect(mockPrisma.$transaction).toHaveBeenCalledWith([]);
    });

    it('should handle single field', async () => {
      const capturedUpdates: unknown[] = [];
      mockPrisma.dynamicFieldDefinition.update.mockImplementation((args: unknown) => {
        capturedUpdates.push(args);
        return Promise.resolve({} as never);
      });

      await reorderFields('type-1', ['field-1']);

      const transactionArg = mockPrisma.$transaction.mock.calls[0][0];
      await Promise.all(transactionArg);

      expect(capturedUpdates).toEqual([{ where: { id: 'field-1' }, data: { sortOrder: 0 } }]);
    });
  });

  // ---------------------------------------------------------------------------
  // getActiveTypesForRole
  // ---------------------------------------------------------------------------
  describe('getActiveTypesForRole', () => {
    it('should return only active types visible to the role', async () => {
      const types = [
        {
          code: 'TYPE_A',
          name: 'Type A',
          icon: 'FileText',
          category: 'custom',
          visibleToRoles: ['admin', 'manager'],
        },
        {
          code: 'TYPE_B',
          name: 'Type B',
          icon: 'Package',
          category: 'operations',
          visibleToRoles: ['*'],
        },
        {
          code: 'TYPE_C',
          name: 'Type C',
          icon: 'Settings',
          category: 'admin',
          visibleToRoles: ['admin'],
        },
      ];
      mockPrisma.dynamicDocumentType.findMany.mockResolvedValue(types);

      const result = await getActiveTypesForRole('manager');

      expect(mockPrisma.dynamicDocumentType.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        select: { code: true, name: true, icon: true, category: true, visibleToRoles: true },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      });
      expect(result).toEqual([types[0], types[1]]);
    });

    it('should return wildcard types for any role', async () => {
      const types = [
        {
          code: 'PUBLIC',
          name: 'Public Type',
          icon: 'Globe',
          category: 'public',
          visibleToRoles: ['*'],
        },
      ];
      mockPrisma.dynamicDocumentType.findMany.mockResolvedValue(types);

      const result = await getActiveTypesForRole('guest');

      expect(result).toEqual(types);
    });

    it('should return empty array when no types match role', async () => {
      const types = [
        {
          code: 'ADMIN_ONLY',
          name: 'Admin Only',
          icon: 'Lock',
          category: 'admin',
          visibleToRoles: ['admin'],
        },
      ];
      mockPrisma.dynamicDocumentType.findMany.mockResolvedValue(types);

      const result = await getActiveTypesForRole('viewer');

      expect(result).toEqual([]);
    });

    it('should filter types by exact role match', async () => {
      const types = [
        {
          code: 'ENG_FORM',
          name: 'Engineering Form',
          icon: 'Wrench',
          category: 'engineering',
          visibleToRoles: ['engineer', 'site_engineer'],
        },
      ];
      mockPrisma.dynamicDocumentType.findMany.mockResolvedValue(types);

      const resultMatch = await getActiveTypesForRole('engineer');
      expect(resultMatch).toEqual(types);

      const resultNoMatch = await getActiveTypesForRole('manager');
      expect(resultNoMatch).toEqual([]);
    });

    it('should only query active types', async () => {
      mockPrisma.dynamicDocumentType.findMany.mockResolvedValue([]);

      await getActiveTypesForRole('admin');

      expect(mockPrisma.dynamicDocumentType.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        }),
      );
    });

    it('should sort by category then name', async () => {
      mockPrisma.dynamicDocumentType.findMany.mockResolvedValue([]);

      await getActiveTypesForRole('admin');

      expect(mockPrisma.dynamicDocumentType.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ category: 'asc' }, { name: 'asc' }],
        }),
      );
    });
  });
});
