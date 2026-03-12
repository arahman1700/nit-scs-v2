import React, { Suspense, useState, useMemo } from 'react';
import type { VoucherLineItem, MaterialCatalogItem } from '@nit-scs-v2/shared/types';
import { useItems, useUoms, useInventory } from '@/domains/master-data/hooks/useMasterData';
import { extractRows, toRecord } from '@/utils/type-helpers';
import {
  aggregateInventoryByCode,
  deduplicateUoms,
  mergeOrAddItem,
  updateLineItem,
  getConditionBadgeClass,
  getStockStatus,
  getStockTextClass,
} from './line-items/line-item-utils';
import { MaterialCatalogPicker } from './line-items/MaterialCatalogPicker';
import { MobileLineItemCard } from './line-items/MobileLineItemCard';
import { LineItemsSummary } from './line-items/LineItemsSummary';
import { Plus, Trash2, Search, AlertTriangle, ScanLine } from 'lucide-react';

const BarcodeScanner = React.lazy(() => import('@/components/BarcodeScanner'));

interface LineItemsTableProps {
  items: VoucherLineItem[];
  onItemsChange: (items: VoucherLineItem[]) => void;
  showCondition?: boolean;
  showStockAvailability?: boolean;
  readOnly?: boolean;
}

export const LineItemsTable: React.FC<LineItemsTableProps> = ({
  items,
  onItemsChange,
  showCondition = false,
  showStockAvailability = false,
  readOnly = false,
}) => {
  const itemsQuery = useItems({ pageSize: 100 });
  const inventoryQuery = useInventory({ pageSize: 200 });
  const uomsQuery = useUoms({ pageSize: 100 });

  const inventoryByCode = useMemo(
    () => aggregateInventoryByCode(extractRows(inventoryQuery.data)),
    [inventoryQuery.data],
  );
  const getAvailableQty = (code: string): number => inventoryByCode.get(code) ?? 0;

  const MATERIAL_CATALOG = extractRows(itemsQuery.data);
  const UNIT_OPTIONS = useMemo(() => deduplicateUoms(extractRows(uomsQuery.data)), [uomsQuery.data]);

  const [showCatalog, setShowCatalog] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  // ── Item management ─────────────────────────────────────────────────────

  const addItemFromCatalog = (catalogItem: MaterialCatalogItem) => {
    const raw = toRecord(catalogItem);
    const code = (raw.itemCode as string) || catalogItem.code;
    const name = (raw.itemDescription as string) || catalogItem.name;
    const uomObj = raw.uom as Record<string, unknown> | undefined;
    const unitName = (uomObj?.uomCode as string) || catalogItem.unit || 'EA';
    const price = Number(raw.standardCost) || catalogItem.unitPrice || 0;
    const itemId = raw.id as string | undefined;
    const uomId = (uomObj?.id as string) || (raw.uomId as string) || undefined;

    onItemsChange(
      mergeOrAddItem(items, {
        itemId,
        itemCode: code,
        itemName: name,
        uomId,
        unit: unitName,
        quantity: 1,
        unitPrice: price,
        totalPrice: price,
        condition: 'New',
      }),
    );
    setShowCatalog(false);
  };

  const addItemFromScan = (scannedItem: Record<string, unknown>) => {
    const code = String(scannedItem.itemCode || scannedItem.code || '');
    const name = String(scannedItem.itemDescription || scannedItem.name || scannedItem.itemName || '');
    const unit = String(scannedItem.unit || 'Piece');
    const price = Number(scannedItem.unitPrice || 0);

    onItemsChange(
      mergeOrAddItem(items, {
        itemCode: code,
        itemName: name,
        unit,
        quantity: 1,
        unitPrice: price,
        totalPrice: price,
        condition: 'New',
      }),
    );
    setShowScanner(false);
  };

  const addBlankItem = () => {
    onItemsChange([
      ...items,
      {
        id: `line-${Date.now()}`,
        itemCode: '',
        itemName: '',
        unit: 'Piece',
        quantity: 1,
        unitPrice: 0,
        totalPrice: 0,
        condition: 'New',
      },
    ]);
  };

  const handleUpdate = (id: string, field: keyof VoucherLineItem, value: string | number) => {
    onItemsChange(updateLineItem(items, id, field, value));
  };

  const removeItem = (id: string) => onItemsChange(items.filter(i => i.id !== id));

  const totalValue = useMemo(() => items.reduce((sum, item) => sum + item.totalPrice, 0), [items]);

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white flex items-center gap-3">
          <span className="w-1 h-6 bg-nesma-secondary rounded-full shadow-[0_0_8px_rgba(128,209,233,0.6)]"></span>
          Items
          <span className="text-sm font-normal text-gray-400">
            ({items.length} {items.length === 1 ? 'item' : 'items'})
          </span>
        </h3>
        {!readOnly && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="px-4 py-2 bg-nesma-primary/20 text-nesma-secondary border border-nesma-primary/30 rounded-lg text-sm font-medium hover:bg-nesma-primary/30 transition-all flex items-center gap-2"
            >
              <ScanLine size={14} />
              Scan
            </button>
            <button
              type="button"
              onClick={() => setShowCatalog(!showCatalog)}
              className="px-4 py-2 bg-nesma-primary/20 text-nesma-secondary border border-nesma-primary/30 rounded-lg text-sm font-medium hover:bg-nesma-primary/30 transition-all flex items-center gap-2"
            >
              <Search size={14} />
              {showCatalog ? 'Close Catalog' : 'From Catalog'}
            </button>
            <button
              type="button"
              onClick={addBlankItem}
              className="px-4 py-2 bg-white/5 text-gray-300 border border-white/10 rounded-lg text-sm font-medium hover:bg-white/10 transition-all flex items-center gap-2"
            >
              <Plus size={14} />
              Add Manual
            </button>
          </div>
        )}
      </div>

      {/* Material Catalog Picker */}
      {showCatalog && <MaterialCatalogPicker catalog={MATERIAL_CATALOG} onSelect={addItemFromCatalog} />}

      {items.length > 0 ? (
        <>
          {/* Mobile View */}
          <div className="md:hidden space-y-3">
            {items.map((item, idx) => (
              <MobileLineItemCard
                key={item.id}
                item={item}
                index={idx}
                readOnly={readOnly}
                showCondition={showCondition}
                showStockAvailability={showStockAvailability}
                unitOptions={UNIT_OPTIONS}
                getAvailableQty={getAvailableQty}
                onUpdate={handleUpdate}
                onRemove={removeItem}
              />
            ))}
            {!readOnly && (
              <button
                type="button"
                onClick={addBlankItem}
                className="w-full py-3 bg-nesma-primary hover:bg-nesma-primary/80 text-white rounded-lg text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2"
              >
                <Plus size={16} />
                Add Item
              </button>
            )}
            <LineItemsSummary items={items} totalValue={totalValue} variant="mobile" />
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left" aria-label="Line items">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider">
                  <th scope="col" className="pb-3 px-2 font-medium w-8">
                    #
                  </th>
                  <th scope="col" className="pb-3 px-2 font-medium">
                    Code
                  </th>
                  <th scope="col" className="pb-3 px-2 font-medium min-w-[200px]">
                    Item
                  </th>
                  <th scope="col" className="pb-3 px-2 font-medium">
                    Unit
                  </th>
                  <th scope="col" className="pb-3 px-2 font-medium text-center">
                    Qty
                  </th>
                  <th scope="col" className="pb-3 px-2 font-medium text-center">
                    Price
                  </th>
                  <th scope="col" className="pb-3 px-2 font-medium text-center">
                    Total
                  </th>
                  {showStockAvailability && (
                    <th scope="col" className="pb-3 px-2 font-medium text-center">
                      Available
                    </th>
                  )}
                  {showCondition && (
                    <th scope="col" className="pb-3 px-2 font-medium">
                      Condition
                    </th>
                  )}
                  {!readOnly && (
                    <th scope="col" className="pb-3 px-2 font-medium w-10">
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {items.map((item, idx) => {
                  const available = showStockAvailability && item.itemCode ? getAvailableQty(item.itemCode) : null;
                  const stockStatus = available !== null ? getStockStatus(available) : null;
                  const isInsufficient = available !== null && item.quantity > available;

                  return (
                    <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                      <td className="py-3 px-2 text-gray-400 text-sm">{idx + 1}</td>
                      <td className="py-3 px-2">
                        {readOnly ? (
                          <span className="text-xs font-mono text-gray-400">{item.itemCode}</span>
                        ) : (
                          <input
                            type="text"
                            value={item.itemCode}
                            onChange={e => handleUpdate(item.id, 'itemCode', e.target.value)}
                            className="w-24 px-2 py-1.5 bg-black/20 border border-white/10 rounded-lg text-white text-xs font-mono focus:border-nesma-secondary outline-none"
                            placeholder="CODE"
                          />
                        )}
                      </td>
                      <td className="py-3 px-2">
                        {readOnly ? (
                          <span className="text-sm text-gray-200">{item.itemName}</span>
                        ) : (
                          <input
                            type="text"
                            value={item.itemName}
                            onChange={e => handleUpdate(item.id, 'itemName', e.target.value)}
                            className="w-full px-2 py-1.5 bg-black/20 border border-white/10 rounded-lg text-white text-sm focus:border-nesma-secondary outline-none"
                            placeholder="Item name"
                          />
                        )}
                      </td>
                      <td className="py-3 px-2">
                        {readOnly ? (
                          <span className="text-sm text-gray-400">{item.unit}</span>
                        ) : (
                          <select
                            value={item.unit}
                            onChange={e => handleUpdate(item.id, 'unit', e.target.value)}
                            className="px-2 py-1.5 bg-black/20 border border-white/10 rounded-lg text-white text-xs focus:border-nesma-secondary outline-none"
                          >
                            {UNIT_OPTIONS.map(u => (
                              <option key={u.id} value={u.label}>
                                {u.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="py-3 px-2 text-center">
                        {readOnly ? (
                          <span className="text-sm text-white font-medium">{item.quantity}</span>
                        ) : (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.quantity}
                            onChange={e => handleUpdate(item.id, 'quantity', Number(e.target.value))}
                            className="w-20 px-2 py-1.5 bg-black/20 border border-white/10 rounded-lg text-white text-sm text-center focus:border-nesma-secondary outline-none"
                          />
                        )}
                      </td>
                      <td className="py-3 px-2 text-center">
                        {readOnly ? (
                          <span className="text-sm text-gray-300">{item.unitPrice.toLocaleString()}</span>
                        ) : (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={e => handleUpdate(item.id, 'unitPrice', Number(e.target.value))}
                            className="w-24 px-2 py-1.5 bg-black/20 border border-white/10 rounded-lg text-white text-sm text-center focus:border-nesma-secondary outline-none"
                          />
                        )}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className="text-sm text-nesma-secondary font-semibold">
                          {item.totalPrice.toLocaleString()}
                        </span>
                      </td>
                      {showStockAvailability && (
                        <td className="py-3 px-2 text-center">
                          {item.itemCode && available !== null && stockStatus !== null ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className={`text-xs font-medium ${getStockTextClass(stockStatus, isInsufficient)}`}>
                                {available}
                              </span>
                              {isInsufficient && (
                                <span className="flex items-center gap-1 text-[10px] text-red-400">
                                  <AlertTriangle size={10} /> Insufficient
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">--</span>
                          )}
                        </td>
                      )}
                      {showCondition && (
                        <td className="py-3 px-2">
                          {readOnly ? (
                            <span
                              className={`text-xs px-2 py-1 rounded-full ${getConditionBadgeClass(item.condition)}`}
                            >
                              {item.condition}
                            </span>
                          ) : (
                            <select
                              value={item.condition || 'New'}
                              onChange={e => handleUpdate(item.id, 'condition', e.target.value)}
                              className="px-2 py-1.5 bg-black/20 border border-white/10 rounded-lg text-white text-xs focus:border-nesma-secondary outline-none"
                            >
                              <option value="New">New</option>
                              <option value="Good">Good</option>
                              <option value="Fair">Fair</option>
                              <option value="Damaged">Damaged</option>
                            </select>
                          )}
                        </td>
                      )}
                      {!readOnly && (
                        <td className="py-3 px-2">
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            aria-label={`Remove ${item.itemName || item.itemCode || 'item'}`}
                            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all focus-visible:ring-2 focus-visible:ring-nesma-secondary focus-visible:outline-none"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <LineItemsSummary items={items} totalValue={totalValue} variant="desktop" />
          </div>
        </>
      ) : (
        <div className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center">
          <div className="text-gray-400 mb-2">No items added yet</div>
          <div className="text-xs text-gray-400">
            Use the buttons above to add items from catalog, manually, or by scanning
          </div>
        </div>
      )}

      <Suspense fallback={null}>
        <BarcodeScanner isOpen={showScanner} onClose={() => setShowScanner(false)} onItemFound={addItemFromScan} />
      </Suspense>
    </div>
  );
};
