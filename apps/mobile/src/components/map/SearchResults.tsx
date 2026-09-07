import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { MedicalPlaceResult } from '@/src/hooks/use-medical-search';
import { haversineDistanceMeters, metersToMiles } from '@/src/lib/distance';
import type { LatLng } from '@/src/lib/geolocation';

type Props = {
  visible: boolean;
  loading: boolean;
  query: string;
  results: MedicalPlaceResult[];
  limited: boolean;
  degraded: boolean;
  isDark: boolean;
  userLocation: LatLng | null;
  addingPlaceId: string | null;
  onSelect: (result: MedicalPlaceResult) => void;
  onSuggest: () => void;
};

const keyFor = (r: MedicalPlaceResult): string =>
  r.source === 'db' ? `db-${r.id ?? r.name}` : `npi-${r.npi ?? r.name}`;

const distanceLabel = (from: LatLng | null, r: MedicalPlaceResult): string | null => {
  if (!from) return null;
  const miles = metersToMiles(haversineDistanceMeters(from, { latitude: r.latitude, longitude: r.longitude }));
  if (!Number.isFinite(miles)) return null;
  return miles < 0.1 ? 'here' : `${miles.toFixed(1)} mi`;
};

/** Dropdown under the search box. Tap a DB result to open it; tap a registry
 *  (NPI) result to confirm it on the map before saving. */
export const SearchResults = ({
  visible,
  loading,
  query,
  results,
  limited,
  degraded,
  isDark,
  userLocation,
  addingPlaceId,
  onSelect,
  onSuggest,
}: Props) => {
  if (!visible) return null;

  const hasQuery = query.trim().length >= 2;
  const nothing = !loading && results.length === 0;

  const bg = isDark ? '#172033' : '#ffffff';
  const border = isDark ? '#334155' : '#dbe1e8';
  const title = isDark ? '#94a3b8' : '#64748b';
  const primary = isDark ? '#f1f5f9' : '#0f172a';
  const secondary = isDark ? '#cbd5e1' : '#475569';

  return (
    <View style={[styles.panel, { backgroundColor: bg, borderColor: border }]}>
      <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll} contentContainerStyle={styles.scrollBody}>
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={[styles.loadingText, { color: secondary }]}>Searching…</Text>
          </View>
        ) : null}

        {results.map((r) => {
          const dist = distanceLabel(userLocation, r);
          const saving = r.source === 'npi' && !!r.npi && addingPlaceId === r.npi;
          return (
            <Pressable
              key={keyFor(r)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              disabled={saving}
              onPress={() => onSelect(r)}
              accessibilityRole="button"
              accessibilityLabel={r.name}>
              <Feather name="map-pin" size={16} color="#16a34a" style={styles.rowIcon} />
              <View style={styles.rowText}>
                <Text style={[styles.rowName, { color: primary }]} numberOfLines={1}>
                  {r.name}
                </Text>
                {r.address ? (
                  <Text style={[styles.rowMeta, { color: secondary }]} numberOfLines={1}>
                    {r.address}
                  </Text>
                ) : null}
              </View>
              {saving ? (
                <ActivityIndicator size="small" color="#2563eb" />
              ) : (
                <View style={styles.rowRight}>
                  {dist ? <Text style={[styles.rowDist, { color: title }]}>{dist}</Text> : null}
                  <Feather name="chevron-right" size={16} color={title} />
                </View>
              )}
            </Pressable>
          );
        })}

        {nothing && hasQuery ? (
          <View style={styles.emptyWrap}>
            <Text style={[styles.emptyText, { color: secondary }]}>
              {limited
                ? 'Too many searches just now — showing saved offices only. Try again shortly.'
                : degraded
                  ? 'Registry search is unavailable right now. Showing saved offices only.'
                  : `No medical places found for “${query.trim()}”.`}
            </Text>
            <Pressable
              style={styles.suggestBtn}
              onPress={onSuggest}
              accessibilityRole="button"
              accessibilityLabel="Suggest a doctor office">
              <Feather name="plus-circle" size={15} color="#fff" />
              <Text style={styles.suggestBtnText}>Suggest a Doctor Office</Text>
            </Pressable>
          </View>
        ) : null}

        {!nothing && (limited || degraded) ? (
          <Text style={[styles.noticeText, { color: title }]}>
            {limited ? 'Search limit reached — registry results paused briefly.' : 'Some registry results may be unavailable.'}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 92,
    left: 8,
    right: 8,
    borderRadius: 14,
    borderWidth: 1,
    maxHeight: 320,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    zIndex: 40,
    overflow: 'hidden',
  },
  scroll: { maxHeight: 320 },
  scrollBody: { padding: 8 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 6 },
  loadingText: { fontSize: 13, fontWeight: '500' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  rowPressed: { backgroundColor: 'rgba(148,163,184,0.16)' },
  rowIcon: { width: 18, textAlign: 'center' },
  rowText: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 14, fontWeight: '700' },
  rowMeta: { fontSize: 11, marginTop: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowDist: { fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },
  emptyWrap: { paddingVertical: 16, paddingHorizontal: 8, alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  suggestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  suggestBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  noticeText: { fontSize: 10, textAlign: 'center', paddingTop: 8, paddingBottom: 2 },
});
