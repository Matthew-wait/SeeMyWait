import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ClinicWithMeta } from '@/src/hooks/use-clinics';
import { useTheme } from '@/src/hooks/use-theme';
import { haversineDistanceMeters, metersToMiles } from '@/src/lib/distance';
import type { LatLng } from '@/src/lib/geolocation';
import { waitTierVisual } from '@/src/lib/wait-tier-style';

type Props = {
  clinics: ClinicWithMeta[];
  userLocation: LatLng | null;
  routeDistanceByClinicId: Record<string, number | null>;
  routeDistanceSourceByClinicId: Record<string, 'google' | 'fallback' | 'unavailable' | undefined>;
  expanded: boolean;
  onToggleExpanded: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onClinicPress?: (clinic: ClinicWithMeta) => void;
  /** True while the quick nearby results are shown but the full-radius load is still in flight. */
  isLoadingMore?: boolean;
  /** Exact count inside the nearby radius from the server; falls back to the loaded length. */
  totalCount?: number | null;
  /** Admin report radius (metres); decides which offices show the Report action. */
  reportGeofenceMeters: number;
};

const COLLAPSED_PREVIEW_COUNT = 6;
/** Same as the web list: 50 at a time, Load more adds 50 from the rows already loaded. */
const LIST_BATCH = 50;

