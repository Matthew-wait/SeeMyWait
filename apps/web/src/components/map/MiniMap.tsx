import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ExternalLink } from "lucide-react";
import { tileUrlTemplate, TILE_ATTRIBUTION, TILE_MAX_ZOOM } from "@/lib/map-tiles";
import { viewOnMapUrl } from "@/lib/medical-search";

interface MiniMapProps {
  latitude: number;
  longitude: number;
  name: string;
  /** Height in px (default 200). */
  height?: number;
}

const PIN_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 24 32">` +
  `<path fill="#2563eb" stroke="white" stroke-width="1.5" d="M12 .5C5.9.5 1 5.4 1 11.5c0 8 11 19.5 11 19.5s11-11.5 11-19.5C23 5.4 18.1.5 12 .5z"/>` +
  `<circle cx="12" cy="11.5" r="4.3" fill="white"/></svg>`;

/**
 * Small, non-interactive Leaflet map for a single location — replaces the
 * Google Maps `output=embed` iframe on the clinic detail page.
 */
export function MiniMap({ latitude, longitude, name, height = 200 }: MiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [latitude, longitude],
      zoom: 15,
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      touchZoom: false,
      keyboard: false,
    });
    map.attributionControl.setPrefix(false);

    L.tileLayer(tileUrlTemplate(), {
      attribution: TILE_ATTRIBUTION,
      maxZoom: TILE_MAX_ZOOM,
    }).addTo(map);

    L.marker([latitude, longitude], {
      icon: L.divIcon({
        html: PIN_SVG,
        className: "smw-pin",
        iconSize: [32, 42],
        iconAnchor: [16, 42],
      }),
      interactive: false,
      keyboard: false,
    }).addTo(map);

    mapRef.current = map;
    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recentre if the location prop changes (client-side route navigation).
  useEffect(() => {
    mapRef.current?.setView([latitude, longitude], 15);
  }, [latitude, longitude]);

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-border/30"
      style={{ height }}
    >
      <div ref={containerRef} className="absolute inset-0 h-full w-full bg-muted" />
      <a
        href={viewOnMapUrl(name, latitude, longitude)}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-3 right-3 z-[500] flex items-center gap-1.5 rounded-xl border border-border/30 bg-card/90 px-2.5 py-1.5 text-[11px] font-medium text-foreground shadow-lg backdrop-blur-md transition-colors hover:bg-card sm:px-3 sm:text-xs"
      >
        <ExternalLink className="h-3 w-3 text-primary" />
        Open in map
      </a>
    </div>
  );
}
