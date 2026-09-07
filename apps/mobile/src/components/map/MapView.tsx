import { type ComponentType, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ClinicWithMeta } from '@/src/hooks/use-clinics';
import type { LatLng } from '@/src/lib/geolocation';

import { FIND_ME_MAP_LAYOUT, ZOOM_FIND_ME_GAP } from '@/src/components/map/FindMeButton';
import { waitTierVisual } from '@/src/lib/wait-tier-style';

type Props = {
  clinics: ClinicWithMeta[];
  userLocation: LatLng | null;
  searchArea: { center: LatLng; radiusMeters: number } | null;
  nearbyRadiusMeters: number;
  centerOn: LatLng | null;
  onCenterApplied: () => void;
  onClinicPress?: (clinic: ClinicWithMeta) => void;
  /** An unsaved search result being previewed for verification (distinct pin). */
  candidate?: LatLng | null;
  /** Tap on an empty map point (for "add a place here"). */
  onMapPress?: (coord: LatLng) => void;
  /** Tap on a Google POI icon (medical only, since non-medical POIs are hidden). */
  onPoiPress?: (poi: { placeId?: string; name?: string; coordinate: LatLng }) => void;
};

// Hide non-medical POIs (shops, restaurants, landmarks) while keeping medical
// facilities visible + tappable (needed for the tap-to-add flow). Google style.
const MEDICAL_ONLY_MAP_STYLE = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.medical', stylers: [{ visibility: 'on' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
];

const DEFAULT_REGION = {
  latitude: 25.7617,
  longitude: -80.1918,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

type MapHandle = {
  animateToRegion: (region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }, duration: number) => void;
  fitToCoordinates: (
    points: { latitude: number; longitude: number }[],
    options: {
      edgePadding: { top: number; right: number; left: number; bottom: number };
      animated: boolean;
    }
  ) => void;
};

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type MapsParts = {
  NativeMap: ComponentType<any>;
  NativeCircle: ComponentType<any>;
  NativeMarker: ComponentType<any>;
  googleProvider?: string;
};

