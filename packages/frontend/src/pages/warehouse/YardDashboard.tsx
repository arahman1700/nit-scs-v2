import React, { useState, useMemo } from 'react';
import {
  Truck,
  DoorOpen,
  CalendarClock,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  LogIn,
  LogOut,
  MapPin,
  Loader2,
  X,
  Wrench,
  BarChart3,
} from 'lucide-react';
import {
  useYardStatus,
  useCreateAppointment,
  useCheckInAppointment,
  useCompleteAppointment,
  useCancelAppointment,
  useCheckInTruck,
  useAssignDock,
  useCheckOutTruck,
} from '@/api/hooks/useYard';
import { useWarehouses } from '@/api/hooks/useMasterData';
import type { YardStatus, YardAppointment, TruckVisit, DockDoor } from '@/api/hooks/useYard';

// ── Status colors ─────────────────────────────────────────────────────

const DOCK_STATUS_COLOR: Record<string, { bg: string; border: string; text: string; label: string }> = {
  available: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/50', text: 'text-emerald-400', label: 'Available' },
  occupied: { bg: 'bg-red-500/20', border: 'border-red-500/50', text: 'text-red-400', label: 'Occupied' },
  maintenance: { bg: 'bg-gray-500/20', border: 'border-gray-500/50', text: 'text-gray-400', label: 'Maintenance' },
};

const APPT_STATUS_COLOR: Record<string, { bg: string; text: string; label: string }> = {
  scheduled: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Scheduled' },
  checked_in: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Checked In' },
  loading: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Loading' },
  completed: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Completed' },
  cancelled: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Cancelled' },
  no_show: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'No Show' },
};

const TRUCK_STATUS_COLOR: Record<string, { bg: string; text: string; label: string }> = {
  in_yard: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'In Yard' },
  at_dock: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'At Dock' },
  departed: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Departed' },
};

// ── Helpers ──────────────────────────────────────────────────────────