export const ClinicListPanel = ({
  clinics,
  userLocation,
  routeDistanceByClinicId,
  routeDistanceSourceByClinicId,
  expanded,
  onToggleExpanded,
  collapsed,
  onToggleCollapsed,
  onClinicPress,
  isLoadingMore = false,
  totalCount = null,
  reportGeofenceMeters,
}: Props) => {
  const { isDark } = useTheme();
  const [listCap, setListCap] = useState<number>(LIST_BATCH);
  const shownCount = totalCount ?? clinics.length;
  const clinicsToShow = expanded ? clinics.slice(0, listCap) : clinics.slice(0, COLLAPSED_PREVIEW_COUNT);
  const [openReportHistoryByClinicId, setOpenReportHistoryByClinicId] = useState<Record<string, boolean>>({});
  const formatReportedTime = (iso: string): string => {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (collapsed) {
    return (
      <Pressable
        style={[
          styles.collapsedBar,
          { backgroundColor: isDark ? '#172033' : 'white', borderColor: isDark ? '#334155' : '#dbe3ec' },
        ]}
        onPress={onToggleCollapsed}
        accessibilityRole="button"
        accessibilityLabel="Show nearby doctor offices panel">
        <Feather name="chevron-up" size={18} color="#000000" />
        <Text style={[styles.collapsedLabel, { color: isDark ? '#cbd5e1' : '#475569' }]}>
          Nearby doctor offices ({shownCount})
        </Text>
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.panel,
        { backgroundColor: isDark ? '#172033' : 'white', borderColor: isDark ? '#334155' : '#dbe3ec' },
      ]}>
      <View style={[styles.headerWrap, { borderBottomColor: isDark ? '#334155' : '#e2e8f0' }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.heading, { color: isDark ? '#f1f5f9' : '#0f172a' }]} numberOfLines={1}>
            Nearby Doctor Offices ({shownCount})
          </Text>
          <Pressable
            onPress={onToggleCollapsed}
            style={styles.collapseIconBtn}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Hide nearby doctor offices and expand map">
            <Feather name="chevron-down" size={20} color="#000000" />
          </Pressable>
        </View>
        {isLoadingMore ? (
          <View style={styles.loadingMoreRow}>
            <ActivityIndicator size="small" color={isDark ? '#38bdf8' : '#0284c7'} />
            <Text style={[styles.loadingMoreText, { color: isDark ? '#94a3b8' : '#475569' }]}>
              Finding more nearby offices…
            </Text>
          </View>
        ) : null}
      </View>
      <ScrollView contentContainerStyle={styles.listContent} scrollEnabled>
        {clinicsToShow.map((clinic, index) => {
          const routeDistance = routeDistanceByClinicId[clinic.id];
          const tier = waitTierVisual(clinic.latestWaitMinutes);
          const historyOpen = openReportHistoryByClinicId[clinic.id] ?? false;
          const distanceFromUserMeters = userLocation
            ? haversineDistanceMeters(userLocation, { latitude: clinic.latitude, longitude: clinic.longitude })
            : null;
          const isNearForReport =
            typeof distanceFromUserMeters === 'number' && distanceFromUserMeters <= reportGeofenceMeters;
          const isCollapsedPreviewTail =
            !expanded && clinics.length > COLLAPSED_PREVIEW_COUNT && index === clinicsToShow.length - 1;
          return (
            <Pressable
              key={clinic.id}
              style={({ pressed }) => [
                styles.row,
                {
                  borderColor: tier.borderColor,
                  backgroundColor: tier.backgroundColor,
                },
                isCollapsedPreviewTail && styles.rowPreviewTail,
                pressed && styles.rowPressed,
              ]}
              onPress={() => onClinicPress?.(clinic)}
              accessibilityRole="button"
              accessibilityLabel={`${clinic.name}, open report wait time`}>
              <View style={styles.topRow}>
                <Text style={[styles.name, { color: isDark ? '#f1f5f9' : '#0f172a' }]} numberOfLines={2}>
                  {clinic.name}
                </Text>
                <Text style={[styles.waitLabel, { color: tier.waitTextColor }]}>{tier.waitLabel}</Text>
              </View>
              <Text style={[styles.meta, { color: isDark ? '#cbd5e1' : '#1f2937' }]}>
                {clinic.address}
              </Text>
              {isNearForReport ? (
                <View
                  style={[
                    styles.nearTag,
                    {
                      backgroundColor: isDark ? 'rgba(15,23,42,0.82)' : 'rgba(255,255,255,0.96)',
                      borderColor: isDark ? '#38bdf8' : '#0284c7',
                    },
                  ]}>
                  <Text style={[styles.nearTagText, { color: isDark ? '#7dd3fc' : '#075985' }]}>
                    You&apos;re near this doctor office - you can report now
                  </Text>
                </View>
              ) : null}
              {clinic.recentReports.length > 0 ? (
                <View style={styles.reportsWrap}>
                  <Pressable
                    style={styles.reportsToggle}
                    onPress={() =>
                      setOpenReportHistoryByClinicId((prev) => ({
                        ...prev,
                        [clinic.id]: !historyOpen,
                      }))
                    }>
                    <Text style={[styles.reportsHeading, { color: isDark ? '#bfdbfe' : '#1e3a8a' }]}>
                      View last 3hr reports
                    </Text>
                    <Feather
                      name={historyOpen ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={isDark ? '#bfdbfe' : '#1e3a8a'}
                    />
                  </Pressable>
                  {historyOpen
                    ? clinic.recentReports.map((report) => (
                        <View key={report.id} style={styles.reportRow}>
                          <Text style={[styles.reportTime, { color: isDark ? '#dbeafe' : '#1f2937' }]}>
                            {formatReportedTime(report.reportedAt)}
                          </Text>
                          <Text style={[styles.reportValue, { color: isDark ? '#e2e8f0' : '#0f172a' }]}>
                            {report.waitMinutes == null ? 'No report value' : `${report.waitMinutes} min`}
                          </Text>
                        </View>
                      ))
                    : null}
                </View>
              ) : null}
              {typeof routeDistance === 'number' ? (
                <View style={styles.distanceRow}>
                  <Text style={[styles.meta, { color: isDark ? '#cbd5e1' : '#1f2937' }]}>
                    Distance {metersToMiles(routeDistance).toFixed(1)} mi
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
        {clinics.length === 0 ? <Text style={[styles.empty, { color: isDark ? '#94a3b8' : '#64748b' }]}>No doctor offices found.</Text> : null}
      </ScrollView>
      {expanded && clinics.length > listCap ? (
        <Pressable onPress={() => setListCap((cap) => cap + LIST_BATCH)} style={styles.expandBtn} accessibilityRole="button">
          <Text style={[styles.expandText, { color: isDark ? '#7dd3fc' : '#0369a1' }]}>
            Load more ({Math.min(LIST_BATCH, clinics.length - listCap)} of {clinics.length - listCap} left)
          </Text>
        </Pressable>
      ) : null}
      {clinics.length > COLLAPSED_PREVIEW_COUNT ? (
        <Pressable onPress={onToggleExpanded} style={styles.expandBtn}>
          <Text style={[styles.expandText, { color: isDark ? '#e2e8f0' : '#111827' }]}>
            {expanded ? 'Show Less' : 'Show More'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  loadingMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 6,
  },
  loadingMoreText: {
    fontSize: 11,
  },
  collapsedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'white',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#dbe3ec',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  collapsedLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerWrap: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 6,
    borderBottomWidth: 1,
  },
  collapseIconBtn: {
    padding: 4,
  },
  panel: {
    backgroundColor: 'white',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: '#dbe3ec',
    maxHeight: 340,
  },
  listContent: {
    padding: 12,
    paddingTop: 8,
    gap: 12,
  },
  heading: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 0,
  },
  row: {
    borderWidth: 2,
    borderRadius: 14,
    padding: 10,
    gap: 6,
  },
  rowPressed: {
    opacity: 0.92,
  },
  rowPreviewTail: {
    opacity: 0.5,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontWeight: '700',
    color: '#0f172a',
    fontSize: 16,
    lineHeight: 21,
    flex: 1,
    paddingRight: 8,
  },
  waitLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 8,
    flexShrink: 0,
    textAlign: 'right',
    maxWidth: 120,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reportsWrap: {
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.35)',
    gap: 4,
  },
  reportsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  reportsHeading: {
    fontSize: 9,
    fontWeight: '700',
  },
  reportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  reportTime: {
    fontSize: 9,
    fontWeight: '600',
  },
  reportValue: {
    fontSize: 9,
    fontWeight: '700',
  },
  meta: {
    color: '#1f2937',
    fontSize: 9,
  },
  nearTag: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 2,
  },
  nearTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  expandBtn: { alignItems: 'center', paddingVertical: 8 },
  expandText: { color: '#111827', fontWeight: '600', fontSize: 15 },
  empty: {
    color: '#64748b',
    textAlign: 'center',
    paddingVertical: 20,
  },
});
