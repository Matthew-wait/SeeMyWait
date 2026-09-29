import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

import { ClinicListPanel } from '@/src/components/map/ClinicListPanel';
import { FindMeButton } from '@/src/components/map/FindMeButton';
import { MapLegend } from '@/src/components/map/MapLegend';
import { MapView } from '@/src/components/map/MapView';
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
import { maxAccuracyMetersForReport, REPORT_WAIT_GEOFENCE_METERS } from '@/src/lib/report-wait-geofence';
import { supabase } from '@/src/lib/supabase';
import { showToast } from '@/src/lib/toast';
import { computeExpiryTimeFromMinutesIso, waitMinutesToCategory } from '@/src/lib/wait-time-report';

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

export const IndexPage = () => {
  const router = useRouter();
  const { isDark } = useTheme();
  const { settings } = useAppSettings();

  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [cityFilter] = useState<CityFilter>('all');
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const {
    clinics,
    loading: clinicsLoading,
    isLoadingMore: clinicsLoadingMore,
    refresh: refreshClinics,
  } = useClinics(
    settings.reportCooldownMinutes,
    userLocation?.latitude,
    userLocation?.longitude,
    settings.nearbyRadiusMiles
  );
  const [locating, setLocating] = useState(false);
  const [centerOn, setCenterOn] = useState<LatLng | null>(null);
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

  // Medical search (DB-first, then Google) + verify-then-add.
  const [searchActive, setSearchActive] = useState(false);
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
      .filter((item) => item.distance <= REPORT_WAIT_GEOFENCE_METERS)
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

  const nearbyClinics = useMemo(() => {
    if (!userLocation) return displayedClinics;
    return [...displayedClinics].sort((a, b) => {
      const aRoute = routeDistanceByClinicId[a.id];
      const bRoute = routeDistanceByClinicId[b.id];
      if (typeof aRoute === 'number' && typeof bRoute === 'number') return aRoute - bRoute;
      if (typeof aRoute === 'number') return -1;
      if (typeof bRoute === 'number') return 1;
      const aDirect = haversineDistanceMeters(userLocation, { latitude: a.latitude, longitude: a.longitude });
      const bDirect = haversineDistanceMeters(userLocation, { latitude: b.latitude, longitude: b.longitude });
      return aDirect - bDirect;
    });
  }, [displayedClinics, routeDistanceByClinicId, userLocation]);

  /** Driving distance ≤ app_settings.nearby_radius_miles when known; haversine ≤ radius while route pending/unavailable. */
  const clinicsWithinDrivingRadius = useMemo(() => {
    const radiusMeters = settings.nearbyRadiusMiles * 1609.34;
    if (cityFilter !== 'all') return nearbyClinics;
    if (!userLocation) return nearbyClinics;

    return nearbyClinics.filter((clinic) => {
      const routeM = routeDistanceByClinicId[clinic.id];
      if (typeof routeM === 'number') return routeM <= radiusMeters;
      const airM = haversineDistanceMeters(userLocation, {
        latitude: clinic.latitude,
        longitude: clinic.longitude,
      });
      return airM <= radiusMeters;
    });
  }, [cityFilter, nearbyClinics, userLocation, settings.nearbyRadiusMiles, routeDistanceByClinicId]);

  const hasActiveSearchInput = searchFocused || search.trim().length > 0;

  // Map shows ALL active clinics with valid coordinates (so a pin renders wherever
  // you pan — e.g. a Miami clinic while you're in Islamabad). The nearby list stays
  // distance-filtered/sorted separately.
  const mapClinics = useMemo(
    () => clinics.filter((c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude)),
    [clinics]
  );

  useEffect(() => {
    if (hasActiveSearchInput) {
      setListPanelCollapsed(true);
    }
  }, [hasActiveSearchInput]);

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

  const reportClinic = useMemo(
    () => selectedClinic ?? nearbyClinic,
    [nearbyClinic, selectedClinic]
  );
  const canReportInPrompt = selectedClinic ? selectedClinicCanReport : Boolean(nearbyClinic);
  // Any blocking overlay (report card OR the verify card) suppresses map/search/nav taps.
  const isPopupActive = Boolean(reportClinic) || pendingPlace != null;

  const submitWaitReport = useCallback(
    async (clinic: ClinicWithMeta, minutes: number) => {
      setPromptSubmitting(true);
      try {
        const livePos = await getCurrentPosition();
        const distance = haversineDistanceMeters(livePos.coords, {
          latitude: clinic.latitude,
          longitude: clinic.longitude,
        });
        if (distance > REPORT_WAIT_GEOFENCE_METERS) {
          showToast(
            `You must be within ${REPORT_WAIT_GEOFENCE_METERS} m of the clinic to report (GPS check).`
          );
          setPromptSubmitting(false);
          return;
        }
        const maxAccuracyM = maxAccuracyMetersForReport(REPORT_WAIT_GEOFENCE_METERS);
        if ((livePos.accuracy ?? 999) > maxAccuracyM) {
          showToast(`GPS accuracy must be about ${maxAccuracyM} m or better to report near this clinic.`);
          setPromptSubmitting(false);
          return;
        }

        const fingerprint = await getDeviceFingerprint();
        const windowStart = new Date(Date.now() - settings.reportCooldownMinutes * 60 * 1000).toISOString();
        const duplicateCheck = await supabase
          .from('wait_time_reports')
          .select('id')
          .eq('clinic_id', clinic.id)
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
          expiry_time: computeExpiryTimeFromMinutesIso(settings.reportCooldownMinutes),
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
        } else if (__DEV__ && raw) {
          showToast(`Report failed: ${raw.length > 100 ? `${raw.slice(0, 97)}…` : raw}`);
        } else {
          showToast('Failed to submit report. Try again.');
        }
      } finally {
        setPromptSubmitting(false);
      }
    },
    [refreshClinics, settings.reportCooldownMinutes]
  );

  const openClinicPopup = useCallback(
    (clinic: ClinicWithMeta) => {
      const canReport =
        userLocation != null &&
        haversineDistanceMeters(userLocation, {
          latitude: clinic.latitude,
          longitude: clinic.longitude,
        }) <= REPORT_WAIT_GEOFENCE_METERS;
      setSelectedClinic(clinic);
      setSelectedClinicCanReport(canReport);
    },
    [userLocation]
  );

  // Tapping a result recenters the map. A DB result (already saved) opens its
  // clinic card directly. A Google result is NOT saved yet — it's previewed on
  // our map with a pin so the user can confirm the location, then "Verify & Add".
  const handleSelectResult = useCallback(
    (result: MedicalPlaceResult) => {
      setSearchActive(false);
      setSearch('');
      setCenterOn({ latitude: result.latitude, longitude: result.longitude });

      if (result.source === 'db') {
        const existing = clinics.find((c) => c.id === result.id);
        if (existing) openClinicPopup(existing);
        return;
      }
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

  // Tap an empty map point → show a "add here" affordance (item 7).
  const handleMapPress = useCallback(
    (coord: LatLng) => {
      if (isPopupActive) return;
      setMapTapPoint(coord);
    },
    [isPopupActive]
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

  const showSearchResults = searchActive && !isPopupActive && search.trim().length >= 2;

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
              : mapTapPoint
          }
          onMapPress={handleMapPress}
          onPoiPress={handlePoiPress}
        />

        {showSearchResults ? (
          <Pressable
            style={styles.searchBackdrop}
            onPress={() => setSearchActive(false)}
            accessibilityLabel="Close search results"
          />
        ) : null}

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
              style={[styles.input, { backgroundColor: isDark ? '#172033' : '#fff', color: isDark ? '#e2e8f0' : '#111827' }]}
              placeholder="Search doctor office or location..."
              value={search}
              onChangeText={
                isPopupActive
                  ? undefined
                  : (text) => {
                      setSearch(text);
                      setSearchActive(true);
                    }
              }
              onFocus={
                isPopupActive
                  ? undefined
                  : () => {
                      setSearchFocused(true);
                      setSearchActive(true);
                    }
              }
              onBlur={isPopupActive ? undefined : () => setSearchFocused(false)}
              editable={!isPopupActive}
              placeholderTextColor={isDark ? '#94a3b8' : '#4b5563'}
            />
            {search.length > 0 && !isPopupActive ? (
              <Pressable
                onPress={() => {
                  setSearch('');
                  setSearchActive(false);
                }}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Clear search">
                <Feather name="x" size={16} color={isDark ? '#94a3b8' : '#64748b'} />
              </Pressable>
            ) : null}
          </View>
          {!hasActiveSearchInput ? (
            <>
              {/* City dropdown filter temporarily disabled. Keep default cityFilter as "all". */}
            </>
          ) : null}
        </View>

        <SearchResults
          visible={showSearchResults}
          loading={medSearch.loading}
          query={search}
          results={medSearch.results}
          limited={medSearch.limited}
          degraded={medSearch.degraded}
          isDark={isDark}
          userLocation={userLocation}
          addingPlaceId={addingId}
          onSelect={handleSelectResult}
          onSuggest={() => router.push('/suggest-clinic')}
        />

        <FindMeButton onPress={() => void loadLocation()} loading={locating} disabled={isPopupActive} />
        <View pointerEvents={isPopupActive ? 'none' : 'auto'}>
          <MapLegend top={listPanelCollapsed ? LEGEND_TOP_WHEN_PANEL_CLOSED : LEGEND_TOP_WHEN_PANEL_OPEN} />
        </View>

        {mapTapPoint && !isPopupActive ? (
          <View style={[styles.addHereBar, { backgroundColor: isDark ? '#172033' : '#ffffff', borderColor: isDark ? '#334155' : '#dbe1e8' }]}>
            <Pressable style={styles.addHereBtn} onPress={() => void handleAddHere()} accessibilityRole="button" accessibilityLabel="Add a doctor office here">
              <Feather name="plus-circle" size={16} color="#2563eb" />
              <Text style={[styles.addHereText, { color: isDark ? '#e2e8f0' : '#0f172a' }]}>Add a doctor office here</Text>
            </Pressable>
            <Pressable onPress={() => setMapTapPoint(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cancel">
              <Feather name="x" size={16} color={isDark ? '#94a3b8' : '#64748b'} />
            </Pressable>
          </View>
        ) : null}
      </View>

      <ClinicListPanel
        clinics={clinicsWithinDrivingRadius}
        userLocation={userLocation}
        routeDistanceByClinicId={routeDistanceByClinicId}
        routeDistanceSourceByClinicId={routeDistanceSourceByClinicId}
        expanded={listExpanded}
        onToggleExpanded={isPopupActive ? () => {} : () => setListExpanded((v) => !v)}
        collapsed={listPanelCollapsed}
        onToggleCollapsed={isPopupActive ? () => {} : () => setListPanelCollapsed((v) => !v)}
        onClinicPress={isPopupActive ? undefined : openClinicPopup}
        isLoadingMore={clinicsLoadingMore}
      />
      <View pointerEvents={isPopupActive ? 'none' : 'auto'}>
        <BottomNav />
      </View>

      {reportClinic ? (
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
        />
      ) : null}

      <VerifyCard
        place={pendingPlace}
        userLocation={userLocation}
        adding={addingId != null}
        isDark={isDark}
        onVerify={handleVerify}
        onClose={() => setPendingPlace(null)}
      />

      {(clinicsLoading || locating) && (
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
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
    position: 'relative',
  },
  mapContainer: {
    flex: 1,
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
