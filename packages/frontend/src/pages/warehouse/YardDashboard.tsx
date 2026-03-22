import React, { useState, useMemo } from 'react';
import {
  Truck,
  CalendarClock,
  LogIn,
  MapPin,
  Loader2,
} from 'lucide-react';
import {
  useYardStatus,
  useCheckInAppointment,
  useCompleteAppointment,
  useCancelAppointment,
  useAssignDock,
  useCheckOutTruck,
  useDockUtilization,
} from '@/domains/warehouse-ops/hooks/useYard';
import { useWarehouses } from '@/domains/master-data/hooks/useMasterData';
import { toRecord } from '@/utils/type-helpers';
import type { YardStatus, DockUtilization } from '@/domains/warehouse-ops/hooks/useYard';

// Sub-components
import { YardSummaryKpis, AnalyticsSlaKpis } from './yard/YardKpiCards';
import { ScheduleModal } from './yard/ScheduleModal';
import { CheckInTruckModal } from './yard/CheckInTruckModal';
import { YardDockGrid } from './yard/YardDockGrid';
import { UpcomingAppointmentsCard, AppointmentsTable } from './yard/YardAppointmentsTable';
import { ActiveTrucksCard, TrucksTable } from './yard/YardTrucksTable';
import { YardDockChart, UtilizationSummaryCard } from './yard/YardDockChart';

// ── Main Component ─────────────────────────────────────────────────────

export const YardDashboard: React.FC = () => {
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'appointments' | 'trucks' | 'analytics'>('overview');

  // Queries
  const { data: warehousesRes } = useWarehouses();
  const warehouses =
    (toRecord(warehousesRes).data as Array<{ id: string; warehouseName: string; warehouseCode: string }> | undefined) ??
    [];

  const { data: statusRes, isLoading } = useYardStatus(selectedWarehouse || undefined);
  const yardStatus = toRecord(statusRes).data as YardStatus | undefined;

  const todayDate = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const { data: utilizationRes } = useDockUtilization(selectedWarehouse || undefined, todayDate);
  const utilization = toRecord(utilizationRes).data as DockUtilization | undefined;

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

  // Mutation callbacks
  const handleAssignDock = (truckId: string, dockDoorId: string) => {
    assignDock.mutate({ truckId, dockDoorId });
  };

  const handleCheckOutTruck = (truckId: string) => {
    checkOutTruck.mutate(truckId);
  };

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
      {summary && <YardSummaryKpis summary={summary} />}

      {/* ── Tabs ───────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1">
        {(['overview', 'appointments', 'trucks', 'analytics'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-nesma-primary text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab === 'overview'
              ? 'Overview'
              : tab === 'appointments'
                ? 'Appointments'
                : tab === 'trucks'
                  ? 'Active Trucks'
                  : 'Analytics'}
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
          <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-400">Select a warehouse to view yard status</p>
        </div>
      )}

      {/* ── Tab: Overview ─────────────────────────────────────────── */}
      {activeTab === 'overview' && yardStatus && (
        <div className="space-y-6">
          <YardDockGrid dockDoors={dockDoors} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <UpcomingAppointmentsCard
              upcomingAppts={upcomingAppts}
              onCheckIn={id => checkInAppt.mutate(id)}
              onComplete={id => completeAppt.mutate(id)}
              onCancel={id => cancelAppt.mutate(id)}
            />
            <ActiveTrucksCard
              activeTrucks={activeTrucks}
              dockDoors={dockDoors}
              onAssignDock={handleAssignDock}
              onCheckOut={handleCheckOutTruck}
            />
          </div>
        </div>
      )}

      {/* ── Tab: Appointments ──────────────────────────────────────── */}
      {activeTab === 'appointments' && yardStatus && (
        <AppointmentsTable
          todayAppointments={todayAppointments}
          onCheckIn={id => checkInAppt.mutate(id)}
          onComplete={id => completeAppt.mutate(id)}
        />
      )}

      {/* ── Tab: Trucks ────────────────────────────────────────────── */}
      {activeTab === 'trucks' && yardStatus && (
        <TrucksTable
          activeTrucks={activeTrucks}
          dockDoors={dockDoors}
          onAssignDock={handleAssignDock}
          onCheckOut={handleCheckOutTruck}
        />
      )}

      {/* ── Tab: Analytics ──────────────────────────────────────────── */}
      {activeTab === 'analytics' && yardStatus && (
        <div className="space-y-6">
          <AnalyticsSlaKpis todayAppointments={todayAppointments} />
          <YardDockChart
            utilization={utilization}
            dockDoors={dockDoors}
            todayAppointments={todayAppointments}
          />
          {utilization?.summary && <UtilizationSummaryCard summary={utilization.summary} />}
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
