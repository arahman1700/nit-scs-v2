import React from 'react';
import { TRUCK_STATUS_COLOR, getDuration, formatDateTime } from './YardKpiCards';
import type { DockDoor, TruckVisit } from '@/domains/warehouse-ops/hooks/useYard';
import { Truck, Clock, LogOut, MapPin } from 'lucide-react';

// ── Overview: Active Trucks Card ──────────────────────────────────────

interface ActiveTrucksCardProps {
  activeTrucks: TruckVisit[];
  dockDoors: DockDoor[];
  onAssignDock: (truckId: string, dockDoorId: string) => void;
  onCheckOut: (truckId: string) => void;
}

export const ActiveTrucksCard: React.FC<ActiveTrucksCardProps> = ({
  activeTrucks,
  dockDoors,
  onAssignDock,
  onCheckOut,
}) => (
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
      <p className="text-sm text-gray-400 py-4">No trucks currently in the yard.</p>
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
                  <Clock className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-400">{getDuration(truck.checkInAt)}</span>
                  <span className="text-xs text-gray-400 capitalize">| {truck.purpose}</span>
                  {truck.driverName && <span className="text-xs text-gray-400">| {truck.driverName}</span>}
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
                        onAssignDock(truck.id, availDoor.id);
                      }
                    }}
                    className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                    title="Assign Dock"
                    aria-label="Assign dock"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => onCheckOut(truck.id)}
                  className="p-1.5 rounded-lg bg-gray-500/20 text-gray-400 hover:bg-gray-500/30 transition-colors"
                  title="Check Out"
                  aria-label="Check out"
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
);

// ── Full Trucks Table (Trucks tab) ──────────────────────────────────

interface TrucksTableProps {
  activeTrucks: TruckVisit[];
  dockDoors: DockDoor[];
  onAssignDock: (truckId: string, dockDoorId: string) => void;
  onCheckOut: (truckId: string) => void;
}

export const TrucksTable: React.FC<TrucksTableProps> = ({
  activeTrucks,
  dockDoors,
  onAssignDock,
  onCheckOut,
}) => (
  <div className="glass-card rounded-2xl p-6 border border-white/5">
    <h2 className="text-lg font-semibold text-white mb-4">Active Trucks in Yard</h2>
    {activeTrucks.length === 0 ? (
      <p className="text-sm text-gray-400 py-8 text-center">No trucks currently in the yard.</p>
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
                              onAssignDock(truck.id, availDoor.id);
                            }
                          }}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          Assign Dock
                        </button>
                      )}
                      <button
                        onClick={() => onCheckOut(truck.id)}
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
);
