import { useEffect, useRef, useState, useCallback, memo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ClinicWithWaitTime } from "@/hooks/use-clinics";
import { hasValidCoords } from "@/lib/geolocation";
import { WaitTimeCategory } from "@/lib/wait-time-utils";
import { tileUrlTemplate, TILE_ATTRIBUTION, TILE_MAX_ZOOM } from "@/lib/map-tiles";
import { MapZoomControls } from "@/components/map/MapZoomControls";
import { MapPin } from "lucide-react";
import { ClinicPinLayer } from "@/lib/clinic-pin-layer";

const WAIT_COLORS: Record<WaitTimeCategory, string> = {
  on_time: "#22c55e",
  "30_min": "#eab308",
  "1_hour": "#f97316",
  "1.5_hours_plus": "#ef4444",
};
/** Unsaved candidate awaiting verification — deliberately distinct from wait colours. */
const CANDIDATE_COLOR = "#2563eb";
const DEFAULT_CENTER: L.LatLngTuple = [25.7617, -80.1918];

/** One-time CSS: strip Leaflet's default divIcon chrome + style the coord popup
 *  and attribution to match the app surface. Injected once per document. */
function ensureMapStyle(): void {
  if (typeof document === "undefined" || document.getElementById("smw-map-style")) return;
  const style = document.createElement("style");
  style.id = "smw-map-style";
  style.textContent = `
    .leaflet-container { background: #e8eaed; font: inherit; }
    .leaflet-div-icon.smw-pin { background: transparent; border: 0; }
    .smw-pin svg { display: block; filter: drop-shadow(0 2px 4px rgba(15,23,42,0.28)); }
    .smw-coord-popup .leaflet-popup-content-wrapper {
      border-radius: 14px;
      box-shadow: 0 8px 24px rgba(15,23,42,0.18);
    }
    .smw-coord-popup .leaflet-popup-content { margin: 0; }
    .smw-coord-popup .leaflet-popup-tip { box-shadow: 0 8px 24px rgba(15,23,42,0.18); }
    /* Attribution stays visible (OSM tile policy) but understated. */
    .leaflet-control-attribution {
      background: rgba(255,255,255,0.78) !important;
      backdrop-filter: blur(4px);
      border-radius: 8px 0 0 0;
      font-size: 10px;
      padding: 1px 6px;
    }
  `;
  document.head.appendChild(style);
}

function pinSvg(color: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 24 32">` +
    `<path fill="${color}" stroke="white" stroke-width="1.5" d="M12 .5C5.9.5 1 5.4 1 11.5c0 8 11 19.5 11 19.5s11-11.5 11-19.5C23 5.4 18.1.5 12 .5z"/>` +
    `<circle cx="12" cy="11.5" r="4.3" fill="white"/></svg>`
  );
}

function pinIcon(color: string): L.DivIcon {
  return L.divIcon({
    html: pinSvg(color),
    className: "smw-pin",
    iconSize: [36, 48],
    iconAnchor: [18, 48],
    popupAnchor: [0, -44],
  });
}

/** Sleek coordinate card shown in the pending-point popup (matches the old InfoWindow). */
function coordPopupHtml(lat: number, lng: number): string {
  const coords = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  return (
    `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;padding:9px 13px;line-height:1.2;white-space:nowrap;">` +
    `<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">` +
    `<span style="width:7px;height:7px;border-radius:50%;background:${CANDIDATE_COLOR};box-shadow:0 0 0 3px rgba(37,99,235,0.18);"></span>` +
    `<span style="font-size:9.5px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;">Selected location</span>` +
    `</div>` +
    `<div style="font-size:13px;font-weight:600;color:#0f172a;font-variant-numeric:tabular-nums;letter-spacing:-0.01em;">${coords}</div>` +
    `</div>`
  );
}

export interface CandidatePlace {
  name: string;
  latitude: number;
  longitude: number;
}

/**
 * A medical POI the user tapped on the map. Retained for API compatibility with
 * callers written for the Google Maps version — raster OSM tiles have no
 * clickable POI objects, so `onPoiClick` never fires on web.
 */
export interface PoiTap {
  placeId: string;
  lat: number;
  lng: number;
}

interface MapViewProps {
  clinics: ClinicWithWaitTime[];
  userLocation: { lat: number; lng: number } | null;
  onClinicClick: (clinic: ClinicWithWaitTime) => void;
  onEmptyClick: () => void;
  centerOn?: { lat: number; lng: number; zoom?: number } | null;
  nearbyRadiusMiles?: number;
  candidate?: CandidatePlace | null;
  /** A saved search result selected by the user. Always gets its own pin. */
  focusedPlace?: CandidatePlace | null;
  /** A tapped empty point awaiting "Add here" — drops a pin + coordinate popup. */
  pendingPoint?: { lat: number; lng: number } | null;
  /** Inert on web (kept so callers don't need to change); see {@link PoiTap}. */
  onPoiClick?: (poi: PoiTap) => void;
  /** Tapping an empty map point. */
  onMapPointClick?: (point: { lat: number; lng: number }) => void;
}

