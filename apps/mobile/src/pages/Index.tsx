import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

import { ClinicListPanel } from '@/src/components/map/ClinicListPanel';
import { ClinicStackPicker } from '@/src/components/map/ClinicStackPicker';
import { FindMeButton } from '@/src/components/map/FindMeButton';
import { MapLegend } from '@/src/components/map/MapLegend';
import { MapView } from '@/src/components/map/MapView';
import type { MapBounds } from '@/src/components/map/leaflet-map-html';
import { ProximityPrompt } from '@/src/components/map/ProximityPrompt';
import { SearchResults } from '@/src/components/map/SearchResults';
import { VerifyCard } from '@/src/components/map/VerifyCard';
import { BottomNav } from '@/src/components/navigation/BottomNav';
import { type AddedClinic, useAddMedicalPlace } from '@/src/hooks/use-add-medical-place';
import { useAppSettings } from '@/src/hooks/use-app-settings';
import { type ClinicWithMeta, useClinics } from '@/src/hooks/use-clinics';
import { type MedicalPlaceResult, useMedicalSearch } from '@/src/hooks/use-medical-search';
import { useTheme } from '@/src/hooks/use-theme';
import { getDeviceFingerprint } from '@/src/lib/device-fingerprint';
import { haversineDistanceMeters } from '@/src/lib/distance';
import { getCurrentPosition, getDisplayPosition, type LatLng, reverseGeocodeAddress } from '@/src/lib/geolocation';
import { maxAccuracyMetersForReport } from '@/src/lib/report-wait-geofence';
import { supabase } from '@/src/lib/supabase';
import { showToast } from '@/src/lib/toast';
import { waitMinutesToCategory } from '@/src/lib/wait-time-report';
import { waitTierVisual } from '@/src/lib/wait-tier-style';

type CityFilter = 'all' | 'Miami' | 'Miami Beach' | 'Hialeah' | 'Coral Gables' | 'Doral';

type DistanceSource = 'google' | 'fallback' | 'unavailable';
const SEARCH_CARD_TOP = 42;
const LEGEND_TOP_WHEN_PANEL_CLOSED = -590;
const LEGEND_TOP_WHEN_PANEL_OPEN = -290;

