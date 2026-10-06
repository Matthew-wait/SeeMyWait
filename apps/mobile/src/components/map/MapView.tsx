import { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import type { ClinicWithMeta } from '@/src/hooks/use-clinics';
import type { LatLng } from '@/src/lib/geolocation';

import { FIND_ME_MAP_LAYOUT, ZOOM_FIND_ME_GAP } from '@/src/components/map/FindMeButton';
import { buildLeafletMapHtml, type MapBounds, type MapClinicPoint, type MapToRnMessage, type RnToMapMessage } from '@/src/components/map/leaflet-map-html';
import { waitTierVisual } from '@/src/lib/wait-tier-style';

type Props = {
  clinics: ClinicWithMeta[];
  userLocation: LatLng | null;
  searchArea: { center: LatLng; radiusMeters: number } | null;
  nearbyRadiusMeters: number;
  centerOn: (LatLng & { zoom?: number }) | null;
  onCenterApplied: () => void;
  onClinicPress?: (clinic: ClinicWithMeta) => void;
  /** An unsaved search result being previewed for verification (distinct pin). */
  candidate?: LatLng | null;
  /** Tap on an empty map point (for "add a place here"). */
  onMapPress?: (coord: LatLng) => void;
  /** Kept for API parity with the old native-map version; Leaflet has no POI layer, so unused. */
  onPoiPress?: (poi: { placeId?: string; name?: string; coordinate: LatLng }) => void;
  /** Driving route polyline to draw (from the user to a chosen office), or null. */
  route?: [number, number][] | null;
  /** Tap on a pin that stands for 2+ offices at the same spot. */
  onStackPress?: (clinics: ClinicWithMeta[]) => void;
  /** Visible map rectangle after each pan/zoom — the list follows this, like web. */
  onBoundsChange?: (bounds: MapBounds) => void;
  /** A focused search result: its pin in its wait colour, and the view moves to it. */
  focused?: { latitude: number; longitude: number; color: string } | null;
};

/** Same cap as the web viewport query (clinics_in_view). */
const MAX_VISIBLE_PINS = 1000;

const HTML = buildLeafletMapHtml();

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
  route,
  onStackPress,
  onBoundsChange,
  focused = null,
}: Props) => {
  const webRef = useRef<WebView>(null);
  const readyRef = useRef(false);
  const pendingRef = useRef<RnToMapMessage[]>([]);
  const clinicsById = useMemo(() => new Map(clinics.map((c) => [c.id, c])), [clinics]);

  const send = (msg: RnToMapMessage) => {
    if (!readyRef.current) {
      pendingRef.current.push(msg);
      return;
    }
    webRef.current?.postMessage(JSON.stringify(msg));
  };

  const visibleClinics = useMemo(() => {
    const valid = clinics.filter((c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude));
    return valid.slice(0, MAX_VISIBLE_PINS);
  }, [clinics]);

  const clinicPoints = useMemo<MapClinicPoint[]>(
    () =>
      visibleClinics.map((c) => ({
        id: c.id,
        lat: c.latitude,
        lng: c.longitude,
        name: c.name || c.doctor_name || 'Clinic',
        address: c.address,
        pin: waitTierVisual(c.latestWaitMinutes).pin,
      })),
    [visibleClinics]
  );

  // Offices arrive in batches; rebuilding every marker per batch re-renders the
  // whole layer repeatedly on a fresh load. Wait for the stream to settle first.
  useEffect(() => {
    const id = window.setTimeout(() => send({ type: 'setClinics', clinics: clinicPoints }), 250);
    return () => window.clearTimeout(id);
  }, [clinicPoints]);

  useEffect(() => {
    send({ type: 'setUserLocation', location: userLocation ? { lat: userLocation.latitude, lng: userLocation.longitude } : null });
  }, [userLocation]);

  useEffect(() => {
    send({
      type: 'setSearchArea',
      area: searchArea
        ? { lat: searchArea.center.latitude, lng: searchArea.center.longitude, radiusMeters: searchArea.radiusMeters }
        : null,
    });
  }, [searchArea]);

  useEffect(() => {
    send({ type: 'setNearbyRadius', radiusMeters: nearbyRadiusMeters });
  }, [nearbyRadiusMeters]);

  useEffect(() => {
    send({ type: 'setCandidate', candidate: candidate ? { lat: candidate.latitude, lng: candidate.longitude } : null });
  }, [candidate]);

  useEffect(() => {
    send({ type: 'setRoute', geometry: route ?? null });
  }, [route]);

  useEffect(() => {
    send({
      type: 'setFocus',
      focus: focused ? { lat: focused.latitude, lng: focused.longitude, color: focused.color } : null,
    });
  }, [focused]);

  useEffect(() => {
    if (!centerOn) return;
    send({ type: 'centerOn', location: { lat: centerOn.latitude, lng: centerOn.longitude }, zoom: centerOn.zoom ?? 16 });
    onCenterApplied();
  }, [centerOn, onCenterApplied]);

  const handleMessage = (event: WebViewMessageEvent) => {
    let msg: MapToRnMessage;
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'ready') {
      readyRef.current = true;
      for (const queued of pendingRef.current) webRef.current?.postMessage(JSON.stringify(queued));
      pendingRef.current = [];
      return;
    }
    if (msg.type === 'clinicPress') {
      const clinic = clinicsById.get(msg.id);
      if (clinic) onClinicPress?.(clinic);
      return;
    }
    if (msg.type === 'mapPress') {
      onMapPress?.({ latitude: msg.lat, longitude: msg.lng });
      return;
    }
    if (msg.type === 'stackPress') {
      const stack = msg.ids.map((id) => clinicsById.get(id)).filter((c): c is ClinicWithMeta => Boolean(c));
      if (stack.length) onStackPress?.(stack);
      return;
    }
    if (msg.type === 'boundsChanged') onBoundsChange?.(msg.bounds);
  };

  return (
    <View style={styles.mapWrap}>
      <WebView
        ref={webRef}
        source={{ html: HTML }}
        style={StyleSheet.absoluteFill}
        originWhitelist={['*']}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
};

const styles = StyleSheet.create({
  mapWrap: {
    flex: 1,
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