export const MapView = ({
  clinics,
  userLocation,
  searchArea,
  nearbyRadiusMeters,
  centerOn,
  onCenterApplied,
  onClinicPress,
  candidate,
  onMapPress,
  onPoiPress,
}: Props) => {
  const mapRef = useRef<MapHandle | null>(null);
  const currentRegionRef = useRef<Region>(DEFAULT_REGION);
  const [mapsParts, setMapsParts] = useState<MapsParts | null>(null);

  useEffect(() => {
    let mounted = true;
    void import('react-native-maps')
      .then((mapsModule) => {
        if (!mounted || !mapsModule.default || !mapsModule.Circle || !mapsModule.Marker) return;
        setMapsParts({
          NativeMap: mapsModule.default,
          NativeCircle: mapsModule.Circle,
          NativeMarker: mapsModule.Marker,
          googleProvider: mapsModule.PROVIDER_GOOGLE,
        });
      })
      .catch(() => {
        setMapsParts(null);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const region = useMemo(() => {
    if (centerOn) {
      return {
        latitude: centerOn.latitude,
        longitude: centerOn.longitude,
        // Street-level zoom, close to the Google Maps app's "my location".
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      };
    }
    return DEFAULT_REGION;
  }, [centerOn]);

  useEffect(() => {
    if (!centerOn || !mapRef.current) return;
    mapRef.current.animateToRegion(region, 350);
    onCenterApplied();
  }, [centerOn, onCenterApplied, region]);

  useEffect(() => {
    if (!mapRef.current || clinics.length === 0) return;
    if (searchArea) {
      mapRef.current.animateToRegion(
        {
          latitude: searchArea.center.latitude,
          longitude: searchArea.center.longitude,
          latitudeDelta: Math.max(0.03, searchArea.radiusMeters / 40000),
          longitudeDelta: Math.max(0.03, searchArea.radiusMeters / 40000),
        },
        450
      );
      return;
    }
    if (!userLocation && clinics.length > 1) {
      mapRef.current.fitToCoordinates(
        clinics.slice(0, 100).map((clinic) => ({
          latitude: clinic.latitude,
          longitude: clinic.longitude,
        })),
        {
          edgePadding: { top: 160, right: 30, left: 30, bottom: 170 },
          animated: true,
        }
      );
    }
  }, [clinics, searchArea, userLocation]);

  // Region-delta zoom works identically on Google (Android) and Apple (iOS)
  // providers, unlike camera.zoom which is unreliable on Apple Maps.
  const MIN_DELTA = 0.002;
  const MAX_DELTA = 60;

  const scaleZoom = (factor: number) => {
    if (!mapRef.current) return;
    const r = currentRegionRef.current;
    const next: Region = {
      latitude: r.latitude,
      longitude: r.longitude,
      latitudeDelta: Math.min(MAX_DELTA, Math.max(MIN_DELTA, r.latitudeDelta * factor)),
      longitudeDelta: Math.min(MAX_DELTA, Math.max(MIN_DELTA, r.longitudeDelta * factor)),
    };
    currentRegionRef.current = next;
    mapRef.current.animateToRegion(next, 250);
  };

  const zoomIn = () => scaleZoom(0.5);
  const zoomOut = () => scaleZoom(2);

  if (!mapsParts) {
    return (
      <View style={styles.mapFallback}>
        <Text style={styles.fallbackTitle}>Map preview mode</Text>
        <Text style={styles.fallbackText}>Install a dev build to enable native maps.</Text>
        <Text style={styles.fallbackText}>Clinics visible: {clinics.length}</Text>
        {searchArea ? (
          <Text style={styles.fallbackText}>Search radius: {Math.round(searchArea.radiusMeters)} m</Text>
        ) : null}
      </View>
    );
  }

  const { NativeMap, NativeCircle, NativeMarker } = mapsParts;

  // PROVIDER_DEFAULT: Apple Maps on iOS (no key, no cost), Google Maps SDK on
  // Android (free/unlimited). Avoids needing a "Maps SDK for iOS" key. All
  // Places/Geocoding calls go through the medical-search edge function, not here.
  const provider = undefined;

  return (
    <View style={styles.mapWrap}>
      <NativeMap
        ref={(instance: unknown) => {
          mapRef.current = instance as MapHandle | null;
        }}
        style={StyleSheet.absoluteFill}
        provider={provider}
        mapType="standard"
        userInterfaceStyle="light"
        customMapStyle={MEDICAL_ONLY_MAP_STYLE}
        initialRegion={region}
        onRegionChangeComplete={(nextRegion: Region) => {
          currentRegionRef.current = nextRegion;
        }}
        onPress={(e: any) => {
          const c = e?.nativeEvent?.coordinate;
          // A POI tap also fires onPress with an action of 'marker'/'poi-click';
          // ignore those here so onPoiPress owns POI taps.
          if (e?.nativeEvent?.action === 'poi-click' || e?.nativeEvent?.placeId) return;
          if (c && Number.isFinite(c.latitude) && Number.isFinite(c.longitude)) {
            onMapPress?.({ latitude: c.latitude, longitude: c.longitude });
          }
        }}
        onPoiClick={(e: any) => {
          const n = e?.nativeEvent;
          const c = n?.coordinate;
          if (c && Number.isFinite(c.latitude) && Number.isFinite(c.longitude)) {
            onPoiPress?.({
              placeId: typeof n?.placeId === 'string' ? n.placeId : undefined,
              name: typeof n?.name === 'string' ? n.name : undefined,
              coordinate: { latitude: c.latitude, longitude: c.longitude },
            });
          }
        }}
        showsCompass={false}
        showsMyLocationButton={false}
        showsUserLocation={false}
        zoomEnabled
        scrollEnabled
        zoomTapEnabled
        pitchEnabled={false}
        rotateEnabled={false}>
        {userLocation ? (
          <>
            <NativeCircle
              center={userLocation}
              radius={120}
              fillColor="rgba(14,165,233,0.15)"
              strokeColor="rgba(14,165,233,0.55)"
              strokeWidth={1.2}
            />
            {/* Small red dot marking the exact user location */}
            <NativeCircle center={userLocation} radius={7} fillColor="#ef4444" strokeColor="#ef4444" strokeWidth={1} />
          </>
        ) : null}
        {searchArea ? (
          <NativeCircle
            center={searchArea.center}
            radius={searchArea.radiusMeters}
            fillColor="rgba(59,130,246,0.12)"
            strokeColor="rgba(59,130,246,0.6)"
            strokeWidth={2}
          />
        ) : null}
        {userLocation && !searchArea ? (
          <NativeCircle
            center={userLocation}
            radius={nearbyRadiusMeters}
            fillColor="rgba(59,130,246,0.07)"
            strokeColor="rgba(37,99,235,0.65)"
            strokeWidth={1.8}
          />
        ) : null}
        {clinics
          .filter((c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude))
          .map((clinic) => {
            const tier = waitTierVisual(clinic.latestWaitMinutes);
            // NativeMarker sometimes doesn't repaint pinColor if key doesn't change.
            return (
              <NativeMarker
                key={`${clinic.id}-${tier.pin}`}
                coordinate={{ latitude: clinic.latitude, longitude: clinic.longitude }}
                pinColor={tier.pin}
                title={clinic.name || clinic.doctor_name || 'Clinic'}
                description={clinic.address}
                onPress={() => onClinicPress?.(clinic)}
              />
            );
          })}
        {candidate ? (
          <NativeMarker
            key="candidate"
            coordinate={{ latitude: candidate.latitude, longitude: candidate.longitude }}
            pinColor="#2563eb"
            title="Is this the place?"
            zIndex={999}
          />
        ) : null}
      </NativeMap>
      <View style={styles.zoomCard}>
        <Pressable style={styles.zoomBtn} onPress={zoomIn}>
          <Text style={styles.zoomText}>+</Text>
        </Pressable>
        <Pressable style={styles.zoomBtn} onPress={zoomOut}>
          <Text style={styles.zoomText}>-</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  mapWrap: {
    flex: 1,
  },
  mapFallback: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingTop: 120,
    paddingHorizontal: 16,
    gap: 6,
  },
  fallbackTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '700',
  },
  fallbackText: {
    color: '#374151',
    fontSize: 13,
  },
  zoomCard: {
    position: 'absolute',
    left: FIND_ME_MAP_LAYOUT.left + (FIND_ME_MAP_LAYOUT.size - 36) / 2,
    bottom: FIND_ME_MAP_LAYOUT.bottom + FIND_ME_MAP_LAYOUT.size + ZOOM_FIND_ME_GAP,
    width: 36,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbe1e8',
    zIndex: 10,
  },
  zoomBtn: {
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  zoomText: {
    fontSize: 22,
    lineHeight: 24,
    color: '#0f172a',
  },
});
