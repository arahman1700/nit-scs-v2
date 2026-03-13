import React, { useState } from 'react';
import { useWidgetData } from '@/domains/reporting/hooks/useWidgetData';
import type { DashboardWidget } from '@/domains/reporting/hooks/useDashboards';

interface ZoneData {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
  color?: string;
}

interface MapData {
  zones: ZoneData[];
}

interface MapWidgetProps {
  widget: DashboardWidget;
}

const DEFAULT_ZONE_COLORS = ['#2E3A8C', '#10b981', '#f59e0b', '#80D1E9', '#8b5cf6', '#ef4444'];

function getZoneColor(zone: ZoneData, index: number): string {
  return zone.color || DEFAULT_ZONE_COLORS[index % DEFAULT_ZONE_COLORS.length];
}

export const MapWidget: React.FC<MapWidgetProps> = ({ widget }) => {
  const { data, isLoading } = useWidgetData(widget.dataSource);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; name: string; value: number } | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full animate-pulse">
        <div className="h-32 w-full bg-white/5 rounded-lg" />
      </div>
    );
  }

  const result = data?.data as MapData | undefined;
  const zones = result?.zones ?? [];

  if (zones.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-sm">No zone data available</div>;
  }

  // Calculate viewBox from zone bounds
  const maxX = Math.max(...zones.map(z => z.x + z.width));
  const maxY = Math.max(...zones.map(z => z.y + z.height));
  const padding = 20;
  const viewWidth = maxX + padding * 2;
  const viewHeight = maxY + padding * 2;

  return (
    <div className="w-full h-full overflow-auto relative">
      <svg width="100%" height="100%" viewBox={`0 0 ${viewWidth} ${viewHeight}`} preserveAspectRatio="xMidYMid meet">
        {zones.map((zone, i) => {
          const color = getZoneColor(zone, i);
          const zoneX = zone.x + padding;
          const zoneY = zone.y + padding;

          return (
            <g
              key={zone.id}
              className="cursor-pointer"
              onMouseEnter={e => {
                const svg = (e.target as SVGElement).closest('div')?.getBoundingClientRect();
                if (svg) {
                  const rect = (e.target as SVGElement).getBoundingClientRect();
                  setTooltip({
                    x: rect.left - svg.left + rect.width / 2,
                    y: rect.top - svg.top - 4,
                    name: zone.name,
                    value: zone.value,
                  });
                }
              }}
              onMouseLeave={() => setTooltip(null)}
            >
              {/* Zone rectangle */}
              <rect
                x={zoneX}
                y={zoneY}
                width={zone.width}
                height={zone.height}
                rx={6}
                fill={color}
                fillOpacity={0.35}
                stroke={color}
                strokeWidth={1.5}
                strokeOpacity={0.6}
                className="hover:fill-opacity-50 transition-all duration-200"
              />

              {/* Zone name */}
              <text
                x={zoneX + zone.width / 2}
                y={zoneY + zone.height / 2 - 6}
                textAnchor="middle"
                fill="#e5e7eb"
                fontSize="11"
                fontWeight="500"
                fontFamily="Inter, system-ui, sans-serif"
              >
                {zone.name}
              </text>

              {/* Zone value */}
              <text
                x={zoneX + zone.width / 2}
                y={zoneY + zone.height / 2 + 10}
                textAnchor="middle"
                fill="#9ca3af"
                fontSize="10"
                fontFamily="Inter, system-ui, sans-serif"
              >
                {zone.value.toLocaleString()}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none px-2 py-1 rounded-lg bg-[#0d2137] border border-white/10 text-xs text-white whitespace-nowrap z-10"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          {tooltip.name}: {tooltip.value.toLocaleString()}
        </div>
      )}
    </div>
  );
};
