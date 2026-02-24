import { useState, useCallback, useRef } from "react";

export interface GeocodedLocation {
  lat: number;
  lng: number;
  displayName: string;
}

export function useGeocode() {
  const [geocoding, setGeocoding] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const geocode = useCallback(async (query: string): Promise<GeocodedLocation | null> => {
    if (!query.trim()) return null;

    // Abort previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
        { signal: controller.signal }
      );
      const data = await res.json();
      if (data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          displayName: data[0].display_name,
        };
      }
      return null;
    } catch (e: any) {
      if (e.name === "AbortError") return null;
      return null;
    } finally {
      setGeocoding(false);
    }
  }, []);

  return { geocode, geocoding };
}
