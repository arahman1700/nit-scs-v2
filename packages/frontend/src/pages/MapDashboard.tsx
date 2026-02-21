import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useWarehouses, useProjects } from '@/api/hooks';
import type { Warehouse, Project } from '@nit-scs-v2/shared/types';
import { Filter, Layers, Maximize, Search, Navigation, Loader2 } from 'lucide-react';

/** Minimal Leaflet type surface used by this component (full @types/leaflet not installed) */
interface LeafletMap {
  setView(center: [number, number], zoom: number): LeafletMap;
  flyTo(latlng: [number, number], zoom: number, opts?: Record<string, unknown>): void;
  eachLayer(fn: (layer: LeafletLayer) => void): void;
  removeLayer(layer: LeafletLayer): void;
}

interface LeafletLayer {
  _url?: string;
  options?: Record<string, unknown>;
}

interface LeafletMarker extends LeafletLayer {
  openPopup(): void;
  bindPopup(content: string, opts?: Record<string, unknown>): LeafletMarker;
  addTo(map: LeafletMap): LeafletMarker;
}

interface LeafletStatic {
  map(el: HTMLElement, opts?: Record<string, unknown>): LeafletMap;
  tileLayer(url: string, opts?: Record<string, unknown>): { addTo(map: LeafletMap): void };
  marker(latlng: [number, number], opts?: Record<string, unknown>): LeafletMarker;
  divIcon(opts: Record<string, unknown>): unknown;
  control: { zoom(opts: Record<string, unknown>): { addTo(map: LeafletMap): void } };
}

declare global {
  interface Window {
    L: LeafletStatic;
  }
}

interface MapLocation {
  id: string;
  name: string;
  type: 'Project' | 'Warehouse';
  lat: number;
  lng: number;
  details: string;
}

const TYPE_COLORS: Record<string, string> = {
  Project: '#2E3192',
  Warehouse: '#F59E0B',
};

