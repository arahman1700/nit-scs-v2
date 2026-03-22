import React, { useState } from 'react';
import { useCreateAppointment } from '@/domains/warehouse-ops/hooks/useYard';
import type { DockDoor } from '@/domains/warehouse-ops/hooks/useYard';
import { X, Loader2 } from 'lucide-react';

export const ScheduleModal: React.FC<{
  warehouseId: string;
  dockDoors: DockDoor[];
  onClose: () => void;
}> = ({ warehouseId, dockDoors, onClose }) => {
  const createAppointment = useCreateAppointment();
  const [form, setForm] = useState({
    appointmentType: 'delivery',
    scheduledStart: '',
    scheduledEnd: '',
    dockDoorId: '',
    carrierName: '',
    driverName: '',
    vehiclePlate: '',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createAppointment.mutateAsync({
      warehouseId,
      appointmentType: form.appointmentType,
      scheduledStart: form.scheduledStart,
      scheduledEnd: form.scheduledEnd,
      dockDoorId: form.dockDoorId || undefined,
      carrierName: form.carrierName || undefined,
      driverName: form.driverName || undefined,
      vehiclePlate: form.vehiclePlate || undefined,
      notes: form.notes || undefined,
    });
    onClose();
  };

  const availableDoors = dockDoors.filter(d => d.status === 'available');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-card rounded-2xl p-6 w-full max-w-lg border border-white/10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-white">Schedule Appointment</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="appt-type-field" className="block text-xs text-gray-400 mb-1">
              Type
            </label>
            <select
              id="appt-type-field"
              className="input-field w-full"
              value={form.appointmentType}
              onChange={e => setForm(f => ({ ...f, appointmentType: e.target.value }))}
            >
              <option value="delivery">Delivery</option>
              <option value="pickup">Pickup</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="appt-start-time-field" className="block text-xs text-gray-400 mb-1">
                Start Time
              </label>
              <input
                id="appt-start-time-field"
                type="datetime-local"
                required
                className="input-field w-full"
                value={form.scheduledStart}
                onChange={e => setForm(f => ({ ...f, scheduledStart: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="appt-end-time-field" className="block text-xs text-gray-400 mb-1">
                End Time
              </label>
              <input
                id="appt-end-time-field"
                type="datetime-local"
                required
                className="input-field w-full"
                value={form.scheduledEnd}
                onChange={e => setForm(f => ({ ...f, scheduledEnd: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label htmlFor="appt-dock-door-field" className="block text-xs text-gray-400 mb-1">
              Dock Door (optional)
            </label>
            <select
              id="appt-dock-door-field"
              className="input-field w-full"
              value={form.dockDoorId}
              onChange={e => setForm(f => ({ ...f, dockDoorId: e.target.value }))}
            >
              <option value="">Auto-assign</option>
              {availableDoors.map(d => (
                <option key={d.id} value={d.id}>
                  Door {d.doorNumber} ({d.doorType})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="appt-carrier-field" className="block text-xs text-gray-400 mb-1">
                Carrier
              </label>
              <input
                id="appt-carrier-field"
                className="input-field w-full"
                placeholder="Carrier name"
                value={form.carrierName}
                onChange={e => setForm(f => ({ ...f, carrierName: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="appt-vehicle-plate-field" className="block text-xs text-gray-400 mb-1">
                Vehicle Plate
              </label>
              <input
                id="appt-vehicle-plate-field"
                className="input-field w-full"
                placeholder="e.g. ABC 1234"
                value={form.vehiclePlate}
                onChange={e => setForm(f => ({ ...f, vehiclePlate: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label htmlFor="appt-driver-name-field" className="block text-xs text-gray-400 mb-1">
              Driver Name
            </label>
            <input
              id="appt-driver-name-field"
              className="input-field w-full"
              placeholder="Driver name"
              value={form.driverName}
              onChange={e => setForm(f => ({ ...f, driverName: e.target.value }))}
            />
          </div>

          <div>
            <label htmlFor="appt-notes-field" className="block text-xs text-gray-400 mb-1">
              Notes
            </label>
            <textarea
              id="appt-notes-field"
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
              disabled={createAppointment.isPending}
              className="flex-1 btn-primary flex items-center justify-center gap-2"
            >
              {createAppointment.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Schedule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
