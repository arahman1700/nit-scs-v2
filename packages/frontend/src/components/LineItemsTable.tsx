import React, { Suspense, useState, useMemo } from 'react';
import { Plus, Trash2, Search, AlertTriangle, ScanLine } from 'lucide-react';
import type { VoucherLineItem, MaterialCatalogItem } from '@nit-scs-v2/shared/types';
import { useItems, useUoms, useInventory } from '@/api/hooks/useMasterData';

const BarcodeScanner = React.lazy(() => import('@/components/BarcodeScanner'));

interface LineItemsTableProps {
  items: VoucherLineItem[];
  onItemsChange: (items: VoucherLineItem[]) => void;
  showCondition?: boolean; // For MRV/MRRV
  showStockAvailability?: boolean; // For MIRV - shows available qty
  readOnly?: boolean;
}

export const LineItemsTable: React.FC<LineItemsTableProps> = ({
  items,
  onItemsChange,
  showCondition = false,
  showStockAvailability = false,
  readOnly = false,
}) => {
  // React Query hooks for master data
  const itemsQuery = useItems({ pageSize: 500 });

  // Inventory levels from real API — keyed by item code for fast lookup
  const inventoryQuery = useInventory({ pageSize: 1000 });
  const inventoryLevels = (inventoryQuery.data?.data ?? []) as unknown as Array<Record<string, unknown>>;
  const inventoryByCode = useMemo(() => {
    const map = new Map<string, number>();
    for (const level of inventoryLevels) {
      const item = level.item as Record<string, unknown> | undefined;
      const code = (item?.code as string) ?? '';
      const onHand = (level.qtyOnHand as number) ?? 0;
      const reserved = (level.qtyReserved as number) ?? 0;
      const available = onHand - reserved;
      // Sum across all warehouses for the same item code
      map.set(code, (map.get(code) ?? 0) + available);
    }
    return map;
  }, [inventoryLevels]);

  const getAvailableQty = (code: string): number => inventoryByCode.get(code) ?? 0;
  const getStockStatus = (code: string): 'In Stock' | 'Low Stock' | 'Out of Stock' => {
    const qty = getAvailableQty(code);
    if (qty <= 0) return 'Out of Stock';
    if (qty <= 10) return 'Low Stock';
    return 'In Stock';
  };
  const MATERIAL_CATALOG = (itemsQuery.data?.data ?? []) as Array<Record<string, unknown>>;
  const uomsQuery = useUoms({ pageSize: 100 });
  const UNIT_OPTIONS = (uomsQuery.data?.data ?? []).map(
    (u: Record<string, unknown>) => (u.name as string) || (u.symbol as string) || '',
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [showCatalog, setShowCatalog] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = useMemo(
    () => ['All', ...new Set(MATERIAL_CATALOG.map((m: Record<string, unknown>) => m.category as string))],
    [MATERIAL_CATALOG],
  );

  const filteredCatalog = useMemo(
    () =>
      MATERIAL_CATALOG.filter((m: Record<string, unknown>) => {
        const matchSearch =
          searchTerm === '' ||
          ((m.nameAr as string) ?? '').includes(searchTerm) ||
          ((m.nameEn as string) ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          ((m.code as string) ?? '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchCategory = selectedCategory === 'All' || m.category === selectedCategory;
        return matchSearch && matchCategory;
      }),
    [MATERIAL_CATALOG, searchTerm, selectedCategory],
  );

  const addItemFromCatalog = (catalogItem: MaterialCatalogItem) => {
    const existing = items.find(i => i.itemCode === catalogItem.code);
    if (existing) {
      const updated = items.map(i =>
        i.itemCode === catalogItem.code
          ? { ...i, quantity: i.quantity + 1, totalPrice: (i.quantity + 1) * i.unitPrice }
          : i,
      );
      onItemsChange(updated);
    } else {
      const newItem: VoucherLineItem = {
        id: `line-${Date.now()}`,
        itemCode: catalogItem.code,
        itemName: catalogItem.nameEn,
        unit: catalogItem.unit,
        quantity: 1,
        unitPrice: catalogItem.unitPrice,
        totalPrice: catalogItem.unitPrice,
        condition: 'New',
      };
      onItemsChange([...items, newItem]);
    }
    setShowCatalog(false);
    setSearchTerm('');
  };

  const addItemFromScan = (scannedItem: Record<string, unknown>) => {
    const code = String(scannedItem.itemCode || scannedItem.code || '');
    const name = String(scannedItem.itemDescription || scannedItem.nameEn || scannedItem.itemName || '');
    const unit = String(scannedItem.unit || 'Piece');
    const price = Number(scannedItem.unitPrice || 0);

    // If item with same code already exists, increment qty
    const existing = items.find(i => i.itemCode === code);
    if (existing) {
      const updated = items.map(i =>
        i.itemCode === code ? { ...i, quantity: i.quantity + 1, totalPrice: (i.quantity + 1) * i.unitPrice } : i,
      );
      onItemsChange(updated);
    } else {
      const newItem: VoucherLineItem = {
        id: `line-${Date.now()}`,
        itemCode: code,
        itemName: name,
        unit,
        quantity: 1,
        unitPrice: price,
        totalPrice: price,
        condition: 'New',
      };
      onItemsChange([...items, newItem]);
    }
    setShowScanner(false);
  };

  const addBlankItem = () => {
    const newItem: VoucherLineItem = {
      id: `line-${Date.now()}`,
      itemCode: '',
      itemName: '',
      unit: 'Piece',
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      condition: 'New',
    };
    onItemsChange([...items, newItem]);
  };

  const removeItem = (id: string) => {
    onItemsChange(items.filter(i => i.id !== id));
  };

  const updateItem = (id: string, field: keyof VoucherLineItem, value: string | number) => {
    const updated = items.map(item => {
      if (item.id !== id) return item;
      const patched = { ...item, [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        patched.totalPrice =
          (field === 'quantity' ? Number(value) : patched.quantity) *
          (field === 'unitPrice' ? Number(value) : patched.unitPrice);
      }
      return patched;
    });
    onItemsChange(updated);
  };

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
      {showCatalog && (
        <div className="glass-card rounded-xl p-4 border border-nesma-secondary/20 animate-fade-in">
          <div className="flex gap-3 mb-4">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search items..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-black/30 border border-white/10 rounded-lg text-white text-sm focus:border-nesma-secondary outline-none"
                autoFocus
              />
            </div>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm focus:border-nesma-secondary outline-none"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
            {filteredCatalog.map((item: Record<string, unknown>) => (
              <button
                key={item.code as string}
                type="button"
                onClick={() => addItemFromCatalog(item as unknown as MaterialCatalogItem)}
                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 rounded-lg transition-colors text-left group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono bg-white/5 px-2 py-0.5 rounded text-gray-400 border border-white/5">
                    {item.code as string}
                  </span>
                  <div>
                    <span className="text-sm text-gray-200 group-hover:text-white">{item.nameEn as string}</span>
                    <span className="text-xs text-gray-500 block">{item.code as string}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm text-nesma-secondary font-medium">
                    {(item.unitPrice as number)?.toLocaleString()} SAR
                  </span>
                  <span className="text-xs text-gray-500 block">/{item.unit as string}</span>
                </div>
              </button>
            ))}
            {filteredCatalog.length === 0 && (
              <div className="text-center py-6 text-gray-500 text-sm">No results found</div>
            )}
          </div>
        </div>
      )}

      {/* Items Table */}
      {items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider">
                <th className="pb-3 px-2 font-medium w-8">#</th>
                <th className="pb-3 px-2 font-medium">Code</th>
                <th className="pb-3 px-2 font-medium min-w-[200px]">Item</th>
                <th className="pb-3 px-2 font-medium">Unit</th>
                <th className="pb-3 px-2 font-medium text-center">Qty</th>
                <th className="pb-3 px-2 font-medium text-center">Price</th>
                <th className="pb-3 px-2 font-medium text-center">Total</th>
                {showStockAvailability && <th className="pb-3 px-2 font-medium text-center">Available</th>}
                {showCondition && <th className="pb-3 px-2 font-medium">Condition</th>}
                {!readOnly && <th className="pb-3 px-2 font-medium w-10"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {items.map((item, idx) => (
                <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                  <td className="py-3 px-2 text-gray-500 text-sm">{idx + 1}</td>
                  <td className="py-3 px-2">
                    {readOnly ? (
                      <span className="text-xs font-mono text-gray-400">{item.itemCode}</span>
                    ) : (
                      <input
                        type="text"
                        value={item.itemCode}
                        onChange={e => updateItem(item.id, 'itemCode', e.target.value)}
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
                        onChange={e => updateItem(item.id, 'itemName', e.target.value)}
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
                        onChange={e => updateItem(item.id, 'unit', e.target.value)}
                        className="px-2 py-1.5 bg-black/20 border border-white/10 rounded-lg text-white text-xs focus:border-nesma-secondary outline-none"
                      >
                        {UNIT_OPTIONS.map(u => (
                          <option key={u} value={u}>
                            {u}
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
                        onChange={e => updateItem(item.id, 'quantity', Number(e.target.value))}
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
                        onChange={e => updateItem(item.id, 'unitPrice', Number(e.target.value))}
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
                      {item.itemCode ? (
                        (() => {
                          const available = getAvailableQty(item.itemCode);
                          const status = getStockStatus(item.itemCode);
                          const isInsufficient = item.quantity > available;
                          return (
                            <div className="flex flex-col items-center gap-0.5">
                              <span
                                className={`text-xs font-medium ${isInsufficient ? 'text-red-400' : status === 'Out of Stock' ? 'text-red-400' : status === 'Low Stock' ? 'text-amber-400' : 'text-emerald-400'}`}
                              >
                                {available}
                              </span>
                              {isInsufficient && (
                                <span className="flex items-center gap-1 text-[10px] text-red-400">
                                  <AlertTriangle size={10} /> Insufficient
                                </span>
                              )}
                            </div>
                          );
                        })()
                      ) : (
                        <span className="text-xs text-gray-600">--</span>
                      )}
                    </td>
                  )}
                  {showCondition && (
                    <td className="py-3 px-2">
                      {readOnly ? (
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            item.condition === 'New'
                              ? 'bg-green-500/10 text-green-400'
                              : item.condition === 'Good'
                                ? 'bg-blue-500/10 text-blue-400'
                                : item.condition === 'Fair'
                                  ? 'bg-yellow-500/10 text-yellow-400'
                                  : 'bg-red-500/10 text-red-400'
                          }`}
                        >
                          {item.condition}
                        </span>
                      ) : (
                        <select
                          value={item.condition || 'New'}
                          onChange={e => updateItem(item.id, 'condition', e.target.value)}
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
                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Total Row */}
          <div className="flex justify-end mt-4 pt-4 border-t border-white/10">
            <div className="glass-card px-6 py-3 rounded-xl flex items-center gap-6">
              <div className="text-sm text-gray-400">
                Items: <span className="text-white font-medium">{items.length}</span>
              </div>
              <div className="h-6 w-px bg-white/10"></div>
              <div className="text-sm text-gray-400">
                Total Qty:{' '}
                <span className="text-white font-medium">
                  {items.reduce((s, i) => s + i.quantity, 0).toLocaleString()}
                </span>
              </div>
              <div className="h-6 w-px bg-white/10"></div>
              <div className="text-sm">
                Total: <span className="text-nesma-secondary font-bold text-lg">{totalValue.toLocaleString()} SAR</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center">
          <div className="text-gray-500 mb-2">No items added yet</div>
          <div className="text-xs text-gray-600">
            Use the buttons above to add items from catalog, manually, or by scanning
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      <Suspense fallback={null}>
        <BarcodeScanner isOpen={showScanner} onClose={() => setShowScanner(false)} onItemFound={addItemFromScan} />
      </Suspense>
    </div>
  );
};
