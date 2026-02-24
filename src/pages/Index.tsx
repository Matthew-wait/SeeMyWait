import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Search, Loader2, X, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { BottomNav } from "@/components/BottomNav";
import { useClinics } from "@/hooks/use-clinics";
import { getCurrentPosition, isWithinRadius, getDistanceMeters } from "@/lib/geolocation";
import { MapView, SearchArea } from "@/components/map/MapView";
import { MapLegend } from "@/components/map/MapLegend";
import { ClinicBottomSheet } from "@/components/map/ClinicBottomSheet";
import { ProximityPrompt } from "@/components/map/ProximityPrompt";
import { SearchCircleOverlay } from "@/components/map/SearchCircleOverlay";
import { ClinicWithWaitTime } from "@/hooks/use-clinics";
import { useGeocode } from "@/hooks/use-geocode";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const SEARCH_RADIUS_METERS = 5000; // 5km search radius

const Index = () => {
  const [search, setSearch] = useState("");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(true);
  const [selectedClinic, setSelectedClinic] = useState<ClinicWithWaitTime | null>(null);
  const [nearbyClinic, setNearbyClinic] = useState<ClinicWithWaitTime | null>(null);
  const [dismissedPrompts, setDismissedPrompts] = useState<Set<string>>(new Set());
  const [centerOn, setCenterOn] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [searchArea, setSearchArea] = useState<SearchArea | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const navigate = useNavigate();

  const { geocode, geocoding } = useGeocode();

  const { data: clinics, isLoading, refetch } = useClinics(
    undefined,
    userLocation?.lat,
    userLocation?.lng
  );

  // Request location on mount
  useEffect(() => {
    (async () => {
      try {
        const pos = await getCurrentPosition();
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        setCenterOn({ ...loc, zoom: 14 });
      } catch {
        toast("Location access helps find nearby clinics.", {
          description: "Enable GPS for the best experience.",
          icon: "📍",
        });
      } finally {
        setLocating(false);
      }
    })();
  }, []);

  // Detect nearby clinic for auto-prompt
  useEffect(() => {
    if (!userLocation || !clinics) return;
    const nearby = clinics.find(
      (c) =>
        isWithinRadius(userLocation.lat, userLocation.lng, c.latitude, c.longitude, 100) &&
        !dismissedPrompts.has(c.id)
    );
    setNearbyClinic(nearby || null);
  }, [userLocation, clinics, dismissedPrompts]);

  // Debounced search: first try matching clinic names in DB, then geocode
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!search.trim()) {
      setSearchArea(null);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const query = search.trim().toLowerCase();
      
      // First: check if any clinic name matches the search query
      if (clinics && clinics.length > 0) {
        const matchedClinics = clinics.filter(
          (c) =>
            c.name.toLowerCase().includes(query) ||
            (c.specialty && c.specialty.toLowerCase().includes(query)) ||
            c.address.toLowerCase().includes(query)
        );

        if (matchedClinics.length > 0) {
          // Calculate center of matched clinics
          const avgLat = matchedClinics.reduce((s, c) => s + c.latitude, 0) / matchedClinics.length;
          const avgLng = matchedClinics.reduce((s, c) => s + c.longitude, 0) / matchedClinics.length;
          
          // Calculate radius to encompass all matched clinics (min 2km)
          let maxDist = 2000;
          matchedClinics.forEach((c) => {
            const d = getDistanceMeters(avgLat, avgLng, c.latitude, c.longitude);
            if (d > maxDist) maxDist = d;
          });
          
          setSearchArea({
            lat: avgLat,
            lng: avgLng,
            radiusMeters: Math.max(maxDist * 1.5, SEARCH_RADIUS_METERS),
            name: search.trim(),
          });
          return;
        }
      }

      // Fallback: geocode the search query as a location
      const result = await geocode(search.trim());
      if (result) {
        setSearchArea({
          lat: result.lat,
          lng: result.lng,
          radiusMeters: SEARCH_RADIUS_METERS,
          name: search.trim(),
        });
      } else {
        setSearchArea(null);
      }
    }, 600);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, geocode, clinics]);

  // Clinics within search area
  const clinicsInSearchArea = useMemo(() => {
    if (!searchArea || !clinics) return [];
    return clinics.filter((c) => {
      const dist = getDistanceMeters(searchArea.lat, searchArea.lng, c.latitude, c.longitude);
      return dist <= searchArea.radiusMeters;
    });
  }, [searchArea, clinics]);

  // Filtered clinics: when searching show only those in the search circle, otherwise all
  const displayedClinics = useMemo(() => {
    if (!clinics) return [];
    if (searchArea) return clinicsInSearchArea;
    return clinics;
  }, [clinics, searchArea, clinicsInSearchArea]);

  const handleClinicClick = useCallback((clinic: ClinicWithWaitTime) => {
    setSelectedClinic(clinic);
    setCenterOn({ lat: clinic.latitude, lng: clinic.longitude, zoom: 16 });
  }, []);

  const handleEmptyClick = useCallback(() => {
    setSelectedClinic(null);
  }, []);

  const handleReported = useCallback(() => {
    setSelectedClinic(null);
    setNearbyClinic(null);
    refetch();
  }, [refetch]);

  return (
    <div className="relative flex h-screen flex-col bg-background overflow-hidden">
      {/* Search bar overlay */}
      <div className="absolute top-0 left-0 right-0 z-[50] px-3 pt-3 pb-2 pointer-events-none">
        <div className="pointer-events-auto mx-auto max-w-lg">
          <div className="relative rounded-2xl border border-border/40 bg-card/90 backdrop-blur-xl shadow-xl">
            <div className="flex items-center gap-2 px-3">
              {geocoding ? (
                <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
              ) : (
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <Input
                placeholder="Search doctor, clinic, or location…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-0 bg-transparent h-12 text-sm shadow-none focus-visible:ring-0 px-0"
              />
              {search && (
                <button onClick={() => setSearch("")} className="shrink-0 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {search.trim() && !geocoding && searchArea && (
              <div className="border-t border-border/20 px-4 py-2 flex items-center gap-1.5">
                <MapPin className="h-3 w-3 text-primary shrink-0" />
                <p className="text-[11px] text-muted-foreground truncate">
                  {clinicsInSearchArea.length} clinic{clinicsInSearchArea.length !== 1 ? "s" : ""} found near this location
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Loading overlay */}
      {(isLoading || locating) && (
        <div className="absolute inset-0 z-[45] flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="h-12 w-12 rounded-full border-[3px] border-muted animate-spin border-t-primary" />
            </div>
            <p className="text-sm text-muted-foreground animate-pulse">
              {locating ? "Finding your location…" : "Loading clinics…"}
            </p>
          </div>
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative">
        {!isLoading && (
          <MapView
            clinics={displayedClinics}
            userLocation={userLocation}
            onClinicClick={handleClinicClick}
            onEmptyClick={handleEmptyClick}
            centerOn={centerOn}
            searchArea={searchArea}
            clinicsInSearchArea={clinicsInSearchArea.length}
          />
        )}

        {/* Legend */}
        <MapLegend />

        {/* No clinics in search area overlay */}
        {searchArea && !geocoding && (
          <SearchCircleOverlay
            clinicCount={clinicsInSearchArea.length}
            searchName={searchArea.name}
            onSuggestClinic={() => navigate("/suggest")}
          />
        )}

        {/* Proximity prompt */}
        {nearbyClinic && !selectedClinic && !searchArea && (
          <ProximityPrompt
            clinic={nearbyClinic}
            onDismiss={() => {
              setDismissedPrompts((prev) => new Set(prev).add(nearbyClinic.id));
              setNearbyClinic(null);
            }}
            onReported={handleReported}
          />
        )}

        {/* Bottom sheet */}
        {selectedClinic && (
          <ClinicBottomSheet
            clinic={selectedClinic}
            onClose={() => setSelectedClinic(null)}
            onReported={handleReported}
            userLocation={userLocation}
          />
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Index;
