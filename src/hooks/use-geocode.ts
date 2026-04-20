import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GEOCODE_COUNTRY } from "@/lib/geocode-region";

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

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setGeocoding(true);
    try {
      const { data: geoData, error: geoError } = await supabase.functions.invoke("google-places", {
        body: { action: "geocode", query: query.trim() },
      });

      if (!geoError && Array.isArray(geoData?.results) && geoData.results.length > 0) {
        const first = geoData.results[0] as {
          formatted_address?: string;
          geometry?: { location?: { lat?: number; lng?: number } };
        };
        const lat = first?.geometry?.location?.lat;
        const lng = first?.geometry?.location?.lng;
        if (typeof lat === "number" && typeof lng === "number") {
          return {
            lat,
            lng,
            displayName: first.formatted_address || query.trim(),
          };
        }
      }

      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query.trim())}&limit=1&countrycodes=${GEOCODE_COUNTRY}`,
        {
          signal: controller.signal,
          headers: { "User-Agent": "seeyourwait-app/1.0" },
        }
      );
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          displayName: data[0].display_name,
        };
      }
      return null;
    } catch (e: unknown) {
      const name = e && typeof e === "object" && "name" in e ? String((e as { name?: string }).name) : "";
      if (name === "AbortError") return null;
      return null;
    } finally {
      setGeocoding(false);
    }
  }, []);

  return { geocode, geocoding };
}
