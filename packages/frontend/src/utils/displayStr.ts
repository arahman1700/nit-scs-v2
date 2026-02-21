import type { ProjectRef, SupplierRef, WarehouseRef, EmployeeRef } from '@nit-scs-v2/shared/types';

/** Any relation ref object that displayStr can extract a name from. */
type RelationRef = ProjectRef | SupplierRef | WarehouseRef | EmployeeRef | { name: string; [key: string]: unknown };

/** Safely extract a display string from a value that may be a string or a nested Prisma relation object. */
export function displayStr(val: RelationRef | string | null | undefined): string;
export function displayStr(val: unknown): string;
export function displayStr(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    return String(
      obj.supplierName ??
        obj.warehouseName ??
        obj.projectName ??
        obj.fullName ??
        obj.itemDescription ??
        obj.regionName ??
        obj.cityName ??
        obj.name ??
        obj.id ??
        '',
    );
  }
  return String(val);
}