const fetchOsrmDistanceMeters = async (from: LatLng, to: LatLng): Promise<number | null> => {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=false`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const payload = (await response.json()) as { routes?: { distance?: number }[] };
    const distance = payload.routes?.[0]?.distance;
    return typeof distance === 'number' ? distance : null;
  } catch {
    return null;
  }
};

const cityMatch = (address: string, cityFilter: CityFilter): boolean => {
  if (cityFilter === 'all') return true;
  return address.toLowerCase().includes(cityFilter.toLowerCase());
};

/** A saved office built from a search result, for when it isn't in the loaded snapshot
 *  (e.g. outside the radius). Mirrors web's dbResultToClinic. */
const clinicFromResult = (result: MedicalPlaceResult): ClinicWithMeta => ({
  id: result.id ?? '',
  name: result.name,
  doctor_name: null,
  specialty: null,
  address: result.address,
  latitude: result.latitude,
  longitude: result.longitude,
  is_active: true,
  phone: null,
  google_place_id: null,
  latestWaitMinutes: null,
  latestReportAt: null,
  recentReports: [],
});

export const IndexPage = () => {
  const router = useRouter();
  const { isDark } = useTheme();
  const { settings } = useAppSettings();

  const [search, setSearch] = useState('');
  const [cityFilter] = useState<CityFilter>('all');
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  // Stable reference: an inline object literal here would be a new object on
  // every render, and useClinics' fetch effect depends on it by reference —
  // that re-triggers the fetch (and resets its loading flag) every render,
  // an infinite reload loop that never lets "loading" settle to false.
  const reportExpiry = useMemo(
    () => ({
      reportExpiry30MinMinutes: settings.reportExpiry30MinMinutes,
      reportExpiry60MinMinutes: settings.reportExpiry60MinMinutes,
      reportExpiry90PlusMinutes: settings.reportExpiry90PlusMinutes,
    }),
    [settings.reportExpiry30MinMinutes, settings.reportExpiry60MinMinutes, settings.reportExpiry90PlusMinutes]
  );
  /** True once the first location attempt has finished (success or not). */
  const [locationResolved, setLocationResolved] = useState(false);
  const {
    clinics,
    loading: clinicsLoading,
    isLoadingMore: clinicsLoadingMore,
    totalCount: clinicsTotalCount,
    error: clinicsError,
    refresh: refreshClinics,
  } = useClinics(
    reportExpiry,
    userLocation?.latitude,
    userLocation?.longitude,
    settings.nearbyRadiusMiles,
    locationResolved
  );
  const [locating, setLocating] = useState(false);
  const [centerOn, setCenterOn] = useState<(LatLng & { zoom?: number }) | null>(null);
  const [nearbyClinic, setNearbyClinic] = useState<ClinicWithMeta | null>(null);
  /** User tapped a clinic on the map or list to open the report sheet. */
  const [selectedClinic, setSelectedClinic] = useState<ClinicWithMeta | null>(null);
  const [selectedClinicCanReport, setSelectedClinicCanReport] = useState(false);
  const [dismissedPrompts, setDismissedPrompts] = useState<Set<string>>(new Set());
  const [listExpanded, setListExpanded] = useState(false);
  const [listPanelCollapsed, setListPanelCollapsed] = useState(false);
  const [routeDistanceByClinicId, setRouteDistanceByClinicId] = useState<Record<string, number | null>>({});
  const [routeDistanceSourceByClinicId, setRouteDistanceSourceByClinicId] = useState<
    Record<string, DistanceSource>
  >({});
  const [promptSubmitting, setPromptSubmitting] = useState(false);
  /** Office the user asked to see with a driving route from their location (same as web's routeTo). */
  const [routeTo, setRouteTo] = useState<ClinicWithMeta | null>(null);
  const [routeLine, setRouteLine] = useState<{ geometry: [number, number][]; miles: number; minutes: number } | null>(null);
  /** Offices behind one pin that the user has to choose between. */
  const [stackPick, setStackPick] = useState<ClinicWithMeta[] | null>(null);
  /** Visible map rectangle — the list and count follow it, as on web. */
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);

  // Medical search (DB-first, then Google) + verify-then-add — same flow as web.
  /** Results dropdown under the search box (web: dropdownOpen). */
  const [dropdownOpen, setDropdownOpen] = useState(false);
  /** Saved office picked from search: its pin is highlighted in its wait colour (web: focusedPlace). */
  const [focusedPlace, setFocusedPlace] = useState<{ latitude: number; longitude: number; color: string } | null>(null);
  /** Registry match awaiting "Verify & Add" (web: candidate). */
  const [pendingPlace, setPendingPlace] = useState<MedicalPlaceResult | null>(null);
  const [mapTapPoint, setMapTapPoint] = useState<LatLng | null>(null);
  const medSearch = useMedicalSearch(search, userLocation);
  const { addPlace, addingId } = useAddMedicalPlace();

  const loadLocation = useCallback(async () => {
    setLocating(true);
    try {
      const position = await getDisplayPosition();
      if (position) {
        setUserLocation(position.coords);
        setCenterOn(position.coords);
      } else {
        showToast('Location helps recommendations, but app still works without it.');
      }
    } finally {
      setLocating(false);
      setLocationResolved(true);
    }
  }, []);

  useEffect(() => {
    void loadLocation();
  }, [loadLocation]);

  /**
   * Auto proximity prompt: closest clinic within fixed report geofence (1000 m).
   * Which clinics appear in the nearby list is controlled by Supabase `nearby_radius_miles`, not this value.
   */
  useEffect(() => {
    if (!userLocation) return;
    const closest = clinics
      .map((clinic) => ({
        clinic,
        distance: haversineDistanceMeters(userLocation, {
          latitude: clinic.latitude,
          longitude: clinic.longitude,
        }),
      }))
      .filter((item) => item.distance <= settings.reportGeofenceMeters)
      .sort((a, b) => a.distance - b.distance)[0];
    if (!closest) {
      setNearbyClinic(null);
      return;
    }
    if (!dismissedPrompts.has(closest.clinic.id)) setNearbyClinic(closest.clinic);
  }, [clinics, dismissedPrompts, userLocation]);

  const displayedClinics = useMemo(() => {
    const radiusMeters = settings.nearbyRadiusMiles * 1609.34;
    let source = clinics;

    if (userLocation && cityFilter === 'all') {
      source = clinics.filter((clinic) => {
        return (
          haversineDistanceMeters(userLocation, {
            latitude: clinic.latitude,
            longitude: clinic.longitude,
          }) <= radiusMeters
        );
      });
    }

    return source.filter((clinic) => cityMatch(clinic.address, cityFilter));
  }, [clinics, cityFilter, settings.nearbyRadiusMiles, userLocation]);

  // Straight-line distance, nearest first — the same rule as the web list, and the
  // same rule that decides which pins are on the map. (Driving distances are shown
  // as labels only; filtering by them dropped offices that the map still draws.)
  const nearbyClinics = useMemo(() => {
    if (!userLocation) return displayedClinics;
    return [...displayedClinics].sort(
      (a, b) =>
        haversineDistanceMeters(userLocation, { latitude: a.latitude, longitude: a.longitude }) -
        haversineDistanceMeters(userLocation, { latitude: b.latitude, longitude: b.longitude })
    );
  }, [displayedClinics, userLocation]);

  /** Straight-line distance ≤ nearby_radius_miles — identical to the pins drawn on the map. */
  const clinicsWithinDrivingRadius = useMemo(() => {
    const radiusMeters = settings.nearbyRadiusMiles * 1609.34;
    if (cityFilter !== 'all') return nearbyClinics;
    if (!userLocation) return nearbyClinics;
    return nearbyClinics.filter(
      (clinic) =>
        haversineDistanceMeters(userLocation, { latitude: clinic.latitude, longitude: clinic.longitude }) <=
        radiusMeters
    );
  }, [cityFilter, nearbyClinics, userLocation, settings.nearbyRadiusMiles]);

  useEffect(() => {
    if (!routeTo || !userLocation) { setRouteLine(null); return; }
    const controller = new AbortController();
    const url = `https://router.project-osrm.org/route/v1/driving/${userLocation.longitude},${userLocation.latitude};${routeTo.longitude},${routeTo.latitude}?overview=full&geometries=geojson`;
    fetch(url, { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => {
        const r = json?.routes?.[0];
        if (!r) { setRouteLine(null); return; }
        setRouteLine({
          geometry: r.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]),
          miles: r.distance / 1609.344,
          minutes: r.duration / 60,
        });
      })
      .catch(() => { if (!controller.signal.aborted) setRouteLine(null); });
    return () => controller.abort();
  }, [routeTo, userLocation]);

  /** Web: searching = anything typed (trimmed). */
  const isSearching = search.trim().length > 0;
  /** Web's displayedClinics while searching: each saved match as an office card, from the
   *  loaded snapshot when present, otherwise built from the search result itself. */
  const searchClinics = useMemo<ClinicWithMeta[]>(() => {
    if (!isSearching) return [];
    const byId = new Map(clinics.map((c) => [c.id, c]));
    return medSearch.results
      .filter((r) => r.source === 'db')
      .map((r) => byId.get(r.id ?? '') ?? clinicFromResult(r));
  }, [clinics, isSearching, medSearch.results]);

  // Map: the route's office while routing; the search matches while searching; otherwise
  // every loaded office. Nothing is shown as "nearby" until a location is known (web).
  const mapClinics = useMemo(() => {
    const source = routeTo ? [routeTo] : isSearching ? searchClinics : userLocation ? clinics : [];
    return source.filter((c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude));
  }, [clinics, isSearching, routeTo, searchClinics, userLocation]);

  /** The highlight pin would cover a stack badge when other offices share its spot, so it
   *  is left off then; the badge (tap it to pick) shows instead. */
  const focusedForMap = useMemo(() => {
    if (!focusedPlace) return null;
    const sharing = mapClinics.filter(
      (c) =>
        haversineDistanceMeters(
          { latitude: focusedPlace.latitude, longitude: focusedPlace.longitude },
          { latitude: c.latitude, longitude: c.longitude }
        ) <= 15
    );
    return sharing.length > 1 ? null : focusedPlace;
  }, [focusedPlace, mapClinics]);

  // Web: the bottom list collapses while the dropdown is open and expands by itself the
  // moment the dropdown closes (a pick, a clear, or a tap elsewhere).
  const listAutoCollapse = (isSearching && dropdownOpen) || stackPick != null;
  useEffect(() => {
    setListPanelCollapsed(listAutoCollapse);
  }, [listAutoCollapse]);

  // Web: when the matches change, frame the map on them (one match zoom 15, several zoom 12).
  const matchKey = medSearch.results
    .filter((r) => r.source === 'db')
    .map((r) => `${r.id}:${r.latitude}:${r.longitude}`)
    .join(',');
  useEffect(() => {
    if (pendingPlace) return;
    const matches = medSearch.results.filter((r) => r.source === 'db');
    if (matches.length === 0) return;
    setCenterOn({
      latitude: matches.reduce((sum, r) => sum + r.latitude, 0) / matches.length,
      longitude: matches.reduce((sum, r) => sum + r.longitude, 0) / matches.length,
      zoom: matches.length === 1 ? 15 : 12,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchKey, pendingPlace]);

  useEffect(() => {
    if (!userLocation || displayedClinics.length === 0) return;
    const first50 = displayedClinics.slice(0, 50);
    const chunkSize = 25;

    void (async () => {
      const distanceMap: Record<string, number | null> = {};
      const sourceMap: Record<string, DistanceSource> = {};

      // Driving distance via the free OSRM routing service (no Google API).
      for (let i = 0; i < first50.length; i += chunkSize) {
        const chunk = first50.slice(i, i + chunkSize);
        for (const clinic of chunk) {
          const routeMeters = await fetchOsrmDistanceMeters(userLocation, {
            latitude: clinic.latitude,
            longitude: clinic.longitude,
          });
          distanceMap[clinic.id] = routeMeters;
          sourceMap[clinic.id] = typeof routeMeters === 'number' ? 'fallback' : 'unavailable';
        }
      }

      setRouteDistanceByClinicId((prev) => ({ ...prev, ...distanceMap }));
      setRouteDistanceSourceByClinicId((prev) => ({ ...prev, ...sourceMap }));
    })();
  }, [displayedClinics, userLocation]);

  /** The bottom list (web's ClinicListPanel input): the search matches while searching,
   *  otherwise the nearby offices inside the visible map. */
  const listClinics = useMemo(() => {
    if (routeTo) return [routeTo];
    if (isSearching) return searchClinics;
    if (!userLocation) return [];
    if (!mapBounds) return clinicsWithinDrivingRadius;
    return clinicsWithinDrivingRadius.filter(
      (c) =>
        c.latitude <= mapBounds.north &&
        c.latitude >= mapBounds.south &&
        c.longitude <= mapBounds.east &&
        c.longitude >= mapBounds.west
    );
  }, [clinicsWithinDrivingRadius, isSearching, mapBounds, routeTo, searchClinics, userLocation]);

  const reportClinic = useMemo(
    () => selectedClinic ?? nearbyClinic,
    [nearbyClinic, selectedClinic]
  );
  const canReportInPrompt = selectedClinic ? selectedClinicCanReport : Boolean(nearbyClinic);
  // Any blocking overlay (report card OR the verify card) suppresses map/search/nav taps.
  // Only an opened office sheet or a pending verification blocks the map and search.
  // The "You're near" prompt is a non-blocking card, as on web.
  const isPopupActive = Boolean(selectedClinic) || pendingPlace != null;

  const submitWaitReport = useCallback(
    async (clinic: ClinicWithMeta, minutes: number) => {
      setPromptSubmitting(true);
      try {
        const livePos = await getCurrentPosition();
        const distance = haversineDistanceMeters(livePos.coords, {
          latitude: clinic.latitude,
          longitude: clinic.longitude,
        });
        if (distance > settings.reportGeofenceMeters) {
          showToast(
            `You must be within ${settings.reportGeofenceMeters} m of the clinic to report (GPS check).`
          );
          setPromptSubmitting(false);
          return;
        }
        const maxAccuracyM = maxAccuracyMetersForReport(settings.reportGeofenceMeters);
        if ((livePos.accuracy ?? 999) > maxAccuracyM) {
          showToast(`GPS accuracy must be about ${maxAccuracyM} m or better to report near this clinic.`);
          setPromptSubmitting(false);
          return;
        }

        const fingerprint = await getDeviceFingerprint();
        const windowStart = new Date(Date.now() - settings.reportCooldownMinutes * 60 * 1000).toISOString();
        // Global per-device cooldown: one report anywhere locks this device out of
        // reporting ANY clinic (not just this one) until the cooldown window passes.
        const duplicateCheck = await supabase
          .from('wait_time_reports')
          .select('id')
          .eq('device_fingerprint', fingerprint)
          .gte('reported_at', windowStart)
          .limit(1);
        if (duplicateCheck.error) throw duplicateCheck.error;
        if ((duplicateCheck.data ?? []).length > 0) {
          showToast('You already reported recently…');
          setDismissedPrompts((prev) => new Set(prev).add(clinic.id));
          setNearbyClinic((n) => (n?.id === clinic.id ? null : n));
          setSelectedClinic((s) => (s?.id === clinic.id ? null : s));
          setPromptSubmitting(false);
          return;
        }

        const category = waitMinutesToCategory(minutes);
        const { error } = await supabase.from('wait_time_reports').insert({
          clinic_id: clinic.id,
          wait_time: category,
          device_fingerprint: fingerprint,
          // No expiry_time: like the web app, each category's expiry is worked out
          // from reported_at and the admin's per-category settings when it's read.
        });
        if (error) throw error;

        await refreshClinics();
        setNearbyClinic((n) => (n?.id === clinic.id ? null : n));
        setSelectedClinic((s) => (s?.id === clinic.id ? null : s));
        showToast('Thank you! Report submitted.');
      } catch (e) {
        console.error('[submitWaitReport]', e);
        const raw =
          e instanceof Error
            ? e.message
            : typeof e === 'object' && e !== null && 'message' in e
              ? String((e as { message: unknown }).message)
              : '';
        if (raw.toLowerCase().includes('row-level security') || raw.includes('42501')) {
          showToast("Couldn't save report. Sign in may be required or policy blocks inserts.");
        } else {
          showToast('Failed to submit report. Try again.');
        }
      } finally {
        setPromptSubmitting(false);
      }
    },
    [
      refreshClinics,
      settings.reportCooldownMinutes,
      settings.reportExpiry30MinMinutes,
      settings.reportExpiry60MinMinutes,
      settings.reportExpiry90PlusMinutes,
      settings.reportGeofenceMeters,
    ]
  );

  const openClinicPopup = useCallback(
    (clinic: ClinicWithMeta) => {
      const canReport =
        userLocation != null &&
        haversineDistanceMeters(userLocation, {
          latitude: clinic.latitude,
          longitude: clinic.longitude,
        }) <= settings.reportGeofenceMeters;
      setSelectedClinic(clinic);
      setSelectedClinicCanReport(canReport);
    },
    [userLocation]
  );

  // Tapping a result recenters the map. A DB result (already saved) opens its
  // clinic card directly. A Google result is NOT saved yet — it's previewed on
  // our map with a pin so the user can confirm the location, then "Verify & Add".
  /** Web's handleSelectResult: a saved office opens its card and is highlighted on the map;
   *  a registry match is pinned for "Verify & Add". The search text stays as it is. */
  const handleSelectResult = useCallback(
    (result: MedicalPlaceResult) => {
      setDropdownOpen(false);
      if (result.source === 'db') {
        const clinic = clinics.find((c) => c.id === result.id) ?? clinicFromResult(result);
        setPendingPlace(null);
        setFocusedPlace({
          latitude: result.latitude,
          longitude: result.longitude,
          color: waitTierVisual(clinic.latestWaitMinutes).pin,
        });
        openClinicPopup(clinic);
        return;
      }
      setFocusedPlace(null);
      setPendingPlace(result);
    },
    [clinics, openClinicPopup]
  );

  // After a place is saved, refresh clinics + open its clinic card.
  const openAddedClinic = useCallback(
    (c: AddedClinic) => {
      void refreshClinics();
      const meta: ClinicWithMeta = {
        id: c.id,
        name: c.name,
        doctor_name: null,
        specialty: c.specialty ?? null,
        address: c.address,
        latitude: c.latitude,
        longitude: c.longitude,
        is_active: true,
        phone: c.phone ?? null,
        google_place_id: c.google_place_id ?? null,
        source: 'npi',
        verified: true,
        latestWaitMinutes: null,
        latestReportAt: null,
        recentReports: [],
      };
      setCenterOn({ latitude: c.latitude, longitude: c.longitude });
      openClinicPopup(meta);
    },
    [refreshClinics, openClinicPopup]
  );

  const addFailureMessage = (reason: string): string =>
    reason === 'rate_limited'
      ? 'Too many additions right now. Please try again shortly.'
      : reason === 'not_medical'
        ? "That place doesn't look like a medical office."
        : reason === 'permanently_closed'
          ? 'That place is permanently closed.'
          : 'Could not add this place. Please try again.';

  // "Verify & Add": save the confirmed NPPES place, then open its clinic card.
  const handleVerify = useCallback(
    async (result: MedicalPlaceResult) => {
      if (result.source !== 'npi' || !result.npi) return;
      const res = await addPlace(result.npi);
      if (res.ok) {
        setPendingPlace(null);
        setSearch('');
        openAddedClinic(res.clinic);
      } else if (res.reason !== 'busy') {
        showToast(addFailureMessage(res.reason));
      }
    },
    [addPlace, openAddedClinic]
  );

  // Tapping a map POI → open the Suggest form prefilled with the point. (Raster
  // OSM / Apple Maps have no addable "place id" the way Google POIs did.)
  const handlePoiPress = useCallback(
    async (poi: { placeId?: string; name?: string; coordinate: LatLng }) => {
      if (isPopupActive) return;
      setMapTapPoint(null);
      router.push({
        pathname: '/suggest-clinic',
        params: {
          name: poi.name ?? '',
          lat: String(poi.coordinate.latitude),
          lng: String(poi.coordinate.longitude),
        },
      });
    },
    [isPopupActive, router]
  );

  // Web: an empty map tap closes the dropdown; "Add here" is offered only without a search.
  const handleMapPress = useCallback(
    (coord: LatLng) => {
      if (isPopupActive) return;
      setDropdownOpen(false);
      if (isSearching) return;
      setMapTapPoint(coord);
    },
    [isPopupActive, isSearching]
  );

  // Confirm "add a doctor office here" → reverse-geocode + open Suggest prefilled.
  const handleAddHere = useCallback(async () => {
    const point = mapTapPoint;
    if (!point) return;
    setMapTapPoint(null);
    let address = '';
    try {
      address = (await reverseGeocodeAddress(point)) ?? '';
    } catch {
      // proceed without an address; the user can fill it in
    }
    router.push({
      pathname: '/suggest-clinic',
      params: { lat: String(point.latitude), lng: String(point.longitude), address },
    });
  }, [mapTapPoint, router]);

  /** Web's showResultsDropdown: typing shows the dropdown, unless an office card or a
   *  pending verification is open. */
  const showDropdown = dropdownOpen && isSearching && !pendingPlace && !selectedClinic;

  /** "Clear" on the route banner — a route is usually to a far-away office found by
   *  search, so leaving the search text and route behind would strand the user there.
   *  Reset everything back to their own location (same as web's handleClearRoute). */
  const handleClearRoute = useCallback(() => {
    setRouteTo(null);
    setRouteLine(null);
    setSearch('');
    setFocusedPlace(null);
    setDropdownOpen(false);
    if (userLocation) setCenterOn({ ...userLocation, zoom: 14 });
  }, [userLocation]);

  const handleViewOnMap = useCallback(
    (clinic: ClinicWithMeta) => {
      setSelectedClinic(null);
      setSelectedClinicCanReport(false);
      setRouteTo(clinic);
      setCenterOn({ latitude: clinic.latitude, longitude: clinic.longitude, zoom: 15 });
    },
    []
  );

  const handleStackSelect = useCallback(
    (clinic: ClinicWithMeta) => {
      setStackPick(null);
      openClinicPopup(clinic);
    },
    [openClinicPopup]
  );

  return (
    <View style={[styles.screen, { backgroundColor: isDark ? '#0b1220' : '#f8fafc' }]}>
      <View style={styles.mapContainer}>
        <MapView
          clinics={mapClinics}
          userLocation={userLocation}
          searchArea={null}
          nearbyRadiusMeters={settings.nearbyRadiusMiles * 1609.34}
          centerOn={centerOn}
          onCenterApplied={() => setCenterOn(null)}
          onClinicPress={isPopupActive ? undefined : openClinicPopup}
          candidate={
            pendingPlace
              ? { latitude: pendingPlace.latitude, longitude: pendingPlace.longitude }
              : mapTapPoint && !selectedClinic
                ? mapTapPoint
                : null
          }
          focused={focusedForMap}
          onMapPress={handleMapPress}
          onPoiPress={handlePoiPress}
          route={routeLine?.geometry ?? null}
          onStackPress={isPopupActive ? undefined : setStackPick}
          onBoundsChange={setMapBounds}
        />

        {routeTo ? (
          <View style={[styles.routeBanner, { backgroundColor: isDark ? 'rgba(23,32,51,0.96)' : 'rgba(255,255,255,0.96)', borderColor: isDark ? '#334155' : '#dbe1e8' }]}>
            <View style={styles.routeText}>
              <Text style={[styles.routeName, { color: isDark ? '#f1f5f9' : '#0f172a' }]} numberOfLines={1}>{routeTo.name}</Text>
              <Text style={[styles.routeMeta, { color: isDark ? '#94a3b8' : '#64748b' }]} numberOfLines={1}>
                {routeLine
                  ? `${routeLine.miles < 10 ? routeLine.miles.toFixed(1) : Math.round(routeLine.miles)} mi · about ${Math.max(1, Math.round(routeLine.minutes))} min drive`
                  : userLocation ? 'Finding route…' : 'Enable location to see the route'}
              </Text>
            </View>
            <Pressable onPress={handleClearRoute} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear route">
              <Text style={styles.routeClear}>Clear</Text>
            </Pressable>
          </View>
        ) : null}

        {/* No full-screen backdrop here: it covered the map and blocked panning and
            zooming while results were open. Tapping the map closes the dropdown instead
            (see handleMapPress), the same as web. */}

        {/* While a route is shown, the route banner takes the search bar's place (as on web). */}
        {!routeTo ? (
        <View
          style={[
            styles.searchCard,
            {
              backgroundColor: isDark ? '#172033' : '#ffffff',
              borderColor: isDark ? '#334155' : '#dbe1e8',
            },
          ]}>
          <View style={styles.inputWrap}>
            <Feather name="search" size={15} color={isDark ? '#e2e8f0' : '#111827'} />
            <TextInput
              style={[
                styles.input,
                { backgroundColor: isDark ? '#172033' : '#fff', color: isDark ? '#e2e8f0' : '#111827' },
                // react-native-web renders TextInput as a plain <input>, which picks up the
                // browser's default focus outline/ring. Suppress it — the card's own border
                // already shows focus state. No-op on native iOS/Android; cast needed since
                // `outlineStyle` isn't in RN's TextStyle, only react-native-web's.
                { outlineStyle: 'none' } as any,
              ]}
              placeholder="Search doctor office or location…"
              value={search}
              onChangeText={
                isPopupActive
                  ? undefined
                  : (text) => {
                      setSearch(text);
                      setFocusedPlace(null);
                      setMapTapPoint(null);
                      setDropdownOpen(true);
                    }
              }
              onFocus={
                isPopupActive
                  ? undefined
                  : () => {
                      // Web: focusing a box that has text reopens its results.
                      if (search.trim()) setDropdownOpen(true);
                    }
              }
              editable={!isPopupActive}
              placeholderTextColor={isDark ? '#94a3b8' : '#4b5563'}
            />
            {search.length > 0 && !isPopupActive ? (
              <Pressable
                onPress={() => {
                  setSearch('');
                  setPendingPlace(null);
                  setFocusedPlace(null);
                  setDropdownOpen(false);
                  // Back to where the user started: their own location, not the last match.
                  if (userLocation) setCenterOn({ ...userLocation, zoom: 14 });
                }}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Clear search">
                <Feather name="x" size={16} color={isDark ? '#94a3b8' : '#64748b'} />
              </Pressable>
            ) : null}
          </View>
        </View>
        ) : null}

        <SearchResults
          visible={showDropdown}
          loading={medSearch.loading}
          results={medSearch.results}
          limited={medSearch.limited}
          degraded={medSearch.degraded}
          isDark={isDark}
          userLocation={userLocation}
          onSelect={handleSelectResult}
          onSuggest={() => router.push('/suggest-clinic')}
        />

        <FindMeButton onPress={() => void loadLocation()} loading={locating} disabled={isPopupActive} isDark={isDark} />
        <View pointerEvents={isPopupActive ? 'none' : 'auto'}>
          <MapLegend top={listPanelCollapsed ? LEGEND_TOP_WHEN_PANEL_CLOSED : LEGEND_TOP_WHEN_PANEL_OPEN} isDark={isDark} />
        </View>

        {mapTapPoint && !isPopupActive && !selectedClinic ? (
          <View style={[styles.addHereBar, { backgroundColor: isDark ? '#172033' : '#ffffff', borderColor: isDark ? '#334155' : '#dbe1e8' }]}>
            <Feather name="map-pin" size={16} color="#2563eb" />
            <View style={styles.addHereTextWrap}>
              <Text style={[styles.addHereText, { color: isDark ? '#e2e8f0' : '#0f172a' }]}>Add a doctor office here?</Text>
              <Text style={[styles.addHereCoords, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                {`${mapTapPoint.latitude.toFixed(6)}, ${mapTapPoint.longitude.toFixed(6)}`}
              </Text>
            </View>
            <Pressable onPress={() => setMapTapPoint(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cancel">
              <Text style={[styles.addHereCancel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.addHereConfirm} onPress={() => void handleAddHere()} accessibilityRole="button" accessibilityLabel="Add here">
              <Text style={styles.addHereConfirmText}>Add here</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <ClinicListPanel
        clinics={listClinics}
        userLocation={userLocation}
        routeDistanceByClinicId={routeDistanceByClinicId}
        routeDistanceSourceByClinicId={routeDistanceSourceByClinicId}
        expanded={listExpanded}
        onToggleExpanded={isPopupActive ? () => {} : () => setListExpanded((v) => !v)}
        collapsed={listPanelCollapsed}
        onToggleCollapsed={
          isPopupActive
            ? () => {}
            : () => {
                // Opening the list from its "Show Results" bar closes the dropdown (on web that
                // tap lands outside the search box, which closes it).
                if (listPanelCollapsed) setDropdownOpen(false);
                setListPanelCollapsed((v) => !v);
              }
        }
        onClinicPress={isPopupActive ? undefined : openClinicPopup}
        isLoadingMore={clinicsLoadingMore}
        totalCount={isSearching ? null : clinicsTotalCount}
        loadError={!isSearching && Boolean(clinicsError)}
        radiusMiles={settings.nearbyRadiusMiles}
        onSuggestClinic={() => router.push('/suggest-clinic')}
        reportGeofenceMeters={settings.reportGeofenceMeters}
        isSearching={isSearching}
        searchQuery={search}
        hasLocation={userLocation != null}
        locating={locating}
        onRetryLocation={() => void loadLocation()}
      />
      <View pointerEvents={isPopupActive ? 'none' : 'auto'}>
        <BottomNav />
      </View>

      {/* The "You're near" card steps aside while search results are showing, so it
          doesn't cover the list. An opened office card always shows. */}
      {reportClinic && (selectedClinic || (!dropdownOpen && search.trim().length < 2 && !pendingPlace && !routeTo)) ? (
        <ProximityPrompt
          clinic={reportClinic}
          variant={selectedClinic ? 'browse' : 'proximity'}
          submitting={promptSubmitting}
          onDismiss={() => {
            if (selectedClinic) {
              setSelectedClinic(null);
              setSelectedClinicCanReport(false);
              return;
            }
            if (nearbyClinic) {
              setDismissedPrompts((prev) => new Set(prev).add(nearbyClinic.id));
              setNearbyClinic(null);
            }
          }}
          canReport={canReportInPrompt}
          onQuickReport={(minutes) => {
            if (!canReportInPrompt) return;
            void submitWaitReport(reportClinic, minutes);
          }}
          onViewOnMap={handleViewOnMap}
        />
      ) : null}

      <ClinicStackPicker clinics={stackPick} onSelect={handleStackSelect} onClose={() => setStackPick(null)} />

      <VerifyCard
        place={pendingPlace}
        userLocation={userLocation}
        adding={addingId != null}
        isDark={isDark}
        onVerify={handleVerify}
        onClose={() => setPendingPlace(null)}
      />

      {/* Full-screen overlay only until the first offices exist — a re-showing overlay
          over data that is already drawn is what made the screen blink on a fresh load. */}
      {(locating || (clinicsLoading && clinics.length === 0)) && (
        <View style={[styles.loadingOverlay, { backgroundColor: isDark ? 'rgba(2,6,23,0.72)' : 'rgba(255,255,255,0.7)' }]}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={[styles.loadingText, { color: isDark ? '#cbd5e1' : '#334155' }]}>
            {locating ? 'Getting your location...' : 'Loading doctor offices...'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  addHereTextWrap: { flex: 1, gap: 2 },
  addHereCoords: { fontSize: 11 },
  addHereCancel: { fontSize: 13, fontWeight: '600' },
  addHereConfirm: { backgroundColor: '#2563eb', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  addHereConfirmText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
    position: 'relative',
  },
  mapContainer: {
    flex: 1,
  },
  routeBanner: {
    position: 'absolute',
    top: SEARCH_CARD_TOP,
    left: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    zIndex: 26,
  },
  routeText: {
    flex: 1,
    gap: 2,
  },
  routeName: {
    fontSize: 14,
    fontWeight: '700',
  },
  routeMeta: {
    fontSize: 12,
  },
  routeClear: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '700',
  },
  searchBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 25,
  },
  addHereBar: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    left: 40,
    right: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    zIndex: 22,
  },
  addHereBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  addHereText: {
    fontSize: 14,
    fontWeight: '700',
  },
  searchCard: {
    position: 'absolute',
    top: SEARCH_CARD_TOP,
    left: 8,
    right: 8,
    backgroundColor: 'white',
    borderRadius: 14,
    borderWidth: 0.7,
    borderColor: '#dbe1e8',
    padding: 6,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    zIndex: 30,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 3,
    paddingLeft: 4,
    backgroundColor: '#fff',
    fontSize: 14,
  },
  citySelect: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d4dbe4',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  citySelectLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  citySelectText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '500',
  },
  cityMenu: {
    borderWidth: 1,
    borderColor: '#d4dbe4',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  cityMenuItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cityMenuItemActive: {
    backgroundColor: '#eff6ff',
  },
  cityMenuText: {
    color: '#334155',
    fontSize: 14,
  },
  cityMenuTextActive: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  resultText: {
    color: '#475569',
    fontSize: 12,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  loadingText: {
    marginTop: 6,
    color: '#334155',
    fontWeight: '600',
  },
});
