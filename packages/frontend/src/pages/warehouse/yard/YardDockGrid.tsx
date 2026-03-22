import React from 'react';
import type { DockDoor } from '@/domains/warehouse-ops/hooks/useYard';
import { DOCK_STATUS_COLOR } from './YardKpiCards';
import { DoorOpen, Wrench } from 'lucide-react';

interface YardDockGridProps {
  dockDoors: DockDoor[];
}

export const YardDockGrid: React.FC<YardDockGridProps> = ({ dockDoors }) => (
  <div className="glass-card rounded-2xl p-6 border border-white/5">
    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
      <DoorOpen className="w-5 h-5 text-nesma-primary" />
      Dock Doors
    </h2>
    {dockDoors.length === 0 ? (
      <p className="text-sm text-gray-400">No dock doors configured for this warehouse.</p>
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
                <Wrench className="absolute top-3 right-3 w-3.5 h-3.5 text-gray-400" />
              )}
            </div>
          );
        })}
      </div>
    )}
  </div>
);
