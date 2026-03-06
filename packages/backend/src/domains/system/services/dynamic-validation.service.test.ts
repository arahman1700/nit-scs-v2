import type { DynamicFieldDefinition } from '@prisma/client';
import { validateDynamicData, validateDynamicLines } from './dynamic-validation.service.js';

// ── Helper: create a field definition ─────────────────────────────────

function makeField(
  overrides: Partial<DynamicFieldDefinition> & { fieldKey: string; label: string; fieldType: string },
): DynamicFieldDefinition {
  return {
    id: 'f-1',
    documentTypeId: 'dt-1',
    fieldKey: overrides.fieldKey,
    label: overrides.label,
    fieldType: overrides.fieldType,
    options: null,
    isRequired: false,
    showInGrid: false,
    showInForm: true,
    sectionName: null,
    sortOrder: 0,
    validationRules: null,
    defaultValue: null,
    colSpan: 2,
    isLineItem: false,
    isReadOnly: false,
    conditionalDisplay: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as DynamicFieldDefinition;
}

describe('dynamic-validation.service', () => {
  // ─── validateDynamicData — required check ───────────────────────────

  describe('validateDynamicData — required fields', () => {
    it('returns error when required field is missing', () => {
      const fields = [makeField({ fieldKey: 'title', label: 'Title', fieldType: 'text', isRequired: true })];
      const errors = validateDynamicData(fields, {});
      expect(errors).toEqual([{ field: 'title', message: 'Title is required' }]);
    });

    it('returns error when required field is null', () => {
      const fields = [makeField({ fieldKey: 'title', label: 'Title', fieldType: 'text', isRequired: true })];
      const errors = validateDynamicData(fields, { title: null });
      expect(errors).toHaveLength(1);
    });

    it('returns error when required field is empty string', () => {
      const fields = [makeField({ fieldKey: 'title', label: 'Title', fieldType: 'text', isRequired: true })];
      const errors = validateDynamicData(fields, { title: '' });
      expect(errors).toHaveLength(1);
    });

    it('passes when required field has a value', () => {
      const fields = [makeField({ fieldKey: 'title', label: 'Title', fieldType: 'text', isRequired: true })];
      const errors = validateDynamicData(fields, { title: 'Hello' });
      expect(errors).toEqual([]);
    });

    it('skips non-required empty fields', () => {
      const fields = [makeField({ fieldKey: 'notes', label: 'Notes', fieldType: 'text' })];
      const errors = validateDynamicData(fields, {});
      expect(errors).toEqual([]);
    });
  });

  // ─── isLineItem filtering ──────────────────────────────────────────

  describe('validateDynamicData — isLineItem filtering', () => {
    it('only validates header fields when isLineItem=false (default)', () => {
      const fields = [
        makeField({ fieldKey: 'title', label: 'Title', fieldType: 'text', isRequired: true }),
        makeField({ fieldKey: 'qty', label: 'Qty', fieldType: 'number', isRequired: true, isLineItem: true }),
      ];
      const errors = validateDynamicData(fields, {});
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('title');
    });

    it('only validates line fields when isLineItem=true', () => {
      const fields = [
        makeField({ fieldKey: 'title', label: 'Title', fieldType: 'text', isRequired: true }),
        makeField({ fieldKey: 'qty', label: 'Qty', fieldType: 'number', isRequired: true, isLineItem: true }),
      ];
      const errors = validateDynamicData(fields, {}, true);
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('qty');
    });
  });

  // ─── number/currency validation ─────────────────────────────────────

  describe('validateDynamicData — number/currency', () => {
    it('rejects NaN values', () => {
      const fields = [makeField({ fieldKey: 'qty', label: 'Qty', fieldType: 'number' })];
      const errors = validateDynamicData(fields, { qty: 'abc' });
      expect(errors[0].message).toBe('Qty must be a number');
    });

    it('accepts valid numbers', () => {
      const fields = [makeField({ fieldKey: 'qty', label: 'Qty', fieldType: 'number' })];
      expect(validateDynamicData(fields, { qty: 42 })).toEqual([]);
    });

    it('enforces min rule', () => {
      const fields = [
        makeField({ fieldKey: 'qty', label: 'Qty', fieldType: 'number', validationRules: { min: 1 } as never }),
      ];
      const errors = validateDynamicData(fields, { qty: 0 });
      expect(errors[0].message).toBe('Qty must be at least 1');
    });

    it('enforces max rule', () => {
      const fields = [
        makeField({ fieldKey: 'qty', label: 'Qty', fieldType: 'number', validationRules: { max: 100 } as never }),
      ];
      const errors = validateDynamicData(fields, { qty: 200 });
      expect(errors[0].message).toBe('Qty must be at most 100');
    });

    it('validates currency the same as number', () => {
      const fields = [makeField({ fieldKey: 'price', label: 'Price', fieldType: 'currency' })];
      expect(validateDynamicData(fields, { price: 'nope' })[0].message).toBe('Price must be a number');
    });
  });

  // ─── text/textarea validation ───────────────────────────────────────

  describe('validateDynamicData — text/textarea', () => {
    it('enforces minLength', () => {
      const fields = [
        makeField({ fieldKey: 'desc', label: 'Desc', fieldType: 'text', validationRules: { minLength: 5 } as never }),
      ];
      const errors = validateDynamicData(fields, { desc: 'Hi' });
      expect(errors[0].message).toBe('Desc must be at least 5 characters');
    });

    it('enforces maxLength', () => {
      const fields = [
        makeField({ fieldKey: 'desc', label: 'Desc', fieldType: 'text', validationRules: { maxLength: 3 } as never }),
      ];
      const errors = validateDynamicData(fields, { desc: 'Hello' });
      expect(errors[0].message).toBe('Desc must be at most 3 characters');
    });

    it('enforces pattern', () => {
      const fields = [
        makeField({
          fieldKey: 'code',
          label: 'Code',
          fieldType: 'text',
          validationRules: { pattern: '^[A-Z]+$' } as never,
        }),
      ];
      expect(validateDynamicData(fields, { code: 'abc' })[0].message).toBe('Code format is invalid');
      expect(validateDynamicData(fields, { code: 'ABC' })).toEqual([]);
    });
  });

  // ─── email validation ───────────────────────────────────────────────

  describe('validateDynamicData — email', () => {
    it('rejects invalid email', () => {
      const fields = [makeField({ fieldKey: 'email', label: 'Email', fieldType: 'email' })];
      expect(validateDynamicData(fields, { email: 'not-an-email' })[0].message).toBe('Email must be a valid email');
    });

    it('accepts valid email', () => {
      const fields = [makeField({ fieldKey: 'email', label: 'Email', fieldType: 'email' })];
      expect(validateDynamicData(fields, { email: 'user@example.com' })).toEqual([]);
    });
  });

  // ─── phone validation ──────────────────────────────────────────────

  describe('validateDynamicData — phone', () => {
    it('rejects invalid phone', () => {
      const fields = [makeField({ fieldKey: 'phone', label: 'Phone', fieldType: 'phone' })];
      expect(validateDynamicData(fields, { phone: 'abc' })[0].message).toBe('Phone must be a valid phone number');
    });

    it('accepts valid phone', () => {
      const fields = [makeField({ fieldKey: 'phone', label: 'Phone', fieldType: 'phone' })];
      expect(validateDynamicData(fields, { phone: '+966-555-1234' })).toEqual([]);
    });
  });

  // ─── url validation ────────────────────────────────────────────────

  describe('validateDynamicData — url', () => {
    it('rejects invalid URL', () => {
      const fields = [makeField({ fieldKey: 'link', label: 'Link', fieldType: 'url' })];
      expect(validateDynamicData(fields, { link: 'not-a-url' })[0].message).toBe('Link must be a valid URL');
    });

    it('accepts valid URL', () => {
      const fields = [makeField({ fieldKey: 'link', label: 'Link', fieldType: 'url' })];
      expect(validateDynamicData(fields, { link: 'https://example.com' })).toEqual([]);
    });
  });

  // ─── date/datetime validation ──────────────────────────────────────

  describe('validateDynamicData — date/datetime', () => {
    it('rejects invalid date', () => {
      const fields = [makeField({ fieldKey: 'd', label: 'Date', fieldType: 'date' })];
      expect(validateDynamicData(fields, { d: 'invalid' })[0].message).toBe('Date must be a valid date');
    });

    it('accepts valid date string', () => {
      const fields = [makeField({ fieldKey: 'd', label: 'Date', fieldType: 'date' })];
      expect(validateDynamicData(fields, { d: '2026-01-15' })).toEqual([]);
    });

    it('validates datetime type', () => {
      const fields = [makeField({ fieldKey: 'd', label: 'DT', fieldType: 'datetime' })];
      expect(validateDynamicData(fields, { d: 'not-a-date' })).toHaveLength(1);
    });
  });

  // ─── select validation ─────────────────────────────────────────────

  describe('validateDynamicData — select', () => {
    it('rejects value not in options', () => {
      const fields = [
        makeField({
          fieldKey: 'priority',
          label: 'Priority',
          fieldType: 'select',
          options: [{ value: 'low' }, { value: 'high' }] as never,
        }),
      ];
      expect(validateDynamicData(fields, { priority: 'medium' })[0].message).toBe('Priority has an invalid selection');
    });

    it('accepts value in options', () => {
      const fields = [
        makeField({
          fieldKey: 'priority',
          label: 'Priority',
          fieldType: 'select',
          options: [{ value: 'low' }, { value: 'high' }] as never,
        }),
      ];
      expect(validateDynamicData(fields, { priority: 'low' })).toEqual([]);
    });

    it('skips validation when options is null', () => {
      const fields = [makeField({ fieldKey: 'priority', label: 'Priority', fieldType: 'select', options: null })];
      expect(validateDynamicData(fields, { priority: 'anything' })).toEqual([]);
    });
  });

  // ─── multiselect validation ────────────────────────────────────────

  describe('validateDynamicData — multiselect', () => {
    it('rejects non-array values', () => {
      const fields = [makeField({ fieldKey: 'tags', label: 'Tags', fieldType: 'multiselect' })];
      expect(validateDynamicData(fields, { tags: 'not-array' })[0].message).toBe('Tags must be an array');
    });

    it('rejects invalid array values', () => {
      const fields = [
        makeField({
          fieldKey: 'tags',
          label: 'Tags',
          fieldType: 'multiselect',
          options: [{ value: 'a' }, { value: 'b' }] as never,
        }),
      ];
      const errors = validateDynamicData(fields, { tags: ['a', 'c'] });
      expect(errors[0].message).toBe('Tags contains invalid value: c');
    });

    it('accepts valid array values', () => {
      const fields = [
        makeField({
          fieldKey: 'tags',
          label: 'Tags',
          fieldType: 'multiselect',
          options: [{ value: 'a' }, { value: 'b' }] as never,
        }),
      ];
      expect(validateDynamicData(fields, { tags: ['a', 'b'] })).toEqual([]);
    });
  });

  // ─── checkbox validation ───────────────────────────────────────────

  describe('validateDynamicData — checkbox', () => {
    it('rejects non-boolean', () => {
      const fields = [makeField({ fieldKey: 'active', label: 'Active', fieldType: 'checkbox' })];
      expect(validateDynamicData(fields, { active: 'yes' })[0].message).toBe('Active must be true or false');
    });

    it('accepts boolean', () => {
      const fields = [makeField({ fieldKey: 'active', label: 'Active', fieldType: 'checkbox' })];
      expect(validateDynamicData(fields, { active: true })).toEqual([]);
    });
  });

  // ─── lookup validation ─────────────────────────────────────────────

  describe('validateDynamicData — lookup fields', () => {
    const lookupTypes = ['lookup_project', 'lookup_warehouse', 'lookup_supplier', 'lookup_employee', 'lookup_item'];

    for (const lt of lookupTypes) {
      it(`rejects invalid UUID for ${lt}`, () => {
        const fields = [makeField({ fieldKey: 'ref', label: 'Ref', fieldType: lt })];
        expect(validateDynamicData(fields, { ref: 'not-uuid' })[0].message).toBe('Ref must be a valid reference ID');
      });

      it(`accepts valid UUID for ${lt}`, () => {
        const fields = [makeField({ fieldKey: 'ref', label: 'Ref', fieldType: lt })];
        expect(validateDynamicData(fields, { ref: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })).toEqual([]);
      });
    }
  });

  // ─── file/signature validation ─────────────────────────────────────

  describe('validateDynamicData — file/signature', () => {
    it('rejects empty string for file type', () => {
      const fields = [makeField({ fieldKey: 'doc', label: 'Doc', fieldType: 'file' })];
      expect(validateDynamicData(fields, { doc: '  ' })[0].message).toBe('Doc is required');
    });

    it('accepts non-empty string for signature', () => {
      const fields = [makeField({ fieldKey: 'sig', label: 'Sig', fieldType: 'signature' })];
      expect(validateDynamicData(fields, { sig: 'data:image/png;base64,...' })).toEqual([]);
    });
  });

  // ─── validateDynamicLines ──────────────────────────────────────────

  describe('validateDynamicLines', () => {
    it('prefixes field errors with line index', () => {
      const fields = [
        makeField({ fieldKey: 'qty', label: 'Qty', fieldType: 'number', isRequired: true, isLineItem: true }),
      ];
      const lines = [{}, { qty: 5 }];
      const errors = validateDynamicLines(fields, lines);
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('lines[0].qty');
    });

    it('returns empty for valid lines', () => {
      const fields = [
        makeField({ fieldKey: 'qty', label: 'Qty', fieldType: 'number', isRequired: true, isLineItem: true }),
      ];
      const lines = [{ qty: 5 }, { qty: 10 }];
      expect(validateDynamicLines(fields, lines)).toEqual([]);
    });

    it('returns errors for multiple invalid lines', () => {
      const fields = [
        makeField({ fieldKey: 'qty', label: 'Qty', fieldType: 'number', isRequired: true, isLineItem: true }),
      ];
      const lines = [{}, {}];
      const errors = validateDynamicLines(fields, lines);
      expect(errors).toHaveLength(2);
      expect(errors[0].field).toBe('lines[0].qty');
      expect(errors[1].field).toBe('lines[1].qty');
    });

    it('returns empty for empty lines array', () => {
      const fields = [
        makeField({ fieldKey: 'qty', label: 'Qty', fieldType: 'number', isRequired: true, isLineItem: true }),
      ];
      expect(validateDynamicLines(fields, [])).toEqual([]);
    });
  });
});
