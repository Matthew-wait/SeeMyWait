import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { viewOnMapUrl } from '@seemywait/core';

import type { MedicalPlaceResult } from '@/src/hooks/use-medical-search';
import { haversineDistanceMeters, metersToMiles } from '@/src/lib/distance';
import type { LatLng } from '@/src/lib/geolocation';

type Props = {
  place: MedicalPlaceResult | null;
  userLocation: LatLng | null;
  adding: boolean;
  isDark: boolean;
  onVerify: (place: MedicalPlaceResult) => void;
  onClose: () => void;
};

/**
 * Bottom sheet shown when an NPPES registry result is tapped. The place is NOT
 * saved yet — its pin is dropped on the SeeMyWait map above this card so the
 * user can confirm the location, then "Verify & Add" saves it.
 */
export const VerifyCard = ({ place, userLocation, adding, isDark, onVerify, onClose }: Props) => {
  if (!place) return null;

  const card = isDark ? '#111c30' : '#ffffff';
  const primary = isDark ? '#f1f5f9' : '#0f172a';
  const secondary = isDark ? '#cbd5e1' : '#475569';
  const chipBg = isDark ? '#1e293b' : '#f1f5f9';

  const miles = userLocation
    ? metersToMiles(haversineDistanceMeters(userLocation, { latitude: place.latitude, longitude: place.longitude }))
    : null;

  const openInMaps = () => {
    void Linking.openURL(viewOnMapUrl(place.name, place.latitude, place.longitude)).catch(() => {});
  };

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={[styles.card, { backgroundColor: card }]} accessibilityViewIsModal>
        <Pressable
          style={[styles.closeBtn, { backgroundColor: chipBg }]}
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Cancel">
          <Feather name="x" size={18} color={primary} />
        </Pressable>

        <View style={styles.header}>
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="map-marker-check" size={22} color="#fff" />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: primary }]} numberOfLines={2}>
              {place.name}
            </Text>
            <Text style={[styles.hint, { color: secondary }]}>Check the pin on the map — is this the right place?</Text>
          </View>
        </View>

        {place.address ? (
          <View style={styles.addrRow}>
            <Feather name="map-pin" size={13} color={secondary} />
            <Text style={[styles.addr, { color: secondary }]} numberOfLines={3}>
              {place.address}
            </Text>
          </View>
        ) : null}

        {miles != null && Number.isFinite(miles) ? (
          <Text style={[styles.dist, { color: secondary }]}>
            {miles < 0.1 ? 'You are here' : `${miles.toFixed(1)} mi away`}
          </Text>
        ) : null}

        <Pressable
          style={[styles.verifyBtn, adding && styles.btnDisabled]}
          disabled={adding}
          onPress={() => onVerify(place)}
          accessibilityRole="button"
          accessibilityLabel="Verify and add to SeeMyWait">
          {adding ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Feather name="check" size={16} color="#fff" />
              <Text style={styles.verifyText}>Verify &amp; Add</Text>
            </>
          )}
        </Pressable>

        <Pressable
          style={styles.mapsLink}
          onPress={openInMaps}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="View on Google Maps">
          <Feather name="external-link" size={13} color={secondary} />
          <Text style={[styles.mapsLinkText, { color: secondary }]}>View on Google Maps</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, bottom: 88, alignItems: 'center', zIndex: 65 },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  header: { flexDirection: 'row', gap: 12, marginRight: 38, marginBottom: 10 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, fontWeight: '800' },
  hint: { fontSize: 12, marginTop: 3, lineHeight: 16 },
  addrRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 6 },
  addr: { flex: 1, fontSize: 12, lineHeight: 16 },
  dist: { fontSize: 12, fontWeight: '600', marginBottom: 12 },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 13,
    marginBottom: 10,
  },
  btnDisabled: { opacity: 0.7 },
  verifyText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  mapsLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  mapsLinkText: { fontSize: 13, fontWeight: '600' },
});
