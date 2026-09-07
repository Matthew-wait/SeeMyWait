import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Search, Loader2, X, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { BottomNav } from "@/components/BottomNav";
import { useClinics } from "@/hooks/use-clinics";
import { getCurrentPosition } from "@/lib/geolocation";
import { MapView } from "@/components/map/MapView";
import { MapLegend } from "@/components/map/MapLegend";
import { ClinicBottomSheet } from "@/components/map/ClinicBottomSheet";
import { ClinicListPanel } from "@/components/map/ClinicListPanel";
import { FindMeButton } from "@/components/map/FindMeButton";
import { SearchResultsDropdown } from "@/components/map/SearchResultsDropdown";
import { VerifyPlaceCard } from "@/components/map/VerifyPlaceCard";
import { ClinicWithWaitTime } from "@/hooks/use-clinics";
import { useMedicalSearch } from "@/hooks/use-medical-search";
import { useAppSettings } from "@/hooks/use-app-settings";
import {
  AddedClinic,
  NpiSearchResult,
  MedicalSearchResult,
} from "@/lib/medical-search";
import { reverseGeocode } from "@/lib/google-places-client";
import { AddDoctorPrefill } from "@/lib/add-doctor-prefill";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const Index = () => {
  const [search, setSearch] = useState("");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(true);
  const [centerOn, setCenterOn] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [selectedClinic, setSelectedClinic] = useState<ClinicWithWaitTime | null>(null);
  /** NPPES result awaiting explicit verification — pinned on the map, not saved. */
  const [candidate, setCandidate] = useState<NpiSearchResult | null>(null);
  /** Clinic ids returned by the current search, in server order. */
  const [matchedClinicIds, setMatchedClinicIds] = useState<string[]>([]);
  /** Whether the results dropdown is expanded (click-outside collapses it). */
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  /** Empty map point the user tapped, awaiting an "Add here" confirmation. */
  const [pendingPoint, setPendingPoint] = useState<{ lat: number; lng: number } | null>(null);
  const navigate = useNavigate();

  const { data: appSettings } = useAppSettings();
  const nearbyRadiusMiles = appSettings?.nearby_radius_miles ?? 100;
  const reportCooldownMinutes = appSettings?.report_cooldown_minutes ?? 60;

  const { data: clinics, isLoading, refetch } = useClinics(
    undefined,
    userLocation?.lat,
    userLocation?.lng,
    reportCooldownMinutes
  );

  // Single search path: the `medical-search` edge function does DB-first
  // matching and only reaches for Google when local results are thin. No
  // client-side geocoding runs alongside it.
  const searchState = useMedicalSearch(
    search,
    userLocation ? { latitude: userLocation.lat, longitude: userLocation.lng } : null
  );

  useEffect(() => {
    (async () => {
      try {
        const pos = await getCurrentPosition();
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        setCenterOn({ ...loc, zoom: 14 });
      } catch {
        toast("Location access helps find nearby doctor offices.", {
          description: "Enable GPS for the best experience.",
          icon: "📍",
        });
      } finally {
        setLocating(false);
      }
    })();
  }, []);

  // Mirror the search's DB hits onto the map.
  useEffect(() => {
    if (!searchState.searched) {
      setMatchedClinicIds([]);
      return;
    }
    const ids = searchState.results
      .filter((r): r is Extract<MedicalSearchResult, { source: "db" }> => r.source === "db")
      .map((r) => r.id);
    setMatchedClinicIds(ids);
  }, [searchState.results, searchState.searched]);

  // Clinics visible to user based on admin nearby radius setting
  const clinicsWithinNearbyRadius = useMemo(() => {
    if (!clinics) return [];
    if (!userLocation) return clinics;
    return clinics.filter((c) => (c.distance || 999) <= nearbyRadiusMiles);
  }, [clinics, userLocation, nearbyRadiusMiles]);

  // Distance is straight-line (haversine), computed in useClinics. Driving
  // distance via Google Distance Matrix was removed in the cost-reduction plan.
  const isWithinConfiguredRadius = useCallback(
    (clinic: ClinicWithWaitTime) => {
      if (!userLocation) return true;
      return (clinic.distance ?? 999) <= nearbyRadiusMiles;
    },
    [userLocation, nearbyRadiusMiles]
  );

  const isSearching = Boolean(search.trim());

  // Map markers:
  //  - while searching, show exactly the offices the server matched;
  //  - otherwise show EVERY active clinic (item 8) so a pin appears wherever the
  //    map is panned, independent of the nearby-radius filter (which only
  //    governs the list below). MapView guards non-finite coordinates.
  const displayedClinics = useMemo(() => {
    if (!clinics?.length) return [];
    if (isSearching && matchedClinicIds.length > 0) {
      const byId = new Map(clinics.map((c) => [c.id, c]));
      return matchedClinicIds
        .map((id) => byId.get(id))
        .filter((c): c is ClinicWithWaitTime => Boolean(c));
    }
    if (isSearching) return [];
    return clinics;
  }, [clinics, isSearching, matchedClinicIds]);

  // Frame the map on the search hits (only when no candidate pin owns the view).
  const matchedIdsKey = matchedClinicIds.join(",");
  useEffect(() => {
    if (candidate || !matchedClinicIds.length || !clinics?.length) return;
    const byId = new Map(clinics.map((c) => [c.id, c]));
    const matched = matchedClinicIds.map((id) => byId.get(id)).filter(Boolean) as ClinicWithWaitTime[];
    if (!matched.length) return;
    setCenterOn({
      lat: matched.reduce((s, c) => s + c.latitude, 0) / matched.length,
      lng: matched.reduce((s, c) => s + c.longitude, 0) / matched.length,
      zoom: matched.length === 1 ? 15 : 12,
    });
    // `clinics` is intentionally omitted: it gets a new identity on every
    // background refetch, which would re-centre the map under the user.
  }, [matchedIdsKey, candidate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Nearby clinics for "Explore" list — show all sorted by distance, or all if no location
  const nearbyClinics = useMemo(() => {
    if (!userLocation) return clinicsWithinNearbyRadius;
    return clinicsWithinNearbyRadius
      .filter((c) => isWithinConfiguredRadius(c))
      .slice()
      .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));
  }, [clinicsWithinNearbyRadius, userLocation, isWithinConfiguredRadius]);

  const handleFindMe = useCallback(() => {
    if (userLocation) {
      setCenterOn({ lat: userLocation.lat, lng: userLocation.lng, zoom: 14 });
    }
  }, [userLocation]);

  const handleClinicClick = useCallback((clinic: ClinicWithWaitTime) => {
    setSelectedClinic(clinic);
  }, []);

  const handleEmptyClick = useCallback(() => {
    // No-op: detail flow is navigation-based now
  }, []);

  const handleReported = useCallback(() => {
    setSelectedClinic(null);
    refetch();
  }, [refetch]);

  /**
   * A `db` hit is already saved — open it. An `npi` hit is only a candidate:
   * pin it and ask for confirmation. Selecting must never write to the
   * directory, otherwise an ambiguous query saves the wrong place.
   */
  const handleSelectResult = useCallback(
    (result: MedicalSearchResult) => {
      setDropdownOpen(false);
      if (result.source === "db") {
        const clinic = clinics?.find((c) => c.id === result.id);
        if (clinic) {
          setCandidate(null);
          setSelectedClinic(clinic);
        } else {
          // Saved server-side but not in the local snapshot yet.
          refetch();
          setCenterOn({ lat: result.latitude, lng: result.longitude, zoom: 16 });
        }
        return;
      }

      setSelectedClinic(null);
      setCandidate(result);
    },
    [clinics, refetch]
  );

  const handleVerified = useCallback(
    async (added: AddedClinic) => {
      setCandidate(null);
      setSearch("");
      toast.success(`${added.name} added.`);

      // The place is already saved server-side; a failed refetch must not make
      // it look like the add failed. Fall back to centring on the new pin.
      try {
        const { data: refreshed } = await refetch();
        const clinic = refreshed?.find((c) => c.id === added.id);
        if (clinic) {
          setSelectedClinic(clinic);
          return;
        }
      } catch {
        // fall through to centring below
      }
      setCenterOn({ lat: added.latitude, lng: added.longitude, zoom: 16 });
    },
    [refetch]
  );

  /** Tapping an empty map point shows an "Add here" affordance. */
  const handleMapPointClick = useCallback((point: { lat: number; lng: number }) => {
    setDropdownOpen(false);
    setPendingPoint(point);
  }, []);

  /** Confirm "Add here": reverse-geocode the exact point, then open the form. */
  const confirmAddHere = useCallback(async () => {
    if (!pendingPoint) return;
    const point = pendingPoint;
    setPendingPoint(null);
    const toastId = toast.loading("Locating…");
    const geo = await reverseGeocode(point.lat, point.lng);
    toast.dismiss(toastId);
    // Coordinates come from the exact tapped point — authoritative, not fuzzy.
    const prefill: AddDoctorPrefill = {
      address: geo?.address ?? undefined,
      place_id: geo?.placeId ?? undefined,
      lat: point.lat,
      lng: point.lng,
    };
    navigate("/suggest", { state: { prefill } });
  }, [pendingPoint, navigate]);

  const showResultsDropdown = isSearching && dropdownOpen && !candidate && !selectedClinic;

  // Collapse the dropdown when the user clicks anywhere outside the search box
  // (e.g. on the map). Listener is only attached while the dropdown is open, so
  // it never interferes with the map when the dropdown is closed.
  useEffect(() => {
    if (!showResultsDropdown) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [showResultsDropdown]);

  return (
    <div className="relative flex h-screen flex-col bg-background overflow-hidden pb-20 sm:pb-0">
      {/* Search bar overlay */}
      <div className="absolute top-0 left-0 right-0 z-[50] px-2 sm:px-3 pt-2 sm:pt-3 pb-2 pointer-events-none">
        <div ref={searchBoxRef} className="pointer-events-auto mx-auto max-w-lg">
          <div className="relative rounded-2xl border border-border/40 bg-card/90 backdrop-blur-xl shadow-xl">
            <div className="flex items-center gap-2 px-3">
              {searchState.loading ? (
                <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
              ) : (
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <Input
                placeholder="Search doctor office or location…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setDropdownOpen(true);
                }}
                onFocus={() => {
                  if (search.trim()) setDropdownOpen(true);
                }}
                className="flex-1 border-0 bg-transparent h-10 sm:h-12 text-xs sm:text-sm shadow-none focus-visible:ring-0 px-0"
              />
              {search && (
                <button
                  onClick={() => {
                    setSearch("");
                    setCandidate(null);
                    setDropdownOpen(false);
                  }}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {showResultsDropdown && (
              <SearchResultsDropdown
                results={searchState.results}
                loading={searchState.loading}
                limited={searchState.limited}
                degraded={searchState.degraded}
                searched={searchState.searched}
                userLocation={userLocation}
                onSelect={handleSelectResult}
                onSuggestClinic={() => navigate("/suggest")}
              />
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
              {locating ? "Finding your location…" : "Loading doctor offices…"}
            </p>
          </div>
        </div>
      )}

      {/* Map + List layout */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Map area */}
        <div className="relative flex-1 min-h-[36vh] sm:min-h-[45vh]">
          {/*
            Always keep MapView mounted. Unmounting it when isLoading flips
            (for example when the useClinics queryKey changes mid-session)
            tears down the map instance and re-runs its setup — that's what
            looked like "the map glitching". The loading overlay above already
            covers the initial-fetch UX.
          */}
          <MapView
            clinics={displayedClinics}
            userLocation={userLocation}
            onClinicClick={handleClinicClick}
            onEmptyClick={handleEmptyClick}
            onMapPointClick={handleMapPointClick}
            centerOn={centerOn}
            candidate={
              candidate
                ? {
                    name: candidate.name,
                    latitude: candidate.latitude,
                    longitude: candidate.longitude,
                  }
                : null
            }
            pendingPoint={pendingPoint}
            nearbyRadiusMiles={nearbyRadiusMiles}
          />

          <FindMeButton onClick={handleFindMe} visible={!!userLocation} />

          <MapLegend />

          {/* Item 7b — "Add here" affordance for a tapped empty point. */}
          {pendingPoint && !candidate && !selectedClinic && (
            <div className="absolute bottom-4 left-3 right-3 z-[60] mx-auto max-w-md animate-in slide-in-from-bottom-4 fade-in duration-300">
              <div className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card/95 p-3 shadow-xl backdrop-blur-xl">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-card-foreground">Add a doctor office here?</p>
                  <p className="truncate text-[10px] text-muted-foreground tabular-nums">
                    {pendingPoint.lat.toFixed(6)}, {pendingPoint.lng.toFixed(6)}
                  </p>
                </div>
                <button
                  onClick={() => setPendingPoint(null)}
                  className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted/40"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmAddHere}
                  className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Add here
                </button>
              </div>
            </div>
          )}

          {candidate && (
            <VerifyPlaceCard
              candidate={candidate}
              userLocation={userLocation}
              onCancel={() => setCandidate(null)}
              onVerified={handleVerified}
            />
          )}

          {selectedClinic && (
            <ClinicBottomSheet
              clinic={selectedClinic}
              cooldownMinutes={reportCooldownMinutes}
              onClose={() => setSelectedClinic(null)}
              onReported={handleReported}
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
