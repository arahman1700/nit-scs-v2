import { z } from 'zod';

const IMPORTABLE_ENTITIES = [
  'items',
  'suppliers',
  'projects',
  'employees',
  'warehouses',
  'regions',
  'cities',
  'uoms',
] as const;

export const importPreviewSchema = z.object({
  // Validated via multer, body has the entity
  body: z.object({
    entity: z.enum(IMPORTABLE_ENTITIES),
  }),
});

export const importExecuteSchema = z.object({
  body: z.object({
    entity: z.enum(IMPORTABLE_ENTITIES),
    /** Column mapping: excel header -> database field */
    mapping: z.record(z.string()),
    /** Parsed rows from the preview step */
    rows: z.array(z.record(z.unknown())).min(1).max(5000),
  }),
});

export type ImportableEntity = (typeof IMPORTABLE_ENTITIES)[number];
