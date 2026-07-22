import { useEffect, useRef, useState, useCallback, memo } from "react";
import { ClinicWithWaitTime } from "@/hooks/use-clinics";
import { hasValidCoords } from "@/lib/geolocation";
import { WaitTimeCategory } from "@/lib/wait-time-utils";
import { loadGoogleMaps, MEDICAL_ONLY_MAP_STYLE, hasMapsJsKey } from "@/lib/google-maps";
import { MapZoomControls } from "@/components/map/MapZoomControls";
import { MapPin } from "lucide-react";

const WAIT_COLORS: Record<WaitTimeCategory, string> = {
  on_time: "#22c55e",
  "30_min": "#eab308",
  "1_hour": "#f97316",
  "1.5_hours_plus": "#ef4444",
};
/** Unsaved Google candidate awaiting verification — deliberately distinct from wait colours. */
const CANDIDATE_COLOR = "#2563eb";
const DEFAULT_CENTER = { lat: 25.7617, lng: -80.1918 };

/** Teardrop pin as an SVG data-URI, coloured per wait tier. */
function pinIcon(color: string): google.maps.Icon {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 24 32">` +
    `<path fill="${color}" stroke="white" stroke-width="1.5" d="M12 .5C5.9.5 1 5.4 1 11.5c0 8 11 19.5 11 19.5s11-11.5 11-19.5C23 5.4 18.1.5 12 .5z"/>` +
    `<circle cx="12" cy="11.5" r="4.3" fill="white"/></svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(36, 48),
    anchor: new google.maps.Point(18, 48),
  };
}

export interface CandidatePlace {
  name: string;
  latitude: number;
  longitude: number;
}

/** A medical POI the user tapped on the map (item 7a). */
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
  /** Tapping a medical POI (has a place id). */
  onPoiClick?: (poi: PoiTap) => void;
  /** Tapping an empty (non-POI) map point. */
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
  onPoiClick,
  onMapPointClick,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const clinicMarkersRef = useRef<google.maps.Marker[]>([]);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const userCircleRef = useRef<google.maps.Circle | null>(null);
  const candidateMarkerRef = useRef<google.maps.Marker | null>(null);
  const prevClinicKeyRef = useRef("");

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  // Keep the latest callbacks reachable from stable map listeners.
  const onClinicClickRef = useRef(onClinicClick);
  const onEmptyClickRef = useRef(onEmptyClick);
  const onPoiClickRef = useRef(onPoiClick);
  const onMapPointClickRef = useRef(onMapPointClick);
  onClinicClickRef.current = onClinicClick;
  onEmptyClickRef.current = onEmptyClick;
  onPoiClickRef.current = onPoiClick;
  onMapPointClickRef.current = onMapPointClick;

  // Initialise the map once, after the API loads.
  useEffect(() => {
    let cancelled = false;
    if (!hasMapsJsKey) {
      setStatus("error");
      return;
    }

    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !containerRef.current || mapRef.current) return;

        const map = new google.maps.Map(containerRef.current, {
          center: userLocation ?? DEFAULT_CENTER,
          zoom: userLocation ? 14 : 12,
          styles: MEDICAL_ONLY_MAP_STYLE,
          gestureHandling: "greedy", // pinch/scroll zoom without a modifier key
          clickableIcons: true, // required so POI taps fire
          disableDefaultUI: true,
          zoomControl: false,
        });

        map.addListener("click", (e: google.maps.MapMouseEvent) => {
          const iconEvent = e as google.maps.IconMouseEvent;
          if (iconEvent.placeId) {
            // A medical POI — suppress the default info window and hand it up.
            iconEvent.stop();
            if (e.latLng) {
              onPoiClickRef.current?.({
                placeId: iconEvent.placeId,
                lat: e.latLng.lat(),
                lng: e.latLng.lng(),
              });
            }
            return;
          }
          if (e.latLng && onMapPointClickRef.current) {
            onMapPointClickRef.current({ lat: e.latLng.lat(), lng: e.latLng.lng() });
          } else {
            onEmptyClickRef.current();
          }
        });

        mapRef.current = map;
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clinic markers — rebuilt only when the set or their wait colours change.
  useEffect(() => {
    if (status !== "ready" || !mapRef.current) return;
    const map = mapRef.current;

    const key = clinics
      .map((c) => `${c.id}:${c.waitTime?.category || "on_time"}`)
      .sort()
      .join(",");
    if (key === prevClinicKeyRef.current) return;
    prevClinicKeyRef.current = key;

    clinicMarkersRef.current.forEach((m) => m.setMap(null));
    clinicMarkersRef.current = [];

    clinics.forEach((clinic) => {
      if (!hasValidCoords(clinic.latitude, clinic.longitude)) return;
      const color = WAIT_COLORS[clinic.waitTime?.category ?? "on_time"];
      const marker = new google.maps.Marker({
        position: { lat: clinic.latitude, lng: clinic.longitude },
        map,
        icon: pinIcon(color),
        title: clinic.name,
      });
      marker.addListener("click", () => onClinicClickRef.current(clinic));
      clinicMarkersRef.current.push(marker);
    });
  }, [clinics, status]);

  // User location dot + nearby-radius circle.
  useEffect(() => {
    if (status !== "ready" || !mapRef.current) return;
    const map = mapRef.current;

    userMarkerRef.current?.setMap(null);
    userCircleRef.current?.setMap(null);
    userMarkerRef.current = null;
    userCircleRef.current = null;

    if (!userLocation || !hasValidCoords(userLocation.lat, userLocation.lng)) return;

    userCircleRef.current = new google.maps.Circle({
      map,
      center: userLocation,
      radius: nearbyRadiusMiles * 1609.34,
      strokeColor: "#0284c7",
      strokeOpacity: 0.25,
      strokeWeight: 1.5,
      fillColor: "#0284c7",
      fillOpacity: 0.04,
      clickable: false,
    });
    userMarkerRef.current = new google.maps.Marker({
      map,
      position: userLocation,
      clickable: false,
      zIndex: 5,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 7,
        fillColor: "#0284c7",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 3,
      },
    });
  }, [userLocation, nearbyRadiusMiles, status]);

  // Candidate pin (verify-before-save) — distinct blue, above everything.
  useEffect(() => {
    if (status !== "ready" || !mapRef.current) return;
    const map = mapRef.current;

    candidateMarkerRef.current?.setMap(null);
    candidateMarkerRef.current = null;

    if (!candidate || !hasValidCoords(candidate.latitude, candidate.longitude)) return;

    candidateMarkerRef.current = new google.maps.Marker({
      map,
      position: { lat: candidate.latitude, lng: candidate.longitude },
      icon: pinIcon(CANDIDATE_COLOR),
      title: candidate.name,
      zIndex: 1000,
    });
    map.setCenter({ lat: candidate.latitude, lng: candidate.longitude });
    map.setZoom(16);
  }, [candidate, status]);

  // Imperative recenter requests.
  useEffect(() => {
    if (status !== "ready" || !mapRef.current || !centerOn) return;
    if (!hasValidCoords(centerOn.lat, centerOn.lng)) return;
    mapRef.current.setCenter({ lat: centerOn.lat, lng: centerOn.lng });
    if (centerOn.zoom) mapRef.current.setZoom(centerOn.zoom);
  }, [centerOn, status]);

  const handleZoomIn = useCallback(() => {
    const map = mapRef.current;
    if (map) map.setZoom((map.getZoom() ?? 12) + 1);
  }, []);
  const handleZoomOut = useCallback(() => {
    const map = mapRef.current;
    if (map) map.setZoom((map.getZoom() ?? 12) - 1);
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
              A Google Maps browser key is required. Set{" "}
              <code className="rounded bg-background px-1">VITE_GOOGLE_MAPS_JS_API_KEY</code> (HTTP-referrer
              restricted) and reload.
            </p>
          </div>
        </div>
      )}

      {status === "ready" && <MapZoomControls onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} />}
    </div>
  );
}

export const MapView = memo(MapViewInner);