export const MapDashboard: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LeafletMarker[]>([]);

  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null);
  const [activeLayer, setActiveLayer] = useState<'dark' | 'satellite'>('dark');
  const [searchTerm, setSearchTerm] = useState('');

  // Filters — only Project and Warehouse have real data
  const [filters, setFilters] = useState({
    Project: true,
    Warehouse: true,
  });

  const toggleFilter = (key: keyof typeof filters) => {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Fetch real data
  const warehouseQuery = useWarehouses({ pageSize: 200 });
  const projectQuery = useProjects({ pageSize: 200 });

  const isLoading = warehouseQuery.isLoading || projectQuery.isLoading;

  // Build locations from API data
  const locations = useMemo(() => {
    const locs: MapLocation[] = [];

    // Warehouses — backend may return Prisma field names (warehouseName, latitude) or mapped names (name, lat)
    type RawWarehouse = Warehouse & {
      warehouseName?: string;
      warehouseCode?: string;
      latitude?: number;
      longitude?: number;
    };
    const warehouses = (warehouseQuery.data?.data ?? []) as RawWarehouse[];
    for (const wh of warehouses) {
      const lat = Number(wh.latitude ?? wh.lat);
      const lng = Number(wh.longitude ?? wh.lng);
      if (lat && lng) {
        locs.push({
          id: wh.id,
          name: wh.warehouseName ?? wh.name ?? 'Warehouse',
          type: 'Warehouse',
          lat,
          lng,
          details: `Code: ${wh.warehouseCode ?? wh.id} | Status: ${wh.status ?? 'active'}`,
        });
      }
    }

    // Projects — may or may not have lat/lng
    type RawProject = Project & {
      projectName?: string;
      projectCode?: string;
      latitude?: number;
      longitude?: number;
      lat?: number;
      lng?: number;
    };
    const projects = (projectQuery.data?.data ?? []) as RawProject[];
    for (const proj of projects) {
      const lat = Number(proj.latitude ?? proj.lat);
      const lng = Number(proj.longitude ?? proj.lng);
      if (lat && lng) {
        locs.push({
          id: proj.id,
          name: proj.projectName ?? proj.name ?? 'Project',
          type: 'Project',
          lat,
          lng,
          details: `${proj.projectCode ?? ''} | Client: ${proj.client ?? 'N/A'}`,
        });
      }
    }

    return locs;
  }, [warehouseQuery.data, projectQuery.data]);

  // Filtered + searched locations
  const filteredLocations = useMemo(() => {
    let result = locations.filter(loc => filters[loc.type]);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(loc => loc.name.toLowerCase().includes(term) || loc.details.toLowerCase().includes(term));
    }
    return result;
  }, [locations, filters, searchTerm]);

  // Fly to location function
  const flyToLocation = (loc: MapLocation) => {
    if (!mapInstanceRef.current) return;

    setSelectedLocation(loc);
    mapInstanceRef.current.flyTo([loc.lat, loc.lng], 12, {
      duration: 2,
      easeLinearity: 0.25,
    });

    // Find and open popup
    const marker = markersRef.current.find(m => m.options?.id === loc.id);
    if (marker) {
      setTimeout(() => marker.openPopup(), 2200); // Open after animation
    }
  };

  useEffect(() => {
    if (!window.L || !mapContainerRef.current) return;

    // Initialize Map if not already done
    if (!mapInstanceRef.current) {
      // Create Map
      mapInstanceRef.current = window.L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([24.7136, 46.6753], 6); // Centered on Saudi Arabia

      // Custom Zoom Control to bottom right
      window.L.control.zoom({ position: 'bottomright' }).addTo(mapInstanceRef.current);
    }

    const map = mapInstanceRef.current;

    // Layer Handling
    map.eachLayer((layer: LeafletLayer) => {
      if (layer._url) map.removeLayer(layer);
    });

    if (activeLayer === 'dark') {
      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(map);
    } else {
      window.L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
        },
      ).addTo(map);
    }

    // Update Markers — clear existing
    markersRef.current.forEach(marker => map.removeLayer(marker));
    markersRef.current = [];

    // Define Custom Icons
    const getIcon = (type: string) => {
      const color = TYPE_COLORS[type] || '#B3B3B3';
      let iconHtml = '';

      switch (type) {
        case 'Project':
          iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4 8 4v14"/><path d="M17 21v-8H7v8"/></svg>`;
          break;
        case 'Warehouse':
          iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`;
          break;
      }

      return window.L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="marker-pin" style="background-color: ${color}; width: 44px; height: 44px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5); cursor: pointer;">
                      <div style="transform: rotate(45deg);">${iconHtml}</div>
                   </div>`,
        iconSize: [44, 44],
        iconAnchor: [22, 44],
        popupAnchor: [0, -48],
      });
    };

    // Add Markers based on filtered locations
    filteredLocations.forEach(loc => {
      const marker = window.L.marker([loc.lat, loc.lng], {
        icon: getIcon(loc.type),
        id: loc.id,
      }).addTo(map);

      const typeColor = TYPE_COLORS[loc.type] || '#B3B3B3';
      const popupContent = `
            <div class="min-w-[240px] font-sans">
                <div class="h-20 w-full mb-3 rounded-lg overflow-hidden border border-white/10 relative flex items-center justify-center" style="background: linear-gradient(135deg, ${typeColor}40, ${typeColor}10);">
                    <span style="color: ${typeColor}; font-size: 28px; font-weight: 800; opacity: 0.4;">${loc.type.charAt(0)}</span>
                    <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                         <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-nesma-secondary/20 text-nesma-secondary border border-nesma-secondary/30 backdrop-blur-sm">${loc.type}</span>
                    </div>
                </div>
                <h3 class="font-bold text-lg mb-1 text-white leading-tight">${loc.name}</h3>
                <div class="flex items-center gap-1 text-gray-400 text-xs mb-2">
                   <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                   <span>${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}</span>
                </div>
                <p class="text-sm text-gray-300 leading-relaxed bg-white/5 p-2 rounded-lg border border-white/5">${loc.details}</p>
            </div>
        `;

      marker.bindPopup(popupContent, {
        className: 'custom-popup',
        closeButton: false,
        maxWidth: 280,
      });

      markersRef.current.push(marker);
    });
  }, [filteredLocations, activeLayer]);

  return (
    <div className="flex gap-6 h-[calc(100vh-140px)] animate-fade-in">
      {/* Sidebar List */}
      <div className="w-80 glass-card rounded-2xl flex flex-col overflow-hidden hidden lg:flex border border-white/10 shadow-2xl">
        <div className="p-4 border-b border-white/10 bg-white/5">
          <h3 className="font-bold text-white mb-3">Active Assets</h3>
          <div className="relative">
            <Search size={16} className="absolute top-1/2 -translate-y-1/2 left-3 text-gray-400" />
            <input
              type="text"
              placeholder="Find warehouse, project..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-nesma-secondary"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 size={24} className="animate-spin mr-2" />
              <span className="text-sm">Loading locations...</span>
            </div>
          ) : filteredLocations.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">No geolocated assets found</div>
          ) : (
            filteredLocations.map(loc => (
              <div
                key={loc.id}
                onClick={() => flyToLocation(loc)}
                className={`p-3 rounded-xl cursor-pointer transition-all border group ${selectedLocation?.id === loc.id ? 'bg-nesma-primary/20 border-nesma-primary/50' : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/10'}`}
              >
                <div className="flex gap-3">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 border border-white/10"
                    style={{ backgroundColor: `${TYPE_COLORS[loc.type] || '#B3B3B3'}30` }}
                  >
                    <span className="text-lg font-bold" style={{ color: TYPE_COLORS[loc.type] || '#B3B3B3' }}>
                      {loc.type.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4
                        className={`text-sm font-bold truncate ${selectedLocation?.id === loc.id ? 'text-nesma-secondary' : 'text-gray-200 group-hover:text-white'}`}
                      >
                        {loc.name}
                      </h4>
                      <span
                        className={`text-[10px] px-1.5 rounded flex-shrink-0 ml-1 ${selectedLocation?.id === loc.id ? 'bg-nesma-primary text-white' : 'bg-white/10 text-gray-400'}`}
                      >
                        {loc.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-500 truncate">
                      <Navigation size={10} />
                      <span>
                        {loc.lat.toFixed(2)}, {loc.lng.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-white/10 text-xs text-gray-500 text-center bg-black/20">
          {isLoading
            ? 'Loading...'
            : `${filteredLocations.length} location${filteredLocations.length !== 1 ? 's' : ''} in Kingdom`}
        </div>
      </div>

      {/* Main Map Area */}
      <div className="flex-1 relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl group">
        {/* Floating Controls */}
        <div className="absolute top-4 left-4 z-[400] bg-nesma-dark/90 backdrop-blur-md p-4 rounded-xl border border-white/10 shadow-2xl min-w-[200px]">
          <div className="flex items-center gap-2 mb-3 border-b border-white/10 pb-2">
            <Filter size={16} className="text-nesma-secondary" />
            <span className="font-bold text-white text-sm">Asset Filters</span>
          </div>
          <div className="space-y-2">
            {Object.keys(filters).map(key => (
              <label key={key} className="flex items-center gap-3 cursor-pointer group/filter">
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${filters[key as keyof typeof filters] ? 'bg-nesma-secondary border-nesma-secondary' : 'border-gray-500 bg-transparent'}`}
                >
                  {filters[key as keyof typeof filters] && <div className="w-2 h-2 bg-nesma-dark rounded-sm"></div>}
                </div>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={filters[key as keyof typeof filters]}
                  onChange={() => toggleFilter(key as keyof typeof filters)}
                />
                <span className="text-sm text-gray-300 group-hover/filter:text-white transition-colors">{key}s</span>
              </label>
            ))}
          </div>
        </div>

        <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2">
          <button
            onClick={() => setActiveLayer(activeLayer === 'dark' ? 'satellite' : 'dark')}
            className="p-3 bg-nesma-dark/90 backdrop-blur-md rounded-xl border border-white/10 text-white hover:bg-nesma-primary hover:text-white hover:border-nesma-secondary/50 transition-all shadow-xl group/btn"
            title="Toggle Satellite"
          >
            <Layers size={20} className={activeLayer === 'satellite' ? 'text-nesma-secondary' : 'text-gray-300'} />
          </button>
          <button className="p-3 bg-nesma-dark/90 backdrop-blur-md rounded-xl border border-white/10 text-white hover:bg-nesma-primary hover:text-white hover:border-nesma-secondary/50 transition-all shadow-xl">
            <Maximize size={20} className="text-gray-300" />
          </button>
        </div>

        {/* Loading overlay on map */}
        {isLoading && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-nesma-dark/60 pointer-events-none">
            <div className="flex items-center gap-2 bg-nesma-dark/90 px-4 py-2 rounded-lg border border-white/10">
              <Loader2 size={18} className="animate-spin text-nesma-secondary" />
              <span className="text-sm text-white">Loading assets...</span>
            </div>
          </div>
        )}

        {/* Map */}
        <div id="map-container" ref={mapContainerRef} className="w-full h-full bg-nesma-dark"></div>

        {/* Bottom Gradient Overlay for Aesthetics */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-nesma-dark to-transparent pointer-events-none z-[400]"></div>
      </div>
    </div>
  );
};
