import React, { useState } from 'react';
import { useCheckInTruck } from '@/domains/warehouse-ops/hooks/useYard';
import { X, Loader2 } from 'lucide-react';

export const CheckInTruckModal: React.FC<{
  warehouseId: string;
  onClose: () => void;
}> = ({ warehouseId, onClose }) => {
  const checkInTruck = useCheckInTruck();
  const [form, setForm] = useState({
    vehiclePlate: '',
    driverName: '',
    carrierName: '',
    purpose: 'delivery',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await checkInTruck.mutateAsync({
      warehouseId,
      vehiclePlate: form.vehiclePlate,
      driverName: form.driverName || undefined,
      carrierName: form.carrierName || undefined,
      purpose: form.purpose,
      notes: form.notes || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-card rounded-2xl p-6 w-full max-w-md border border-white/10">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-white">Check-in Truck</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="truck-vehicle-plate-field" className="block text-xs text-gray-400 mb-1">
              Vehicle Plate *
            </label>
            <input
              id="truck-vehicle-plate-field"
              required
              className="input-field w-full"
              placeholder="e.g. ABC 1234"
              value={form.vehiclePlate}
              onChange={e => setForm(f => ({ ...f, vehiclePlate: e.target.value }))}
            />
          </div>

          <div>
            <label htmlFor="truck-purpose-field" className="block text-xs text-gray-400 mb-1">
              Purpose
            </label>
            <select
              id="truck-purpose-field"
              className="input-field w-full"
              value={form.purpose}
              onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
            >
              <option value="delivery">Delivery</option>
              <option value="pickup">Pickup</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="truck-driver-field" className="block text-xs text-gray-400 mb-1">
                Driver
              </label>
              <input
                id="truck-driver-field"
                className="input-field w-full"
                placeholder="Driver name"
                value={form.driverName}
                onChange={e => setForm(f => ({ ...f, driverName: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="truck-carrier-field" className="block text-xs text-gray-400 mb-1">
                Carrier
              </label>
              <input
                id="truck-carrier-field"
                className="input-field w-full"
                placeholder="Carrier name"
                value={form.carrierName}
                onChange={e => setForm(f => ({ ...f, carrierName: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label htmlFor="truck-notes-field" className="block text-xs text-gray-400 mb-1">
              Notes
            </label>
            <textarea
              id="truck-notes-field"
              className="input-field w-full"
              rows={2}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={checkInTruck.isPending}
              className="flex-1 btn-primary flex items-center justify-center gap-2"
            >
              {checkInTruck.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Check In
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
