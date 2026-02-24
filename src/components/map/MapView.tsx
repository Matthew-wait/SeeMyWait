import { useEffect, useRef, useCallback, memo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ClinicWithWaitTime } from "@/hooks/use-clinics";
import { WaitTimeCategory } from "@/lib/wait-time-utils";

const WAIT_COLORS: Record<WaitTimeCategory, string> = {
  on_time: "#22c55e",
  "30_min": "#eab308",
  "1_hour": "#f97316",
  "1.5_hours_plus": "#ef4444",
};
const NEUTRAL_COLOR = "#94a3b8";

function createPinHtml(color: string): string {
  return `
    <div style="position:relative;width:36px;height:36px;animation:pinDrop 0.4s ease-out;">
      <div style="width:36px;height:36px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
        <svg style="transform:rotate(45deg);width:16px;height:16px;fill:white;" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
      </div>
    </div>
  `;
}

const PIN_STYLES = `
  @keyframes pinDrop {
    0% { transform: translateY(-20px) scale(0.8); opacity: 0; }
    60% { transform: translateY(2px) scale(1.05); }
    100% { transform: translateY(0) scale(1); opacity: 1; }
  }
  @keyframes userPulse {
    0%, 100% { transform: scale(1); opacity: 0.3; }
    50% { transform: scale(2.5); opacity: 0; }
  }
  @keyframes searchPulse {
    0%, 100% { opacity: 0.15; }
    50% { opacity: 0.25; }
  }
  .leaflet-container { background: #f2f2f2 !important; z-index: 0 !important; }
  .leaflet-pane { z-index: 0 !important; }
  .leaflet-top, .leaflet-bottom { z-index: 10 !important; }
  .leaflet-control-attribution { display: none !important; }
  .leaflet-control-zoom {
    border: none !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
    border-radius: 12px !important;
    overflow: hidden !important;
    margin-top: 70px !important;
  }
  .leaflet-control-zoom a {
    background: hsl(210 40% 98%) !important;
    color: hsl(222 47% 11%) !important;
    border: none !important;
    width: 36px !important;
    height: 36px !important;
    line-height: 36px !important;
    font-size: 18px !important;
  }
  .dark .leaflet-control-zoom a {
    background: hsl(217 32% 17%) !important;
    color: hsl(210 40% 98%) !important;
  }
  .search-count-tooltip {
    background: hsl(222 47% 11% / 0.9) !important;
    border: 1px solid hsl(200 98% 39% / 0.4) !important;
    border-radius: 12px !important;
    padding: 6px 12px !important;
    color: white !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
    white-space: nowrap !important;
  }
  .search-count-tooltip::before { display: none !important; }
  .leaflet-tooltip-top.search-count-tooltip::before { display: none !important; }
`;

export interface SearchArea {
  lat: number;
  lng: number;
  radiusMeters: number;
  name: string;
}

interface MapViewProps {
  clinics: ClinicWithWaitTime[];
  userLocation: { lat: number; lng: number } | null;
  onClinicClick: (clinic: ClinicWithWaitTime) => void;
  onEmptyClick: () => void;
  centerOn?: { lat: number; lng: number; zoom?: number } | null;
  searchArea?: SearchArea | null;
  clinicsInSearchArea?: number;
}

