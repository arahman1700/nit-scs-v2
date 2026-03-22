/**
 * Shared document total value calculation.
 *
 * Used by GRN (totalValue), MI (estimatedValue), and MR (totalEstimatedValue)
 * to compute sum(cost * quantity) from line items.
 *
 * Callers prepare a lightweight array of { cost, qty } pairs:
 * - GRN: cost = line.unitCost, qty = line.qtyReceived
 * - MI/MR: cost = item.standardCost (looked up from Item table), qty = line.qtyRequested
 */

export interface ValueLine {
  cost: number | null | undefined;
  qty: number;
}

/**
 * Calculate total document value from an array of cost/quantity pairs.
 * Skips lines where cost is falsy (null, undefined, 0).
 * Coerces Prisma Decimal objects to number via Number().
 */
export function calculateDocumentTotalValue(lines: ValueLine[]): number {
  let total = 0;
  for (const line of lines) {
    const cost = Number(line.cost ?? 0);
    if (cost > 0 && line.qty > 0) {
      total += cost * line.qty;
    }
  }
  return total;
}
