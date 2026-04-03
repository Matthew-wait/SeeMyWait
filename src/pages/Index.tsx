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
import { ClinicListPanel } from "@/components/map/ClinicListPanel";
import { FindMeButton } from "@/components/map/FindMeButton";
import { ClinicWithWaitTime } from "@/hooks/use-clinics";
import { useGeocode } from "@/hooks/use-geocode";
import { useAppSettings } from "@/hooks/use-app-settings";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const SEARCH_RADIUS_METERS = 5000;

const Index = () => {
  const [search, setSearch] = useState("");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(true);
  const [selectedClinic, setSelectedClinic] = useState<ClinicWithWaitTime | null>(null);
  const [nearbyClinic, setNearbyClinic] = useState<ClinicWithWaitTime | null>(null);
  const [dismissedPrompts, setDismissedPrompts] = useState<Set<string>>(new Set());
  const [centerOn, setCenterOn] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [searchArea, setSearchArea] = useState<SearchArea | null>(null);
  const [dbMatchedClinics, setDbMatchedClinics] = useState<ClinicWithWaitTime[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const navigate = useNavigate();

  const { geocode, geocoding } = useGeocode();
  const { data: appSettings } = useAppSettings();
  const nearbyRadiusMiles = appSettings?.nearby_radius_miles ?? 100;
  const reportCooldownMinutes = appSettings?.report_cooldown_minutes ?? 60;

  const { data: clinics, isLoading, refetch } = useClinics(
    undefined,
    userLocation?.lat,
    userLocation?.lng
  );

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

  useEffect(() => {
    if (!userLocation || !clinics) return;
    const nearby = clinics.find(
      (c) =>
        isWithinRadius(userLocation.lat, userLocation.lng, c.latitude, c.longitude, 100) &&
        !dismissedPrompts.has(c.id)
    );
    setNearbyClinic(nearby || null);
  }, [userLocation, clinics, dismissedPrompts]);

  // Search logic: DB-first, then geocode fallback
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!search.trim()) {
      setSearchArea(null);
      setDbMatchedClinics([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const query = search.trim().toLowerCase();

      // Step 1: Search DB for exact/partial matches across name, specialty, address
      if (clinics && clinics.length > 0) {
        const matched = clinics.filter(
          (c) =>
            c.name.toLowerCase().includes(query) ||
            (c.specialty && c.specialty.toLowerCase().includes(query)) ||
            c.address.toLowerCase().includes(query)
        );

        if (matched.length > 0) {
          setDbMatchedClinics(matched);

          const avgLat = matched.reduce((s, c) => s + c.latitude, 0) / matched.length;
          const avgLng = matched.reduce((s, c) => s + c.longitude, 0) / matched.length;

          // Radius to encompass all matched clinics only (don't include user if far away)
          let maxDist = 1000;
          matched.forEach((c) => {
            const d = getDistanceMeters(avgLat, avgLng, c.latitude, c.longitude);
            if (d > maxDist) maxDist = d;
          });

          // Only include user location in radius if within 100km of results
          if (userLocation) {
            const userDist = getDistanceMeters(avgLat, avgLng, userLocation.lat, userLocation.lng);
            if (userDist < 100000 && userDist > maxDist) {
              maxDist = userDist;
            }
          }

          setSearchArea({
            lat: avgLat,
            lng: avgLng,
            radiusMeters: Math.max(maxDist * 1.3, 2000),
            name: search.trim(),
          });
          return;
        }
      }

      // Step 2: No DB match — geocode as location
      setDbMatchedClinics([]);
      const result = await geocode(search.trim());
      if (result) {
        // Check if any clinics exist near this geocoded location
        const nearbyClinics = (clinics || []).filter((c) => {
          const dist = getDistanceMeters(result.lat, result.lng, c.latitude, c.longitude);
          return dist <= SEARCH_RADIUS_METERS;
        });
        setDbMatchedClinics(nearbyClinics);
        setSearchArea({
          lat: result.lat,
          lng: result.lng,
          radiusMeters: SEARCH_RADIUS_METERS,
          name: search.trim(),
        });
      } else {
        setSearchArea(null);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, geocode, clinics, userLocation]);

  // Clinics to show on map: DB matches if searching, otherwise all
  const displayedClinics = useMemo(() => {
    if (!clinics) return [];
    if (search.trim() && dbMatchedClinics.length > 0) return dbMatchedClinics;
    if (searchArea && clinics) {
      return clinics.filter((c) => {
        const dist = getDistanceMeters(searchArea.lat, searchArea.lng, c.latitude, c.longitude);
        return dist <= searchArea.radiusMeters;
      });
    }
    return clinics;
  }, [clinics, search, dbMatchedClinics, searchArea]);

  // Nearby clinics for "Explore" list — show all sorted by distance, or all if no location
  const nearbyClinics = useMemo(() => {
    if (!clinics) return [];
    if (!userLocation) return clinics;
    return [...clinics]
      .filter((c) => (c.distance || 999) <= nearbyRadiusMiles)
      .sort((a, b) => (a.distance || 999) - (b.distance || 999));
  }, [clinics, userLocation, nearbyRadiusMiles]);

  const handleFindMe = useCallback(() => {
    if (userLocation) {
      setCenterOn({ lat: userLocation.lat, lng: userLocation.lng, zoom: 14 });
    }
  }, [userLocation]);

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

  const isSearching = Boolean(search.trim());

  return (
    <div className="relative flex h-screen flex-col bg-background overflow-hidden">
      {/* Search bar overlay */}
      <div className="absolute top-0 left-0 right-0 z-[50] px-2 sm:px-3 pt-2 sm:pt-3 pb-2 pointer-events-none">
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
                  {displayedClinics.length} clinic{displayedClinics.length !== 1 ? "s" : ""} found
                  {dbMatchedClinics.length > 0 ? " matching your search" : " near this location"}
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

      {/* Map + List layout */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Map area */}
        <div className="relative flex-1 min-h-[45vh]">
          {!isLoading && (
            <MapView
              clinics={displayedClinics}
              userLocation={userLocation}
              onClinicClick={handleClinicClick}
              onEmptyClick={handleEmptyClick}
              centerOn={centerOn}
              searchArea={searchArea}
              clinicsInSearchArea={displayedClinics.length}
              nearbyRadiusMiles={nearbyRadiusMiles}
            />
          )}

          <FindMeButton onClick={handleFindMe} visible={!!userLocation} />

          <MapLegend />

          {searchArea && !geocoding && displayedClinics.length === 0 && (
            <SearchCircleOverlay
              clinicCount={0}
              searchName={searchArea.name}
              onSuggestClinic={() => navigate("/suggest")}
            />
          )}

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

          {selectedClinic && (
            <ClinicBottomSheet
              clinic={selectedClinic}
              onClose={() => setSelectedClinic(null)}
              onReported={handleReported}
              userLocation={userLocation}
              cooldownMinutes={reportCooldownMinutes}
            />
          )}
        </div>

        {/* Clinic list panel */}
        <ClinicListPanel
          clinics={displayedClinics}
          nearbyClinics={nearbyClinics}
          isSearching={isSearching}
          searchQuery={search.trim()}
          onClinicClick={handleClinicClick}
        />
      </div>

      <BottomNav />
    </div>
  );
};

export default Index;