function MapViewInner({
  clinics,
  userLocation,
  onClinicClick,
  onEmptyClick,
  centerOn,
  nearbyRadiusMiles = 100,
  candidate = null,
  focusedPlace = null,
  pendingPoint = null,
  onMapPointClick,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clinicLayerRef = useRef<ClinicPinLayer | null>(null);
  const clinicsByIdRef = useRef(new Map<string, ClinicWithWaitTime>());
  const userLayerRef = useRef<L.LayerGroup | null>(null);
  const candidateMarkerRef = useRef<L.Marker | null>(null);
  const focusedMarkerRef = useRef<L.Marker | null>(null);
  const pendingMarkerRef = useRef<L.Marker | null>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  // Keep the latest callbacks reachable from stable map listeners.
  const onClinicClickRef = useRef(onClinicClick);
  const onEmptyClickRef = useRef(onEmptyClick);
  const onMapPointClickRef = useRef(onMapPointClick);
  onClinicClickRef.current = onClinicClick;
  onEmptyClickRef.current = onEmptyClick;
  onMapPointClickRef.current = onMapPointClick;

  // Initialise the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    ensureMapStyle();

    let resizeObserver: ResizeObserver | undefined;
    try {
      const map = L.map(containerRef.current, {
        center: userLocation ? [userLocation.lat, userLocation.lng] : DEFAULT_CENTER,
        zoom: userLocation ? 14 : 12,
        zoomControl: false, // we render a custom MapZoomControls cluster
      });
      map.attributionControl.setPrefix(false); // drop the "Leaflet" flag, keep the tile credit

      L.tileLayer(tileUrlTemplate(), {
        attribution: TILE_ATTRIBUTION,
        maxZoom: TILE_MAX_ZOOM,
      }).addTo(map);

      map.on("click", (e: L.LeafletMouseEvent) => {
        const pin = clinicLayerRef.current?.pick(e.containerPoint);
        const clinic = pin && clinicsByIdRef.current.get(pin.id);
        if (clinic) { onClinicClickRef.current(clinic); return; }
        if (onMapPointClickRef.current) {
          onMapPointClickRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
        } else {
          onEmptyClickRef.current();
        }
      });

      clinicLayerRef.current = new ClinicPinLayer().addTo(map);
      userLayerRef.current = L.layerGroup().addTo(map);

      mapRef.current = map;
      resizeObserver = new ResizeObserver(() => {
        if (mapRef.current === map) map.invalidateSize();
      });
      resizeObserver.observe(containerRef.current);
      setStatus("ready");
      // The container may still be settling into its flex height on first paint.
      requestAnimationFrame(() => {
        if (mapRef.current === map) map.invalidateSize();
      });
    } catch {
      setStatus("error");
    }

    return () => {
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      clinicLayerRef.current = null;
      userLayerRef.current = null;
      candidateMarkerRef.current = null;
      focusedMarkerRef.current = null;
      pendingMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draw all loaded clinics with the existing artwork on a canvas layer.
  useEffect(() => {
    if (status !== "ready" || !clinicLayerRef.current) return;

    clinicsByIdRef.current = new Map(clinics.map(c => [c.id,c]));
    clinicLayerRef.current.setPins(clinics.filter(c => hasValidCoords(c.latitude,c.longitude))
      .map(c => ({id:c.id,name:c.name,latitude:c.latitude,longitude:c.longitude,
        color:WAIT_COLORS[c.waitTime?.category ?? "on_time"]})));
  }, [clinics, status]);

  // Geolocation usually resolves after the map has mounted on its Miami
  // default, so centre on the user the first time a valid location arrives.
  const initialLocationCenteredRef = useRef(false);
  useEffect(() => {
    if (status !== "ready" || !mapRef.current || initialLocationCenteredRef.current) return;
    if (!userLocation || !hasValidCoords(userLocation.lat, userLocation.lng)) return;
    initialLocationCenteredRef.current = true;
    mapRef.current.setView([userLocation.lat, userLocation.lng], 14);
  }, [userLocation, status]);

  // User location dot + nearby-radius circle.
  useEffect(() => {
    if (status !== "ready" || !userLayerRef.current) return;
    const layer = userLayerRef.current;
    layer.clearLayers();

    if (!userLocation || !hasValidCoords(userLocation.lat, userLocation.lng)) return;
    const center: L.LatLngTuple = [userLocation.lat, userLocation.lng];

    L.circle(center, {
      radius: nearbyRadiusMiles * 1609.34,
      color: "#0284c7",
      opacity: 0.25,
      weight: 1.5,
      fillColor: "#0284c7",
      fillOpacity: 0.04,
      interactive: false,
    }).addTo(layer);

    L.circleMarker(center, {
      radius: 7,
      fillColor: "#0284c7",
      fillOpacity: 1,
      color: "#ffffff",
      weight: 3,
      interactive: false,
    }).addTo(layer);
  }, [userLocation, nearbyRadiusMiles, status]);

  // Candidate pin (verify-before-save) — distinct blue, recenters onto it.
  useEffect(() => {
    if (status !== "ready" || !mapRef.current) return;
    const map = mapRef.current;

    candidateMarkerRef.current?.remove();
    candidateMarkerRef.current = null;

    if (!candidate || !hasValidCoords(candidate.latitude, candidate.longitude)) return;

    candidateMarkerRef.current = L.marker([candidate.latitude, candidate.longitude], {
      icon: pinIcon(CANDIDATE_COLOR),
      title: candidate.name,
      zIndexOffset: 1000,
      keyboard: false,
    }).addTo(map);
    map.setView([candidate.latitude, candidate.longitude], 16);
  }, [candidate, status]);

  // Pin for a tapped custom point, with its coordinates in a popup (like
  // dropping a pin on Google Maps). Does not recenter — the user tapped where
  // they can already see.
  useEffect(() => {
    if (status !== "ready" || !mapRef.current) return;
    const map = mapRef.current;

    pendingMarkerRef.current?.remove();
    pendingMarkerRef.current = null;

    if (!pendingPoint || !hasValidCoords(pendingPoint.lat, pendingPoint.lng)) return;

    const marker = L.marker([pendingPoint.lat, pendingPoint.lng], {
      icon: pinIcon(CANDIDATE_COLOR),
      title: `${pendingPoint.lat.toFixed(6)}, ${pendingPoint.lng.toFixed(6)}`,
      zIndexOffset: 1100,
      keyboard: false,
    }).addTo(map);

    marker
      .bindPopup(coordPopupHtml(pendingPoint.lat, pendingPoint.lng), {
        closeButton: false,
        autoClose: false,
        closeOnClick: false,
        autoPan: false,
        className: "smw-coord-popup",
        offset: [0, -8],
      })
      .openPopup();

    pendingMarkerRef.current = marker;
  }, [pendingPoint, status]);

  // Imperative recenter requests.
  useEffect(() => {
    if (status !== "ready" || !mapRef.current || !centerOn) return;
    if (!hasValidCoords(centerOn.lat, centerOn.lng)) return;
    mapRef.current.setView(
      [centerOn.lat, centerOn.lng],
      centerOn.zoom ?? mapRef.current.getZoom()
    );
  }, [centerOn, status]);

  // A selected saved result owns an explicit pin instead of depending on the
  // separately fetched clinic snapshot. Offset it upward so the details sheet
  // cannot cover the location the user just selected.
  useEffect(() => {
    if (status !== "ready" || !mapRef.current) return;
    const map = mapRef.current;

    focusedMarkerRef.current?.remove();
    focusedMarkerRef.current = null;

    if (!focusedPlace || !hasValidCoords(focusedPlace.latitude, focusedPlace.longitude)) return;

    focusedMarkerRef.current = L.marker([focusedPlace.latitude, focusedPlace.longitude], {
      icon: pinIcon(CANDIDATE_COLOR),
      title: focusedPlace.name,
      zIndexOffset: 1200,
      keyboard: false,
    }).addTo(map);

    map.setView([focusedPlace.latitude, focusedPlace.longitude], 16);
    requestAnimationFrame(() => {
      if (!mapRef.current) return;
      mapRef.current.panBy([0, Math.min(120, mapRef.current.getSize().y * 0.28)], {
        animate: false,
      });
    });
  }, [focusedPlace, status]);

  const handleZoomIn = useCallback(() => {
    mapRef.current?.zoomIn();
  }, []);
  const handleZoomOut = useCallback(() => {
    mapRef.current?.zoomOut();
  }, []);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full bg-muted" />

      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/95 p-6 text-center">
          <div className="max-w-xs space-y-2">
            <MapPin className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Map unavailable</p>
            <p className="text-xs text-muted-foreground">
              The map failed to load. Check your connection and reload.
            </p>
          </div>
        </div>
      )}

      {status === "ready" && <MapZoomControls onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} />}
    </div>
  );
}

export const MapView = memo(MapViewInner);