function formatTime(d: string | Date) {
  return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(d: string | Date) {
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDuration(checkIn: string): string {
  const ms = Date.now() - new Date(checkIn).getTime();
  const hours = Math.floor(ms / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// ── KPI Card ─────────────────────────────────────────────────────────

const KpiCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
}> = ({ icon, label, value, color }) => (
  <div className="glass-card rounded-2xl p-5 border border-white/5">
    <div className="flex items-center gap-3">
      <div className={`p-2.5 rounded-xl ${color}`}>{icon}</div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
      </div>
    </div>
  </div>
);

// ── Schedule Appointment Modal ────────────────────────────────────────

const ScheduleModal: React.FC<{
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
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Type</label>
            <select
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
              <label className="block text-xs text-gray-400 mb-1">Start Time</label>
              <input
                type="datetime-local"
                required
                className="input-field w-full"
                value={form.scheduledStart}
                onChange={e => setForm(f => ({ ...f, scheduledStart: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">End Time</label>
              <input
                type="datetime-local"
                required
                className="input-field w-full"
                value={form.scheduledEnd}
                onChange={e => setForm(f => ({ ...f, scheduledEnd: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Dock Door (optional)</label>
            <select
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
              <label className="block text-xs text-gray-400 mb-1">Carrier</label>
              <input
                className="input-field w-full"
                placeholder="Carrier name"
                value={form.carrierName}
                onChange={e => setForm(f => ({ ...f, carrierName: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Vehicle Plate</label>
              <input
                className="input-field w-full"
                placeholder="e.g. ABC 1234"
                value={form.vehiclePlate}
                onChange={e => setForm(f => ({ ...f, vehiclePlate: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Driver Name</label>
            <input
              className="input-field w-full"
              placeholder="Driver name"
              value={form.driverName}
              onChange={e => setForm(f => ({ ...f, driverName: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Notes</label>
            <textarea
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

// ── Check-in Truck Modal ──────────────────────────────────────────────

const CheckInTruckModal: React.FC<{
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
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Vehicle Plate *</label>
            <input
              required
              className="input-field w-full"
              placeholder="e.g. ABC 1234"
              value={form.vehiclePlate}
              onChange={e => setForm(f => ({ ...f, vehiclePlate: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Purpose</label>
            <select
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
              <label className="block text-xs text-gray-400 mb-1">Driver</label>
              <input
                className="input-field w-full"
                placeholder="Driver name"
                value={form.driverName}
                onChange={e => setForm(f => ({ ...f, driverName: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Carrier</label>
              <input
                className="input-field w-full"
                placeholder="Carrier name"
                value={form.carrierName}
                onChange={e => setForm(f => ({ ...f, carrierName: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Notes</label>
            <textarea
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

// ── Main Component ─────────────────────────────────────────────────────

export const YardDashboard: React.FC = () => {
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'appointments' | 'trucks'>('overview');

  // Queries
  const { data: warehousesRes } = useWarehouses();
  const warehouses =
    (warehousesRes as unknown as { data?: Array<{ id: string; warehouseName: string; warehouseCode: string }> })
      ?.data ?? [];

  const { data: statusRes, isLoading } = useYardStatus(selectedWarehouse || undefined);
  const yardStatus = (statusRes as unknown as { data?: YardStatus })?.data;

  // Mutations
  const checkInAppt = useCheckInAppointment();
  const completeAppt = useCompleteAppointment();
  const cancelAppt = useCancelAppointment();
  const assignDock = useAssignDock();
  const checkOutTruck = useCheckOutTruck();

  // Auto-select first warehouse
  React.useEffect(() => {
    if (warehouses.length > 0 && !selectedWarehouse) {
      setSelectedWarehouse(warehouses[0].id);
    }
  }, [warehouses, selectedWarehouse]);

  // Derived data
  const summary = yardStatus?.summary;
  const dockDoors = yardStatus?.dockDoors ?? [];
  const activeTrucks = yardStatus?.activeTrucks ?? [];
  const todayAppointments = yardStatus?.todayAppointments ?? [];

  const upcomingAppts = useMemo(
    () => todayAppointments.filter(a => ['scheduled', 'checked_in', 'loading'].includes(a.status)),
    [todayAppointments],
  );

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Truck className="w-7 h-7 text-nesma-primary" />
            Yard Management
          </h1>
          <p className="text-sm text-gray-400 mt-1">Dock doors, appointments, and truck tracking</p>
        </div>

        <div className="flex items-center gap-3">
          <select
            className="input-field"
            value={selectedWarehouse}
            onChange={e => setSelectedWarehouse(e.target.value)}
          >
            <option value="">Select Warehouse</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>
                {w.warehouseCode} - {w.warehouseName}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowScheduleModal(true)}
            disabled={!selectedWarehouse}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <CalendarClock className="w-4 h-4" />
            Schedule
          </button>
          <button
            onClick={() => setShowCheckInModal(true)}
            disabled={!selectedWarehouse}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <LogIn className="w-4 h-4" />
            Check-in
          </button>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────── */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            icon={<DoorOpen className="w-5 h-5 text-blue-400" />}
            label="Total Docks"
            value={summary.totalDocks}
            color="bg-blue-500/15"
          />
          <KpiCard
            icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />}
            label="Available"
            value={summary.availableDocks}
            color="bg-emerald-500/15"
          />
          <KpiCard
            icon={<Truck className="w-5 h-5 text-amber-400" />}
            label="Trucks in Yard"
            value={summary.trucksInYard}
            color="bg-amber-500/15"
          />
          <KpiCard
            icon={<CalendarClock className="w-5 h-5 text-purple-400" />}
            label="Today's Appointments"
            value={summary.appointmentsToday}
            color="bg-purple-500/15"
          />
        </div>
      )}

      {/* ── Tabs ───────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1">
        {(['overview', 'appointments', 'trucks'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-nesma-primary text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab === 'overview' ? 'Overview' : tab === 'appointments' ? 'Appointments' : 'Active Trucks'}
          </button>
        ))}
      </div>

      {/* ── Loading ─────────────────────────────────────────────────── */}
      {isLoading && selectedWarehouse && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-nesma-primary animate-spin" />
        </div>
      )}

      {!selectedWarehouse && (
        <div className="glass-card rounded-2xl p-12 text-center border border-white/5">
          <MapPin className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Select a warehouse to view yard status</p>
        </div>
      )}

      {/* ── Tab: Overview ─────────────────────────────────────────── */}
      {activeTab === 'overview' && yardStatus && (
        <div className="space-y-6">
          {/* Dock Door Grid */}
          <div className="glass-card rounded-2xl p-6 border border-white/5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <DoorOpen className="w-5 h-5 text-nesma-primary" />
              Dock Doors
            </h2>
            {dockDoors.length === 0 ? (
              <p className="text-sm text-gray-500">No dock doors configured for this warehouse.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {dockDoors.map(door => {
                  const statusStyle = DOCK_STATUS_COLOR[door.status] ?? DOCK_STATUS_COLOR.available;
                  const activeTruck = door.truckVisits?.[0];

                  return (
                    <div
                      key={door.id}
                      className={`relative rounded-xl p-4 border ${statusStyle.bg} ${statusStyle.border} transition-all hover:scale-[1.02]`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-white">#{door.doorNumber}</span>
                        <span className={`text-[10px] uppercase font-medium ${statusStyle.text}`}>
                          {statusStyle.label}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{door.doorType}</div>
                      {activeTruck && (
                        <div className="mt-2 pt-2 border-t border-white/10">
                          <p className="text-xs text-white font-medium truncate">{activeTruck.vehiclePlate}</p>
                          {activeTruck.driverName && (
                            <p className="text-[10px] text-gray-400 truncate">{activeTruck.driverName}</p>
                          )}
                        </div>
                      )}
                      {door.status === 'maintenance' && (
                        <Wrench className="absolute top-3 right-3 w-3.5 h-3.5 text-gray-500" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Two-column: Upcoming Appointments + Active Trucks */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upcoming Appointments */}
            <div className="glass-card rounded-2xl p-6 border border-white/5">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-nesma-primary" />
                Upcoming Appointments
                {upcomingAppts.length > 0 && (
                  <span className="text-xs bg-nesma-primary/20 text-nesma-primary px-2 py-0.5 rounded-full">
                    {upcomingAppts.length}
                  </span>
                )}
              </h2>
              {upcomingAppts.length === 0 ? (
                <p className="text-sm text-gray-500 py-4">No upcoming appointments today.</p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {upcomingAppts.map(appt => {
                    const statusStyle = APPT_STATUS_COLOR[appt.status] ?? APPT_STATUS_COLOR.scheduled;
                    return (
                      <div
                        key={appt.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-white font-medium">
                              {formatTime(appt.scheduledStart)} - {formatTime(appt.scheduledEnd)}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text}`}
                            >
                              {statusStyle.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-400 capitalize">{appt.appointmentType}</span>
                            {appt.carrierName && <span className="text-xs text-gray-500">| {appt.carrierName}</span>}
                            {appt.vehiclePlate && <span className="text-xs text-gray-500">| {appt.vehiclePlate}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          {appt.status === 'scheduled' && (
                            <button
                              onClick={() => checkInAppt.mutate(appt.id)}
                              className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
                              title="Check In"
                            >
                              <LogIn className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {['checked_in', 'loading'].includes(appt.status) && (
                            <button
                              onClick={() => completeAppt.mutate(appt.id)}
                              className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                              title="Complete"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {appt.status !== 'completed' && appt.status !== 'cancelled' && (
                            <button
                              onClick={() => cancelAppt.mutate(appt.id)}
                              className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Active Trucks */}
            <div className="glass-card rounded-2xl p-6 border border-white/5">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Truck className="w-5 h-5 text-nesma-primary" />
                Active Trucks
                {activeTrucks.length > 0 && (
                  <span className="text-xs bg-nesma-primary/20 text-nesma-primary px-2 py-0.5 rounded-full">
                    {activeTrucks.length}
                  </span>
                )}
              </h2>
              {activeTrucks.length === 0 ? (
                <p className="text-sm text-gray-500 py-4">No trucks currently in the yard.</p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {activeTrucks.map(truck => {
                    const statusStyle = TRUCK_STATUS_COLOR[truck.status] ?? TRUCK_STATUS_COLOR.in_yard;
                    return (
                      <div
                        key={truck.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-white font-bold">{truck.vehiclePlate}</span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text}`}
                            >
                              {statusStyle.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock className="w-3 h-3 text-gray-500" />
                            <span className="text-xs text-gray-400">{getDuration(truck.checkInAt)}</span>
                            <span className="text-xs text-gray-500 capitalize">| {truck.purpose}</span>
                            {truck.driverName && <span className="text-xs text-gray-500">| {truck.driverName}</span>}
                            {truck.dockDoor && (
                              <span className="text-xs text-amber-400">| Dock #{truck.dockDoor.doorNumber}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          {truck.status === 'in_yard' && (
                            <button
                              onClick={() => {
                                const availDoor = dockDoors.find(d => d.status === 'available');
                                if (availDoor) {
                                  assignDock.mutate({ truckId: truck.id, dockDoorId: availDoor.id });
                                }
                              }}
                              className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                              title="Assign Dock"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => checkOutTruck.mutate(truck.id)}
                            className="p-1.5 rounded-lg bg-gray-500/20 text-gray-400 hover:bg-gray-500/30 transition-colors"
                            title="Check Out"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Appointments ──────────────────────────────────────── */}
      {activeTab === 'appointments' && yardStatus && (
        <div className="glass-card rounded-2xl p-6 border border-white/5">
          <h2 className="text-lg font-semibold text-white mb-4">Today's Appointments</h2>
          {todayAppointments.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">No appointments scheduled for today.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-xs text-gray-400 font-medium pb-3 uppercase tracking-wider">Time</th>
                    <th className="text-left text-xs text-gray-400 font-medium pb-3 uppercase tracking-wider">Type</th>
                    <th className="text-left text-xs text-gray-400 font-medium pb-3 uppercase tracking-wider">
                      Carrier
                    </th>
                    <th className="text-left text-xs text-gray-400 font-medium pb-3 uppercase tracking-wider">
                      Vehicle
                    </th>
                    <th className="text-left text-xs text-gray-400 font-medium pb-3 uppercase tracking-wider">Dock</th>
                    <th className="text-left text-xs text-gray-400 font-medium pb-3 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-right text-xs text-gray-400 font-medium pb-3 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {todayAppointments.map(appt => {
                    const statusStyle = APPT_STATUS_COLOR[appt.status] ?? APPT_STATUS_COLOR.scheduled;
                    return (
                      <tr key={appt.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 text-white">
                          {formatTime(appt.scheduledStart)} - {formatTime(appt.scheduledEnd)}
                        </td>
                        <td className="py-3 text-gray-300 capitalize">{appt.appointmentType}</td>
                        <td className="py-3 text-gray-300">{appt.carrierName || '-'}</td>
                        <td className="py-3 text-gray-300">{appt.vehiclePlate || '-'}</td>
                        <td className="py-3 text-gray-300">{appt.dockDoor ? `#${appt.dockDoor.doorNumber}` : '-'}</td>
                        <td className="py-3">
                          <span className={`text-xs px-2 py-1 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                            {statusStyle.label}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {appt.status === 'scheduled' && (
                              <button
                                onClick={() => checkInAppt.mutate(appt.id)}
                                className="text-xs text-amber-400 hover:text-amber-300"
                              >
                                Check In
                              </button>
                            )}
                            {['checked_in', 'loading'].includes(appt.status) && (
                              <button
                                onClick={() => completeAppt.mutate(appt.id)}
                                className="text-xs text-emerald-400 hover:text-emerald-300"
                              >
                                Complete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Trucks ────────────────────────────────────────────── */}
      {activeTab === 'trucks' && yardStatus && (
        <div className="glass-card rounded-2xl p-6 border border-white/5">
          <h2 className="text-lg font-semibold text-white mb-4">Active Trucks in Yard</h2>
          {activeTrucks.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">No trucks currently in the yard.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-xs text-gray-400 font-medium pb-3 uppercase tracking-wider">
                      Vehicle
                    </th>
                    <th className="text-left text-xs text-gray-400 font-medium pb-3 uppercase tracking-wider">
                      Driver
                    </th>
                    <th className="text-left text-xs text-gray-400 font-medium pb-3 uppercase tracking-wider">
                      Carrier
                    </th>
                    <th className="text-left text-xs text-gray-400 font-medium pb-3 uppercase tracking-wider">
                      Purpose
                    </th>
                    <th className="text-left text-xs text-gray-400 font-medium pb-3 uppercase tracking-wider">
                      Check-in
                    </th>
                    <th className="text-left text-xs text-gray-400 font-medium pb-3 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="text-left text-xs text-gray-400 font-medium pb-3 uppercase tracking-wider">Dock</th>
                    <th className="text-left text-xs text-gray-400 font-medium pb-3 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-right text-xs text-gray-400 font-medium pb-3 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {activeTrucks.map(truck => {
                    const statusStyle = TRUCK_STATUS_COLOR[truck.status] ?? TRUCK_STATUS_COLOR.in_yard;
                    return (
                      <tr key={truck.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 text-white font-medium">{truck.vehiclePlate}</td>
                        <td className="py-3 text-gray-300">{truck.driverName || '-'}</td>
                        <td className="py-3 text-gray-300">{truck.carrierName || '-'}</td>
                        <td className="py-3 text-gray-300 capitalize">{truck.purpose}</td>
                        <td className="py-3 text-gray-300">{formatDateTime(truck.checkInAt)}</td>
                        <td className="py-3 text-amber-400">{getDuration(truck.checkInAt)}</td>
                        <td className="py-3 text-gray-300">{truck.dockDoor ? `#${truck.dockDoor.doorNumber}` : '-'}</td>
                        <td className="py-3">
                          <span className={`text-xs px-2 py-1 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                            {statusStyle.label}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {truck.status === 'in_yard' && (
                              <button
                                onClick={() => {
                                  const availDoor = dockDoors.find(d => d.status === 'available');
                                  if (availDoor) {
                                    assignDock.mutate({ truckId: truck.id, dockDoorId: availDoor.id });
                                  }
                                }}
                                className="text-xs text-blue-400 hover:text-blue-300"
                              >
                                Assign Dock
                              </button>
                            )}
                            <button
                              onClick={() => checkOutTruck.mutate(truck.id)}
                              className="text-xs text-gray-400 hover:text-white"
                            >
                              Check Out
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────── */}
      {showScheduleModal && selectedWarehouse && (
        <ScheduleModal
          warehouseId={selectedWarehouse}
          dockDoors={dockDoors}
          onClose={() => setShowScheduleModal(false)}
        />
      )}
      {showCheckInModal && selectedWarehouse && (
        <CheckInTruckModal warehouseId={selectedWarehouse} onClose={() => setShowCheckInModal(false)} />
      )}
    </div>
  );
};
