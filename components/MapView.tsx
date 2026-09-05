'use client';

import React, { useEffect, useRef, useState } from 'react';
import { JournalEntry, MOOD_CONFIGS } from '@/lib/types';
import { GlowingMarble } from './GlowingMarble';
import { formatDateDDMMYYYY } from '@/lib/utils';
import { MapPin, Sparkles, ArrowUpRight, Navigation, Globe } from 'lucide-react';

import 'leaflet/dist/leaflet.css';

interface MapViewProps {
  entries: JournalEntry[];
  onSelectEntry: (id: string) => void;
  onNewReflection: () => void;
}

// Sample fallback coordinates if user hasn't added coordinates to their location tags yet
const SAMPLE_PINS = [
  { name: 'Kyoto, Japan', lat: 35.0116, lng: 135.7681, mood: 'great' as const, title: 'Bamboo Groves Meditation' },
  { name: 'Paris, France', lat: 48.8566, lng: 2.3522, mood: 'good' as const, title: 'Autumn Stroll by the Seine' },
  { name: 'San Francisco, CA', lat: 37.7749, lng: -122.4194, mood: 'professional' as const, title: 'Tech Architecture Review' },
  { name: 'Zurich, Switzerland', lat: 47.3769, lng: 8.5417, mood: 'great' as const, title: 'Mountain Air Clarity' },
];

