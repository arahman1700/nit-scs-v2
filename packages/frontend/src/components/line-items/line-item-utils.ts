import type { VoucherLineItem } from '@nit-scs-v2/shared/types';

// ── Condition badge styling ──────────────────────────────────────────────────

const CONDITION_CLASSES: Record<string, string> = {
  New: 'bg-green-500/10 text-green-400',
  Good: 'bg-blue-500/10 text-blue-400',
  Fair: 'bg-yellow-500/10 text-yellow-400',
  Damaged: 'bg-red-500/10 text-red-400',
};

export function getConditionBadgeClass(condition: string | undefined): string {
  return CONDITION_CLASSES[condition ?? ''] ?? CONDITION_CLASSES.Damaged;
}

// ── Stock status helpers ─────────────────────────────────────────────────────

export type StockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';

export function getStockStatus(qty: number): StockStatus {
  if (qty <= 0) return 'Out of Stock';
  if (qty <= 10) return 'Low Stock';
  return 'In Stock';
}

export function getStockBadgeClass(status: StockStatus, isInsufficient: boolean): string {
  if (isInsufficient) return 'bg-red-500/10 text-red-400';
  if (status === 'Out of Stock') return 'bg-red-500/10 text-red-400';
  if (status === 'Low Stock') return 'bg-amber-500/10 text-amber-400';
  return 'bg-emerald-500/10 text-emerald-400';
}

export function getStockTextClass(status: StockStatus, isInsufficient: boolean): string {
  if (isInsufficient) return 'text-red-400';
  if (status === 'Out of Stock') return 'text-red-400';
  if (status === 'Low Stock') return 'text-amber-400';
  return 'text-emerald-400';
}

// ── Inventory aggregation ────────────────────────────────────────────────────

export function aggregateInventoryByCode(levels: Record<string, unknown>[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const level of levels) {
    const item = level.item as Record<string, unknown> | undefined;
    const code = (item?.itemCode as string) ?? (item?.code as string) ?? '';
    const onHand = (level.qtyOnHand as number) ?? 0;
    const reserved = (level.qtyReserved as number) ?? 0;
    const available = onHand - reserved;
    map.set(code, (map.get(code) ?? 0) + available);
  }
  return map;
}

// ── Merge-or-add logic (shared by catalog + scan) ────────────────────────────

export function mergeOrAddItem(
  items: VoucherLineItem[],
  newItem: Omit<VoucherLineItem, 'id'> & { itemCode: string },
): VoucherLineItem[] {
  const existing = items.find(i => i.itemCode === newItem.itemCode);
  if (existing) {
    return items.map(i =>
      i.itemCode === newItem.itemCode
        ? { ...i, quantity: i.quantity + 1, totalPrice: (i.quantity + 1) * i.unitPrice }
        : i,
    );
  }
  return [...items, { ...newItem, id: `line-${Date.now()}` }];
}

// ── Update item with total recalculation ─────────────────────────────────────

export function updateLineItem(
  items: VoucherLineItem[],
  id: string,
  field: keyof VoucherLineItem,
  value: string | number,
): VoucherLineItem[] {
  return items.map(item => {
    if (item.id !== id) return item;
    const patched = { ...item, [field]: value };
    if (field === 'quantity' || field === 'unitPrice') {
      patched.totalPrice =
        (field === 'quantity' ? Number(value) : patched.quantity) *
        (field === 'unitPrice' ? Number(value) : patched.unitPrice);
    }
    return patched;
  });
}

// ── UOM deduplication ────────────────────────────────────────────────────────

export interface UnitOption {
  id: string;
  label: string;
}

export function deduplicateUoms(uoms: Record<string, unknown>[]): UnitOption[] {
  const seen = new Set<string>();
  return uoms
    .map(u => ({ id: String(u.id ?? ''), label: String(u.uomName || u.uomCode || '') }))
    .filter(u => {
      if (!u.label || seen.has(u.label)) return false;
      seen.add(u.label);
      return true;
    });
}