function MapViewInner({ clinics, userLocation, onClinicClick, onEmptyClick, centerOn, searchArea, clinicsInSearchArea = 0 }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.LayerGroup | null>(null);
  const searchLayerRef = useRef<L.LayerGroup | null>(null);
  const onEmptyClickRef = useRef(onEmptyClick);
  const markerClickedRef = useRef(false);
  const onClinicClickRef = useRef(onClinicClick);
  onEmptyClickRef.current = onEmptyClick;
  onClinicClickRef.current = onClinicClick;

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const defaultCenter: [number, number] = userLocation
      ? [userLocation.lat, userLocation.lng]
      : [25.7617, -80.1918];
    const defaultZoom = userLocation ? 14 : 12;

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: defaultZoom,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    markersRef.current = L.layerGroup().addTo(map);
    userMarkerRef.current = L.layerGroup().addTo(map);
    searchLayerRef.current = L.layerGroup().addTo(map);

    map.on("click", () => {
      setTimeout(() => {
        if (!markerClickedRef.current) {
          onEmptyClickRef.current();
        }
        markerClickedRef.current = false;
      }, 50);
    });

    // Observe container resizes to fix tile gaps
    const ro = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    ro.observe(mapContainerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update user location marker
  useEffect(() => {
    if (!mapRef.current || !userMarkerRef.current) return;
    userMarkerRef.current.clearLayers();

    if (userLocation) {
      L.circle([userLocation.lat, userLocation.lng], {
        radius: 200,
        color: "hsl(200 98% 39%)",
        fillColor: "hsl(200 98% 39%)",
        fillOpacity: 0.08,
        weight: 1.5,
        opacity: 0.3,
      }).addTo(userMarkerRef.current);

      const userIcon = L.divIcon({
        className: "user-location-pin",
        html: `
          <div style="position:relative;width:20px;height:20px;">
            <div style="position:absolute;inset:0;border-radius:50%;background:hsl(200 98% 39%);opacity:0.3;animation:userPulse 2s ease-in-out infinite;"></div>
            <div style="position:absolute;inset:3px;border-radius:50%;background:hsl(200 98% 39%);border:3px solid white;box-shadow:0 0 8px hsl(200 98% 39%/0.5);"></div>
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      L.marker([userLocation.lat, userLocation.lng], { icon: userIcon, interactive: false }).addTo(userMarkerRef.current);
    }
  }, [userLocation]);

  // Update search area overlay
  useEffect(() => {
    if (!mapRef.current || !searchLayerRef.current) return;
    searchLayerRef.current.clearLayers();

    if (!searchArea) return;

    // Search area circle
    const circle = L.circle([searchArea.lat, searchArea.lng], {
      radius: searchArea.radiusMeters,
      color: "hsl(200 98% 39%)",
      fillColor: "hsl(200 98% 39%)",
      fillOpacity: 0.08,
      weight: 2,
      opacity: 0.5,
      dashArray: "8 6",
      className: "search-area-circle",
    });
    circle.addTo(searchLayerRef.current);

    // Tooltip with count on hover
    const countLabel = clinicsInSearchArea === 0
      ? "No clinics found"
      : `${clinicsInSearchArea} clinic${clinicsInSearchArea !== 1 ? "s" : ""} in this area`;
    circle.bindTooltip(countLabel, {
      permanent: false,
      direction: "top",
      className: "search-count-tooltip",
    });

    // Search destination marker
    const searchIcon = L.divIcon({
      className: "search-destination-pin",
      html: `
        <div style="position:relative;width:28px;height:28px;">
          <div style="position:absolute;inset:0;border-radius:50%;background:hsl(200 98% 39%);opacity:0.2;animation:searchPulse 2s ease-in-out infinite;"></div>
          <div style="position:absolute;inset:4px;border-radius:50%;background:hsl(200 98% 39%);border:3px solid white;box-shadow:0 2px 10px hsl(200 98% 39%/0.5);"></div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    L.marker([searchArea.lat, searchArea.lng], { icon: searchIcon, interactive: false }).addTo(searchLayerRef.current);

    // Dashed line from user to search area (only if within 100km)
    if (userLocation) {
      const distToSearch = L.latLng(userLocation.lat, userLocation.lng)
        .distanceTo(L.latLng(searchArea.lat, searchArea.lng));
      
      if (distToSearch < 100000) {
        L.polyline(
          [[userLocation.lat, userLocation.lng], [searchArea.lat, searchArea.lng]],
          { color: "hsl(200 98% 39%)", weight: 2, opacity: 0.35, dashArray: "6 8" }
        ).addTo(searchLayerRef.current);
      }
    }

    // Invalidate size first so Leaflet recalculates container dimensions
    mapRef.current.invalidateSize({ animate: false });

    // Fit bounds: instant setView for performance
    if (userLocation) {
      const distToSearch = L.latLng(userLocation.lat, userLocation.lng)
        .distanceTo(L.latLng(searchArea.lat, searchArea.lng));
      
      if (distToSearch < 100000) {
        const bounds = L.latLngBounds(
          [userLocation.lat, userLocation.lng],
          [searchArea.lat, searchArea.lng]
        ).pad(0.3);
        mapRef.current.fitBounds(bounds, { maxZoom: 14, animate: false });
      } else {
        mapRef.current.setView([searchArea.lat, searchArea.lng], 13, { animate: false });
      }
    } else {
      mapRef.current.setView([searchArea.lat, searchArea.lng], 13, { animate: false });
    }

    // Force tile reload after repositioning
    setTimeout(() => {
      mapRef.current?.invalidateSize({ animate: false });
    }, 200);
  }, [searchArea, clinicsInSearchArea, userLocation]);

  // Track previous clinic IDs to avoid unnecessary marker rebuilds
  const prevClinicIdsRef = useRef<string>("");

  // Update clinic markers — only when the set of clinics actually changes
  useEffect(() => {
    if (!mapRef.current || !markersRef.current) return;

    const newIds = clinics.map((c) => c.id).sort().join(",");
    // Also include wait time categories so pins update color on new reports
    const newKey = clinics.map((c) => `${c.id}:${c.waitTime?.category || "none"}`).sort().join(",");
    if (newKey === prevClinicIdsRef.current) return;
    prevClinicIdsRef.current = newKey;

    markersRef.current.clearLayers();

    clinics.forEach((clinic) => {
      const color = clinic.waitTime ? WAIT_COLORS[clinic.waitTime.category] : NEUTRAL_COLOR;

      const icon = L.divIcon({
        className: "custom-pin",
        html: createPinHtml(color),
        iconSize: [36, 36],
        iconAnchor: [18, 36],
      });

      const marker = L.marker([clinic.latitude, clinic.longitude], { icon });
      marker.on("click", () => {
        markerClickedRef.current = true;
        onClinicClickRef.current(clinic);
      });
      marker.addTo(markersRef.current!);

      if (clinic.waitTime) {
        L.circle([clinic.latitude, clinic.longitude], {
          radius: 100,
          color: WAIT_COLORS[clinic.waitTime.category],
          fillColor: WAIT_COLORS[clinic.waitTime.category],
          fillOpacity: 0.06,
          weight: 1,
          opacity: 0.2,
          dashArray: "4 6",
        }).addTo(markersRef.current!);
      }
    });
  }, [clinics]);

  // Center on changes (only when no search area — search area handles its own centering)
  useEffect(() => {
    if (!mapRef.current || !centerOn || searchArea) return;
    mapRef.current.invalidateSize({ animate: false });
    mapRef.current.setView([centerOn.lat, centerOn.lng], centerOn.zoom || mapRef.current.getZoom(), { animate: false });
  }, [centerOn, searchArea]);

  return (
    <div className="absolute inset-0">
      <style>{PIN_STYLES}</style>
      <div ref={mapContainerRef} className="h-full w-full" />
    </div>
  );
}

export const MapView = memo(MapViewInner);