export const MapView: React.FC<MapViewProps> = ({
  entries,
  onSelectEntry,
  onNewReflection,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // Entries that have valid coordinates
  const geotaggedEntries = entries.filter(
    (e) => e.location && typeof e.location.lat === 'number' && typeof e.location.lng === 'number'
  );

  // Load Leaflet dynamically via package import
  useEffect(() => {
    let isCancelled = false;

    const loadLeaflet = async () => {
      let L: any = (window as any).L;
      if (!L) {
        try {
          const leafletModule = await import('leaflet');
          L = leafletModule.default || leafletModule;
          (window as any).L = L;
        } catch (err) {
          console.error('Failed to dynamically load Leaflet package:', err);
          return;
        }
      }

      if (isCancelled || !mapContainerRef.current) return;

      L = (window as any).L;
      if (!L) return;

      // Clean up previous instance if any
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Default center coordinates
      let centerLat = 20;
      let centerLng = 0;
      let initialZoom = 2;

      if (geotaggedEntries.length > 0) {
        centerLat = geotaggedEntries[0].location!.lat!;
        centerLng = geotaggedEntries[0].location!.lng!;
        initialZoom = geotaggedEntries.length === 1 ? 10 : 3;
      }

      // Initialize map
      const map = L.map(mapContainerRef.current, {
        center: [centerLat, centerLng],
        zoom: initialZoom,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // CartoDB Positron / OSM tiles for an ultra-clean, minimal aesthetic matching our Urbanist design
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>, &copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
      setIsMapLoaded(true);

      const markersGroup = L.featureGroup();

      // Plot actual user entries
      geotaggedEntries.forEach((entry) => {
        const lat = entry.location!.lat!;
        const lng = entry.location!.lng!;
        const mood = entry.mood || 'good';
        const moodConfig = MOOD_CONFIGS[mood] || MOOD_CONFIGS.good;
        const firstPhoto = (entry.images && entry.images.length > 0) ? entry.images[0] : entry.image;

        // Custom HTML Marker with Glowing Marble and thumbnail
        const markerHtml = `
          <div class="relative group cursor-pointer" style="transform: translate(-50%, -50%);">
            <div class="w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-125 duration-200"
                 style="background: #212121; border: 2.5px solid white;">
              ${firstPhoto 
                ? `<img src="${firstPhoto}" class="w-full h-full object-cover rounded-full" />`
                : `<div class="w-5 h-5 rounded-full" style="background: ${moodConfig.gradient}; box-shadow: 0 0 8px ${moodConfig.shadow};"></div>`
              }
            </div>
            <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#212121]"></div>
          </div>
        `;

        const customIcon = L.divIcon({
          html: markerHtml,
          className: 'custom-journal-pin',
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });

        const marker = L.marker([lat, lng], { icon: customIcon });

        marker.on('click', () => {
          setSelectedEntry(entry);
        });

        marker.bindTooltip(`<b>${entry.title || 'Reflection'}</b><br/>${entry.location!.name}`, {
          direction: 'top',
          offset: [0, -20],
        });

        markersGroup.addLayer(marker);
      });

      // If user has no geotagged entries yet, plot clean sample pins so map feels alive
      if (geotaggedEntries.length === 0) {
        SAMPLE_PINS.forEach((pin, idx) => {
          const cfg = MOOD_CONFIGS[pin.mood];
          const markerHtml = `
            <div class="relative group cursor-pointer" style="transform: translate(-50%, -50%);">
              <div class="w-9 h-9 rounded-full flex items-center justify-center shadow-lg hover:scale-125 transition-transform"
                   style="background: #212121; border: 2px solid white;">
                <div class="w-5 h-5 rounded-full" style="background: ${cfg.gradient}; box-shadow: 0 0 8px ${cfg.shadow};"></div>
              </div>
            </div>
          `;
          const customIcon = L.divIcon({
            html: markerHtml,
            className: 'sample-journal-pin',
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          });
          const marker = L.marker([pin.lat, pin.lng], { icon: customIcon });
          marker.bindTooltip(`<b>${pin.title}</b><br/>${pin.name} (Sample Milestone)`, {
            direction: 'top',
            offset: [0, -18],
          });
          markersGroup.addLayer(marker);
        });
      }

      markersGroup.addTo(map);

      if (geotaggedEntries.length > 1) {
        map.fitBounds(markersGroup.getBounds(), { padding: [50, 50] });
      }
    };

    loadLeaflet().catch((err) => console.error('Failed to load Leaflet:', err));

    return () => {
      isCancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [geotaggedEntries.length]);

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-[#F6F5FA] relative">
      {/* Interactive Map Container */}
      <div className="flex-1 h-full relative z-10">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Floating Map Header Overlay */}
        <div className="absolute top-6 left-6 z-20 pointer-events-auto bg-white/90 backdrop-blur-md px-5 py-3 rounded-3xl border border-[#212121]/10 shadow-lg flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#EFF0A3] flex items-center justify-center text-[#212121]">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#212121]">
              Reflections Around the World
            </h2>
            <p className="text-[11px] text-[#212121]/60 font-semibold">
              {geotaggedEntries.length} Geotagged Journal Pins
            </p>
          </div>
        </div>

        {/* Quick info tag if user has no geotagged entries yet */}
        {geotaggedEntries.length === 0 && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-auto bg-[#212121] text-white px-5 py-2.5 rounded-full text-xs font-semibold shadow-xl flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#EFF0A3]" />
            <span>Tag your reflections with Location in the editor to drop permanent pins here!</span>
          </div>
        )}
      </div>

      {/* Right Drawer: Geotagged Entries Explorer */}
      <div className="w-full md:w-96 border-t md:border-t-0 md:border-l border-[#212121]/8 bg-white p-6 sm:p-7 flex flex-col justify-between overflow-y-auto shrink-0 z-20">
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#212121]/5">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#212121]" />
              <h3 className="text-sm font-bold text-[#212121]">Geographic Journeys</h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-[#F6F5FA] text-xs font-bold text-[#212121]">
              {geotaggedEntries.length} Pins
            </span>
          </div>

          {/* Selected Pin Modal / Card */}
          {selectedEntry ? (
            <div className="p-4 rounded-3xl bg-[#EFF0A3]/50 border border-[#212121]/10 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#212121]/70">
                  Selected Reflection Pin
                </span>
                <button
                  onClick={() => setSelectedEntry(null)}
                  className="text-xs font-bold text-[#212121]/50 hover:text-[#212121]"
                >
                  Close
                </button>
              </div>

              <div className="flex items-center gap-2.5">
                <GlowingMarble mood={selectedEntry.mood || 'good'} size="md" />
                <h4 className="text-base font-bold text-[#212121] leading-tight">
                  {selectedEntry.title || 'Untitled Reflection'}
                </h4>
              </div>

              <p className="text-xs text-[#212121]/70 line-clamp-3 leading-relaxed">
                {selectedEntry.content || 'No written notes recorded.'}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-[#212121]/10 text-xs">
                <span className="font-bold text-[#212121]/60">
                  {formatDateDDMMYYYY(selectedEntry.createdAt || selectedEntry.updatedAt)}
                </span>
                <button
                  onClick={() => onSelectEntry(selectedEntry.id)}
                  className="px-4 py-1.5 rounded-full bg-[#212121] text-white text-xs font-semibold hover:bg-black transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Open Entry</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#212121]/50 font-medium">
              Click any pin on the map or select an entry below to inspect its memories.
            </p>
          )}

          {/* List of Geotagged Entries */}
          <div className="space-y-2 pt-2">
            {geotaggedEntries.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#212121]/50 font-medium">
                No location tags logged yet. Click "Location" while writing your next reflection!
              </div>
            ) : (
              geotaggedEntries.map((entry) => {
                const dateStr = formatDateDDMMYYYY(entry.createdAt || entry.updatedAt);
                const isCurrent = selectedEntry?.id === entry.id;

                return (
                  <div
                    key={entry.id}
                    onClick={() => {
                      setSelectedEntry(entry);
                      if (mapInstanceRef.current && entry.location?.lat && entry.location?.lng) {
                        mapInstanceRef.current.flyTo([entry.location.lat, entry.location.lng], 12);
                      }
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isCurrent
                        ? 'bg-[#EFF0A3] border-[#212121] shadow-xs'
                        : 'bg-[#F6F5FA] border-transparent hover:border-[#212121]/15'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <GlowingMarble mood={entry.mood || 'good'} size="sm" />
                      <div className="truncate">
                        <p className="text-xs font-bold truncate text-[#212121]">
                          {entry.title || 'Untitled'}
                        </p>
                        <p className="text-[10px] text-[#212121]/50 truncate flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5 text-[#212121]/40" />
                          <span>{entry.location?.name}</span>
                        </p>
                      </div>
                    </div>

                    <span className="text-[10px] font-semibold text-[#212121]/40 shrink-0">
                      {dateStr}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-[#212121]/5">
          <button
            onClick={onNewReflection}
            className="w-full h-11 rounded-full bg-[#212121] text-white text-xs font-bold uppercase tracking-wider hover:bg-black transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
          >
            <Navigation className="w-4 h-4" />
            <span>Log Memory With Location</span>
          </button>
        </div>
      </div>
    </div>
  );
};
