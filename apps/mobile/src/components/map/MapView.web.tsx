import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ClinicWithMeta } from '@/src/hooks/use-clinics';
import type { LatLng } from '@/src/lib/geolocation';

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
  candidate?: LatLng | null;
  onMapPress?: (coord: LatLng) => void;
  onPoiPress?: (poi: { placeId?: string; name?: string; coordinate: LatLng }) => void;
  route?: [number, number][] | null;
  onStackPress?: (clinics: ClinicWithMeta[]) => void;
  onBoundsChange?: (bounds: MapBounds) => void;
  /** A focused search result: its pin in its wait colour, and the view moves to it. */
  focused?: { latitude: number; longitude: number; color: string } | null;
};

/** Same cap as the web viewport query (clinics_in_view). */
const MAX_VISIBLE_PINS = 1000;

const HTML = buildLeafletMapHtml();

/** Web: same Leaflet map as native, mounted in an iframe (react-native-webview has
 *  no web implementation) instead of a WebView — same HTML, same behavior. */
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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  const pendingRef = useRef<RnToMapMessage[]>([]);
  const clinicsById = useMemo(() => new Map(clinics.map((c) => [c.id, c])), [clinics]);

  const send = (msg: RnToMapMessage) => {
    const win = iframeRef.current?.contentWindow;
    if (!readyRef.current || !win) {
      pendingRef.current.push(msg);
      return;
    }
    win.postMessage(msg, '*');
  };

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const msg = event.data as MapToRnMessage;
      if (!msg || !msg.type) return;
      if (msg.type === 'ready') {
        readyRef.current = true;
        const win = iframeRef.current?.contentWindow;
        for (const queued of pendingRef.current) win?.postMessage(queued, '*');
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
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [clinicsById, onClinicPress, onMapPress, onStackPress, onBoundsChange]);

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

  return (
    <View style={styles.mapWrap}>
      <iframe
        ref={iframeRef}
        srcDoc={HTML}
        title="Map"
        style={{ border: 'none', width: '100%', height: '100%', display: 'block' }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  mapWrap: {
    flex: 1,
  },
});
