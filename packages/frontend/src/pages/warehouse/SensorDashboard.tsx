import React, { useState, useMemo, useCallback } from 'react';
import {
  Thermometer,
  Droplets,
  Wind,
  Activity,
  Weight,
  AlertTriangle,
  CheckCircle,
  Radio,
  X,
  Loader2,
  Bell,
  Eye,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { useSensorList, useSensorAlerts, useAcknowledgeAlert, useSensorReadings, useZoneHeatmap } from '@/api/hooks';
import type { Sensor, SensorAlert, ZoneHeatmapEntry } from '@/api/hooks';

// ── Constants ──────────────────────────────────────────────────────────────

const SENSOR_TYPE_ICONS: Record<string, React.ReactNode> = {
  temperature: <Thermometer className="w-5 h-5" />,
  humidity: <Droplets className="w-5 h-5" />,
  smoke: <Wind className="w-5 h-5" />,
  motion: <Activity className="w-5 h-5" />,
  weight: <Weight className="w-5 h-5" />,
};

const SENSOR_TYPE_COLORS: Record<string, string> = {
  temperature: 'text-orange-400',
  humidity: 'text-cyan-400',
  smoke: 'text-gray-400',
  motion: 'text-purple-400',
  weight: 'text-amber-400',
};

function getTempColor(temp: number | null): string {
  if (temp === null) return 'bg-gray-700/50 border-gray-600';
  if (temp > 40) return 'bg-red-600/30 border-red-500/50';
  if (temp > 35) return 'bg-orange-500/30 border-orange-500/50';
  if (temp > 25) return 'bg-green-500/30 border-green-500/50';
  if (temp > 15) return 'bg-cyan-500/30 border-cyan-500/50';
  return 'bg-blue-600/30 border-blue-500/50';
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Main Component ─────────────────────────────────────────────────────────

export const SensorDashboard: React.FC = () => {
  const [selectedWarehouseId] = useState<string | undefined>(undefined);
  const [selectedSensor, setSelectedSensor] = useState<Sensor | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'heatmap' | 'alerts'>('overview');

  // Data hooks
  const { data: sensorResponse, isLoading: sensorsLoading } = useSensorList({
    warehouseId: selectedWarehouseId,
  });
  const { data: alertsResponse, isLoading: alertsLoading } = useSensorAlerts(selectedWarehouseId, false);
  const { data: heatmapResponse } = useZoneHeatmap(selectedWarehouseId);

  const sensors = (sensorResponse?.data ?? []) as Sensor[];
  const alerts = (alertsResponse?.data ?? []) as SensorAlert[];
  const heatmap = (heatmapResponse?.data ?? []) as ZoneHeatmapEntry[];

  // ── KPI Calculations ─────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const totalSensors = sensors.length;
    const activeSensors = sensors.filter(s => s.isActive).length;
    const activeAlerts = alerts.length;

    const tempSensors = sensors.filter(s => s.sensorType === 'temperature' && s.lastValue !== null);
    const avgTemp =
      tempSensors.length > 0 ? tempSensors.reduce((sum, s) => sum + Number(s.lastValue), 0) / tempSensors.length : null;

    const humSensors = sensors.filter(s => s.sensorType === 'humidity' && s.lastValue !== null);
    const avgHumidity =
      humSensors.length > 0 ? humSensors.reduce((sum, s) => sum + Number(s.lastValue), 0) / humSensors.length : null;

    return { totalSensors, activeSensors, activeAlerts, avgTemp, avgHumidity };
  }, [sensors, alerts]);

  // ── Loading State ─────────────────────────────────────────────────────────

  if (sensorsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-7 h-7 text-nesma-secondary animate-spin" />
        <span className="ml-3 text-gray-400">Loading sensor data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white glow-text flex items-center gap-3">
            <Radio className="text-nesma-secondary" />
            IoT Sensor Monitoring
          </h1>
          <p className="text-sm text-gray-400 mt-1">Real-time environmental monitoring across warehouse zones</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard
          icon={<Radio className="w-4 h-4" />}
          iconBg="bg-nesma-primary/20"
          iconColor="text-nesma-secondary"
          value={kpis.totalSensors}
          label="Total Sensors"
          sublabel={`${kpis.activeSensors} active`}
        />
        <KpiCard
          icon={<AlertTriangle className="w-4 h-4" />}
          iconBg={kpis.activeAlerts > 0 ? 'bg-red-500/20' : 'bg-emerald-500/20'}
          iconColor={kpis.activeAlerts > 0 ? 'text-red-400' : 'text-emerald-400'}
          value={kpis.activeAlerts}
          label="Active Alerts"
          valueColor={kpis.activeAlerts > 0 ? 'text-red-400' : 'text-emerald-400'}
          borderColor={kpis.activeAlerts > 0 ? 'border-red-500/20' : undefined}
        />
        <KpiCard
          icon={<Thermometer className="w-4 h-4" />}
          iconBg="bg-orange-500/20"
          iconColor="text-orange-400"
          value={kpis.avgTemp !== null ? `${kpis.avgTemp.toFixed(1)}` : '--'}
          label="Avg Temperature"
          sublabel={'\u00B0C'}
        />
        <KpiCard
          icon={<Droplets className="w-4 h-4" />}
          iconBg="bg-cyan-500/20"
          iconColor="text-cyan-400"
          value={kpis.avgHumidity !== null ? `${kpis.avgHumidity.toFixed(1)}` : '--'}
          label="Avg Humidity"
          sublabel="%"
        />
        <KpiCard
          icon={<CheckCircle className="w-4 h-4" />}
          iconBg="bg-emerald-500/20"
          iconColor="text-emerald-400"
          value={kpis.totalSensors > 0 ? `${Math.round((kpis.activeSensors / kpis.totalSensors) * 100)}%` : '--'}
          label="Uptime"
        />
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit">
        {(['overview', 'heatmap', 'alerts'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab ? 'bg-nesma-primary text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab === 'overview' && 'Sensors'}
            {tab === 'heatmap' && 'Zone Heatmap'}
            {tab === 'alerts' && (
              <span className="flex items-center gap-2">
                Alerts
                {kpis.activeAlerts > 0 && (
                  <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">{kpis.activeAlerts}</span>
                )}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <SensorGrid sensors={sensors} onSelect={setSelectedSensor} />}
      {activeTab === 'heatmap' && <ZoneHeatmapGrid zones={heatmap} />}
      {activeTab === 'alerts' && <AlertsPanel alerts={alerts} isLoading={alertsLoading} />}

      {/* Sensor Detail Modal */}
      {selectedSensor && <SensorDetailModal sensor={selectedSensor} onClose={() => setSelectedSensor(null)} />}
    </div>
  );
};

// ── KPI Card ───────────────────────────────────────────────────────────────

const KpiCard: React.FC<{
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  value: string | number;
  label: string;
  sublabel?: string;
  valueColor?: string;
  borderColor?: string;
}> = ({ icon, iconBg, iconColor, value, label, sublabel, valueColor, borderColor }) => (
  <div className={`glass-card p-4 rounded-xl border ${borderColor ?? 'border-white/10'}`}>
    <div className="flex items-center gap-2 mb-2">
      <div className={`p-2 rounded-lg ${iconBg} ${iconColor}`}>{icon}</div>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
    <div className="flex items-baseline gap-1">
      <p className={`text-2xl font-bold ${valueColor ?? 'text-white'}`}>{value}</p>
      {sublabel && <span className="text-sm text-gray-400">{sublabel}</span>}
    </div>
  </div>
);

// ── Sensor Grid ────────────────────────────────────────────────────────────

const SensorGrid: React.FC<{
  sensors: Sensor[];
  onSelect: (sensor: Sensor) => void;
}> = ({ sensors, onSelect }) => {
  if (sensors.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-12 text-center">
        <Radio className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400">No sensors registered yet</p>
        <p className="text-gray-500 text-sm mt-1">Sensors will appear here once registered via the API</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {sensors.map(sensor => (
        <SensorCard key={sensor.id} sensor={sensor} onSelect={onSelect} />
      ))}
    </div>
  );
};

// ── Sensor Card with Sparkline ─────────────────────────────────────────────

const SensorCard: React.FC<{
  sensor: Sensor;
  onSelect: (sensor: Sensor) => void;
}> = ({ sensor, onSelect }) => {
  const alertCount = sensor._count?.alerts ?? 0;
  const isOnline = sensor.lastReadingAt ? Date.now() - new Date(sensor.lastReadingAt).getTime() < 3600_000 : false;

  // Fetch last 24h readings for sparkline
  const from24h = useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() - 24);
    return d.toISOString();
  }, []);

  const { data: readingsResponse } = useSensorReadings(sensor.id, from24h);
  const readings = (readingsResponse?.data ?? []) as Array<{ value: number; recordedAt: string }>;

  const sparkData = useMemo(
    () => readings.map(r => ({ t: new Date(r.recordedAt).getTime(), v: Number(r.value) })),
    [readings],
  );

  return (
    <div
      className="glass-card rounded-xl p-4 border border-white/10 hover:border-nesma-secondary/30 transition-all cursor-pointer group"
      onClick={() => onSelect(sensor)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg bg-white/5 ${SENSOR_TYPE_COLORS[sensor.sensorType] ?? 'text-gray-400'}`}>
            {SENSOR_TYPE_ICONS[sensor.sensorType] ?? <Radio className="w-5 h-5" />}
          </div>
          <div>
            <p className="text-sm font-medium text-white">{sensor.sensorCode}</p>
            <p className="text-xs text-gray-500 capitalize">{sensor.sensorType}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {alertCount > 0 && (
            <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full border border-red-500/30">
              {alertCount}
            </span>
          )}
          <div
            className={`w-2 h-2 rounded-full ${
              !sensor.isActive ? 'bg-gray-500' : isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
        </div>
      </div>

      {/* Current Value */}
      <div className="mb-3">
        <p className="text-3xl font-bold text-white">
          {sensor.lastValue !== null ? Number(sensor.lastValue).toFixed(1) : '--'}
          <span className="text-sm font-normal text-gray-400 ml-1">{sensor.unit}</span>
        </p>
        <p className="text-xs text-gray-500 mt-0.5">{formatTimeAgo(sensor.lastReadingAt)}</p>
      </div>

      {/* Threshold Range Bar */}
      {(sensor.minThreshold !== null || sensor.maxThreshold !== null) && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{sensor.minThreshold !== null ? Number(sensor.minThreshold) : '--'}</span>
            <span>Threshold Range</span>
            <span>{sensor.maxThreshold !== null ? Number(sensor.maxThreshold) : '--'}</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                sensor.lastValue !== null &&
                ((sensor.maxThreshold !== null && Number(sensor.lastValue) > Number(sensor.maxThreshold)) ||
                  (sensor.minThreshold !== null && Number(sensor.lastValue) < Number(sensor.minThreshold)))
                  ? 'bg-red-500'
                  : 'bg-emerald-500'
              }`}
              style={{
                width: `${
                  sensor.lastValue !== null && sensor.minThreshold !== null && sensor.maxThreshold !== null
                    ? Math.min(
                        100,
                        Math.max(
                          5,
                          ((Number(sensor.lastValue) - Number(sensor.minThreshold)) /
                            (Number(sensor.maxThreshold) - Number(sensor.minThreshold))) *
                            100,
                        ),
                      )
                    : 50
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Sparkline */}
      {sparkData.length > 1 && (
        <div className="h-12 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData}>
              <defs>
                <linearGradient id={`grad-${sensor.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke="#10b981"
                fill={`url(#grad-${sensor.id})`}
                strokeWidth={1.5}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Zone */}
      {sensor.zone && (
        <p className="text-xs text-gray-500 mt-2 truncate">
          {sensor.zone.zoneName} ({sensor.zone.zoneCode})
        </p>
      )}
      {sensor.location && <p className="text-xs text-gray-600 truncate">{sensor.location}</p>}

      {/* Hover Eye */}
      <div className="flex justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Eye size={14} className="text-nesma-secondary" />
      </div>
    </div>
  );
};

// ── Zone Heatmap Grid ──────────────────────────────────────────────────────

const ZoneHeatmapGrid: React.FC<{ zones: ZoneHeatmapEntry[] }> = ({ zones }) => {
  if (zones.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-12 text-center">
        <Thermometer className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400">No zone data available</p>
        <p className="text-gray-500 text-sm mt-1">Assign sensors to warehouse zones to see the heatmap</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-xs text-gray-400">
        <span>Temperature Scale:</span>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-blue-600/50" />
          <span>&lt;15</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-cyan-500/50" />
          <span>15-25</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-green-500/50" />
          <span>25-35</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-orange-500/50" />
          <span>35-40</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-red-600/50" />
          <span>&gt;40</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {zones.map(zone => (
          <div key={zone.id} className={`rounded-xl p-5 border transition-all ${getTempColor(zone.avgTemperature)}`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-white">{zone.zoneName}</p>
              <span className="text-xs px-2 py-0.5 bg-black/20 rounded text-gray-300">{zone.zoneCode}</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Thermometer size={14} className="text-orange-400" />
                <span className="text-lg font-bold text-white">
                  {zone.avgTemperature !== null ? `${zone.avgTemperature.toFixed(1)}\u00B0C` : '--'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Droplets size={14} className="text-cyan-400" />
                <span className="text-sm text-gray-300">
                  {zone.avgHumidity !== null ? `${zone.avgHumidity.toFixed(1)}%` : '--'}
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2 capitalize">{zone.zoneType.replace('_', ' ')}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Alerts Panel ───────────────────────────────────────────────────────────

const AlertsPanel: React.FC<{ alerts: SensorAlert[]; isLoading: boolean }> = ({ alerts, isLoading }) => {
  const ackMutation = useAcknowledgeAlert();

  const handleAcknowledge = useCallback(
    (alertId: string) => {
      ackMutation.mutate(alertId);
    },
    [ackMutation],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-12 text-center">
        <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
        <p className="text-white font-medium">All Clear</p>
        <p className="text-gray-400 text-sm mt-1">No unacknowledged alerts</p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-white/10 flex items-center gap-2">
        <Bell className="w-4 h-4 text-red-400" />
        <h3 className="text-lg font-semibold text-white">Unacknowledged Alerts ({alerts.length})</h3>
      </div>
      <div className="divide-y divide-white/5">
        {alerts.map(alert => (
          <div key={alert.id} className="p-4 flex items-center gap-4 hover:bg-white/5 transition-colors">
            <div
              className={`p-2 rounded-lg ${
                alert.alertType === 'threshold_high'
                  ? 'bg-red-500/20 text-red-400'
                  : alert.alertType === 'threshold_low'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-gray-500/20 text-gray-400'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium">{alert.message}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-gray-500">
                  {alert.sensor?.sensorCode} &middot; {alert.sensor?.location ?? 'N/A'}
                </span>
                <span className="text-xs text-gray-600">{new Date(alert.createdAt).toLocaleString()}</span>
              </div>
            </div>
            <button
              onClick={() => handleAcknowledge(alert.id)}
              disabled={ackMutation.isPending}
              className="px-3 py-1.5 bg-nesma-primary/20 text-nesma-secondary text-xs rounded-lg hover:bg-nesma-primary/30 transition-colors border border-nesma-primary/30 whitespace-nowrap"
            >
              Acknowledge
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Sensor Detail Modal ────────────────────────────────────────────────────

const SensorDetailModal: React.FC<{
  sensor: Sensor;
  onClose: () => void;
}> = ({ sensor, onClose }) => {
  // Fetch readings for the last 7 days
  const from7d = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  }, []);

  const { data: readingsResponse, isLoading } = useSensorReadings(sensor.id, from7d);
  const readings = (readingsResponse?.data ?? []) as Array<{
    value: number;
    recordedAt: string;
  }>;

  const chartData = useMemo(
    () =>
      readings.map(r => ({
        time: new Date(r.recordedAt).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        value: Number(r.value),
      })),
    [readings],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-3xl rounded-2xl overflow-hidden border border-white/10 bg-nesma-dark"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-white/10 bg-white/5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-white/5 ${SENSOR_TYPE_COLORS[sensor.sensorType] ?? 'text-gray-400'}`}>
              {SENSOR_TYPE_ICONS[sensor.sensorType] ?? <Radio className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{sensor.sensorCode}</h3>
              <p className="text-sm text-gray-400 capitalize">{sensor.sensorType} sensor</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">Current Value</p>
              <p className="text-2xl font-bold text-white">
                {sensor.lastValue !== null ? Number(sensor.lastValue).toFixed(1) : '--'}
                <span className="text-sm text-gray-400 ml-1">{sensor.unit}</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Warehouse</p>
              <p className="text-white">{sensor.warehouse?.warehouseName ?? '--'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Zone</p>
              <p className="text-white">{sensor.zone?.zoneName ?? 'Unassigned'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Location</p>
              <p className="text-white">{sensor.location ?? '--'}</p>
            </div>
          </div>

          {/* Threshold Info */}
          <div className="flex gap-4">
            <div className="flex-1 bg-white/5 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Min Threshold</p>
              <p className="text-lg font-bold text-cyan-400">
                {sensor.minThreshold !== null ? `${Number(sensor.minThreshold)} ${sensor.unit}` : 'Not set'}
              </p>
            </div>
            <div className="flex-1 bg-white/5 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Max Threshold</p>
              <p className="text-lg font-bold text-orange-400">
                {sensor.maxThreshold !== null ? `${Number(sensor.maxThreshold)} ${sensor.unit}` : 'Not set'}
              </p>
            </div>
            <div className="flex-1 bg-white/5 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Last Reading</p>
              <p className="text-lg font-bold text-white">{formatTimeAgo(sensor.lastReadingAt)}</p>
            </div>
          </div>

          {/* Reading History Chart */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Reading History (Last 7 Days)</h4>
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : chartData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                    <XAxis dataKey="time" stroke="#6b7280" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0E2841',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: 12,
                      }}
                    />
                    {sensor.maxThreshold !== null && (
                      <Line
                        type="monotone"
                        dataKey={() => Number(sensor.maxThreshold)}
                        stroke="#ef4444"
                        strokeDasharray="5 5"
                        strokeWidth={1}
                        dot={false}
                        name="Max"
                      />
                    )}
                    {sensor.minThreshold !== null && (
                      <Line
                        type="monotone"
                        dataKey={() => Number(sensor.minThreshold)}
                        stroke="#3b82f6"
                        strokeDasharray="5 5"
                        strokeWidth={1}
                        dot={false}
                        name="Min"
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: '#10b981' }}
                      name="Value"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
                No readings recorded in the last 7 days
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
