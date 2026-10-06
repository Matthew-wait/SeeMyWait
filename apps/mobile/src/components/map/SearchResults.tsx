import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { MedicalPlaceResult } from '@/src/hooks/use-medical-search';
import { haversineDistanceMeters, metersToMiles } from '@/src/lib/distance';
import type { LatLng } from '@/src/lib/geolocation';

type Props = {
  visible: boolean;
  loading: boolean;
  results: MedicalPlaceResult[];
  limited: boolean;
  degraded: boolean;
  isDark: boolean;
  userLocation: LatLng | null;
  onSelect: (result: MedicalPlaceResult) => void;
  onSuggest: () => void;
};

const keyFor = (r: MedicalPlaceResult): string =>
  r.source === 'db' ? `db:${r.id ?? r.name}` : `npi:${r.npi ?? r.name}`;

/** Same wording and rounding as web's formatDistance (SearchResultsDropdown.tsx). */
const formatDistance = (from: LatLng | null, r: MedicalPlaceResult): string | null => {
  if (!from) return null;
  const miles = metersToMiles(haversineDistanceMeters(from, { latitude: r.latitude, longitude: r.longitude }));
  if (!Number.isFinite(miles)) return null;
  return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`;
};

/** Dropdown under the search box — the same rows, states and wording as web's
 *  SearchResultsDropdown. Saved offices (db) tap to open; registry matches (npi)
 *  tap to preview them on the map and confirm before saving. */
export const SearchResults = ({
  visible,
  loading,
  results,
  limited,
  degraded,
  isDark,
  userLocation,
  onSelect,
  onSuggest,
}: Props) => {
  if (!visible) return null;

  const bg = isDark ? '#172033' : '#ffffff';
  const border = isDark ? '#334155' : '#e2e8f0';
  const primary = isDark ? '#f1f5f9' : '#0f172a';
  const muted = isDark ? '#94a3b8' : '#64748b';
  const notice = limited
    ? 'Search limit reached — showing saved offices only.'
    : degraded
      ? 'Registry search unavailable — showing saved offices.'
      : null;

  if (loading) {
    return (
      <View style={[styles.panel, { backgroundColor: bg, borderColor: border }]}>
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={[styles.statusText, { color: muted }]}>Searching doctor offices…</Text>
        </View>
      </View>
    );
  }

  if (results.length === 0) {
    return (
      <View style={[styles.panel, { backgroundColor: bg, borderColor: border }]}>
        <View style={styles.emptyWrap}>
          <Text style={[styles.statusText, { color: muted }]}>{notice ?? 'No doctor offices found for this search.'}</Text>
          <Pressable style={styles.suggestBtn} onPress={onSuggest} accessibilityRole="button" accessibilityLabel="Suggest a doctor office">
            <Feather name="plus" size={12} color="#2563eb" />
            <Text style={styles.suggestBtnText}>Suggest a Doctor Office</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.panel, { backgroundColor: bg, borderColor: border }]}>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll}>
        {results.map((r) => {
          const distance = formatDistance(userLocation, r);
          const isDb = r.source === 'db';
          return (
            <Pressable
              key={keyFor(r)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => onSelect(r)}
              accessibilityRole="button"
              accessibilityLabel={r.name}>
              <View style={[styles.rowIcon, isDb ? styles.rowIconDb : styles.rowIconNpi]}>
                {isDb ? (
                  <MaterialCommunityIcons name="stethoscope" size={15} color="#2563eb" />
                ) : (
                  <Feather name="map-pin" size={14} color="#2563eb" />
                )}
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowName, { color: primary }]} numberOfLines={1}>{r.name}</Text>
                <Text style={[styles.rowMeta, { color: muted }]} numberOfLines={1}>
                  {r.address}
                  {distance ? <Text style={styles.rowDist}>{` · ${distance}`}</Text> : null}
                </Text>
              </View>
              {!isDb ? (
                <View style={styles.verifyBadge}>
                  <Text style={styles.verifyText}>VERIFY</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 96,
    left: 8,
    right: 8,
    borderRadius: 14,
    borderWidth: 1,
    maxHeight: 288,
    overflow: 'hidden',
    zIndex: 40,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  scroll: { maxHeight: 288 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  statusText: { fontSize: 12 },
  emptyWrap: { paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  notice: { paddingHorizontal: 14, paddingTop: 8, fontSize: 11, color: '#b45309' },
  suggestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(37,99,235,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  suggestBtnText: { fontSize: 11, fontWeight: '700', color: '#2563eb' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rowPressed: { backgroundColor: 'rgba(148,163,184,0.15)' },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  rowIconDb: { backgroundColor: 'rgba(37,99,235,0.1)' },
  rowIconNpi: { backgroundColor: 'rgba(59,130,246,0.1)' },
  rowText: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 12, fontWeight: '700' },
  rowMeta: { fontSize: 11, marginTop: 2 },
  rowDist: { color: '#94a3b8' },
  verifyBadge: {
    alignSelf: 'center',
    borderRadius: 6,
    backgroundColor: 'rgba(59,130,246,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  verifyText: { fontSize: 9, fontWeight: '800', color: '#2563eb', letterSpacing: 0.4 },
});
