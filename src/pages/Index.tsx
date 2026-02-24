import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Loader2, X, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { BottomNav } from "@/components/BottomNav";
import { useClinics } from "@/hooks/use-clinics";
import { getCurrentPosition, isWithinRadius } from "@/lib/geolocation";
import { MapView } from "@/components/map/MapView";
import { MapLegend } from "@/components/map/MapLegend";
import { ClinicBottomSheet } from "@/components/map/ClinicBottomSheet";
import { ProximityPrompt } from "@/components/map/ProximityPrompt";
import { ClinicWithWaitTime } from "@/hooks/use-clinics";
import { toast } from "sonner";

const Index = () => {
  const [search, setSearch] = useState("");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(true);
  const [selectedClinic, setSelectedClinic] = useState<ClinicWithWaitTime | null>(null);
  const [nearbyClinic, setNearbyClinic] = useState<ClinicWithWaitTime | null>(null);
  const [dismissedPrompts, setDismissedPrompts] = useState<Set<string>>(new Set());
  const [centerOn, setCenterOn] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);

  const { data: clinics, isLoading, refetch } = useClinics(
    undefined, // Load all clinics for map
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

  // Filtered clinics for search
  const filteredClinics = useMemo(() => {
    if (!clinics) return [];
    if (!search.trim()) return clinics;
    const q = search.toLowerCase().trim();
    return clinics.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        (c.specialty && c.specialty.toLowerCase().includes(q))
    );
  }, [clinics, search]);

  // When search changes, zoom to first match
  useEffect(() => {
    if (search.trim() && filteredClinics.length > 0) {
      const first = filteredClinics[0];
      setCenterOn({ lat: first.latitude, lng: first.longitude, zoom: 15 });
    }
  }, [search, filteredClinics]);

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
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="Search doctor, clinic, or area…"
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
            {search.trim() && (
              <div className="border-t border-border/20 px-4 py-2">
                <p className="text-[11px] text-muted-foreground">
                  {filteredClinics.length} result{filteredClinics.length !== 1 ? "s" : ""} found
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
            clinics={filteredClinics}
            userLocation={userLocation}
            onClinicClick={handleClinicClick}
            onEmptyClick={handleEmptyClick}
            centerOn={centerOn}
          />
        )}

        {/* Legend */}
        <MapLegend />

        {/* Proximity prompt */}
        {nearbyClinic && !selectedClinic && (
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
