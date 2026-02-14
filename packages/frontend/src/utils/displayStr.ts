/** Safely extract a display string from a value that may be a string or a nested Prisma relation object. */
export const displayStr = (val: unknown): string => {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    return String(obj.supplierName ?? obj.warehouseName ?? obj.projectName ?? obj.fullName ?? obj.name ?? obj.id ?? '');
  }
  return String(val);
};
