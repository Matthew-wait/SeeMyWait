import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { directionsUrl, viewOnMapUrl } from '@seemywait/core';

import type { ClinicWithMeta } from '@/src/hooks/use-clinics';
import { useTheme } from '@/src/hooks/use-theme';
import { waitTierVisual } from '@/src/lib/wait-tier-style';

type Props = {
  clinic: ClinicWithMeta;
  /** `browse`: map/list tap. `proximity`: auto prompt when within report geofence (1000 m straight-line). */
  variant?: 'proximity' | 'browse';
  canReport?: boolean;
  onDismiss: () => void;
  onQuickReport?: (minutes: number) => void;
  submitting?: boolean;
  /** Browse taps only: draw the driving route from the user to this office on the map. */
  onViewOnMap?: (clinic: ClinicWithMeta) => void;
};

type ReportBucket = {
  key: string;
  label: string;
  minutes: number;
  swatch: 'green' | 'yellow' | 'orange' | 'red';
};

const REPORT_BUCKETS: ReportBucket[] = [
  { key: 'on-time', label: 'On Time', minutes: 0, swatch: 'green' },
  { key: '30', label: '30 Min', minutes: 30, swatch: 'yellow' },
  { key: '60', label: '1 Hour', minutes: 60, swatch: 'orange' },
  { key: '90', label: '1.5+ Hrs', minutes: 90, swatch: 'red' },
];

const styles = StyleSheet.create({
  // Dark theme (the sheet was light-only). Same palette as the rest of the dark UI.
  cardDark: { backgroundColor: '#111c30', borderColor: '#334155' },
  dragHandleDark: { backgroundColor: '#475569' },
  closeBtnDark: { backgroundColor: '#1e293b' },
  titleDark: { color: '#f1f5f9' },
  subtitleDark: { color: '#cbd5e1' },
  addressDark: { color: '#94a3b8' },
  sectionLabelDark: { color: '#f1f5f9' },
  bucketBtnDark: { backgroundColor: '#172033', borderColor: '#334155' },
  bucketLabelDark: { color: '#e2e8f0' },
  directionsBtnDark: { backgroundColor: '#172033', borderColor: '#334155' },
  directionsBtnTextDark: { color: '#e2e8f0' },
  viewOnMapBtnDark: { backgroundColor: 'rgba(37,99,235,0.18)', borderColor: '#1e40af' },
  viewOnMapBtnTextDark: { color: '#93c5fd' },
  mapsLinkTextDark: { color: '#94a3b8' },
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 60,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  cardWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 88,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  dragHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    marginBottom: 8,
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  headerRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    marginRight: 40,
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#38bdf8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginTop: 6,
  },
  address: {
    flex: 1,
    fontSize: 8,
    color: '#64748b',
    lineHeight: 12,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  statusBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  statusBannerBlocked: {
    backgroundColor: '#fef2f2',
  },
  statusBannerTextBlocked: {
    color: '#dc2626',
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
  },
  bucketGrid: {
    gap: 8,
    marginBottom: 14,
  },
  bucketRowLine: {
    flexDirection: 'row',
    gap: 8,
  },
  bucketBtn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    backgroundColor: '#fff',
  },
  bucketBtnPressed: {
    backgroundColor: '#f8fafc',
  },
  colorDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginBottom: 6,
  },
  bucketLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  viewOnMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    marginBottom: 8,
  },
  viewOnMapBtnText: {
    color: '#1d4ed8',
    fontSize: 14,
    fontWeight: '700',
  },
  directionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  directionsBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  mapsLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 2,
  },
  mapsLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
});

const Swatch = ({ kind }: { kind: ReportBucket['swatch'] }) => {
  const color =
    kind === 'green'
      ? '#22c55e'
      : kind === 'yellow'
        ? '#eab308'
        : kind === 'orange'
          ? '#f97316'
          : '#ef4444';
  return <View style={[styles.colorDot, { backgroundColor: color }]} />;
};

export const ProximityPrompt = ({
  clinic,
  variant = 'proximity',
  canReport = true,
  onDismiss,
  onQuickReport,
  submitting,
  onViewOnMap,
}: Props) => {
  const { isDark } = useTheme();
  const hasRecentReport = clinic.latestWaitMinutes != null;
  // Same source of truth as the list card / map pins, so the popup's wait status
  // matches. No active report => green "On time" (not a neutral "no reports" line).
  const tier = waitTierVisual(clinic.latestWaitMinutes);

  // "On Time" is already the default when nobody has reported — only offer it
  // as a quick-report option when there's an active non-on-time report to correct.
  const hasActiveDelay = clinic.latestWaitMinutes != null && clinic.latestWaitMinutes > 0;
  const visibleBuckets = REPORT_BUCKETS.filter((bucket) => bucket.minutes !== 0 || hasActiveDelay);

  const openDirections = () => {
    void Linking.openURL(directionsUrl(clinic.latitude, clinic.longitude)).catch(() => {});
  };

  // Open the location in Google Maps (plain deep link — no API key, not billed).
  const openInMaps = () => {
    void Linking.openURL(viewOnMapUrl(clinic.name, clinic.latitude, clinic.longitude)).catch(() => {});
  };

  return (
    // "proximity" is a non-blocking card (as on web): no backdrop, the map and search
    // stay usable underneath. "browse" (a tapped office) is a modal sheet.
    <View style={styles.overlayRoot} pointerEvents={variant === 'proximity' ? 'box-none' : 'auto'}>
      {variant === 'browse' ? <View style={styles.backdrop} /> : null}
      <View style={styles.cardWrap} pointerEvents="box-none">
        <View style={[styles.card, isDark && styles.cardDark]} accessibilityViewIsModal>
          <View style={[styles.dragHandle, isDark && styles.dragHandleDark]} accessibilityLabel="Sheet handle" />
          <Pressable
            style={[styles.closeBtn, isDark && styles.closeBtnDark]}
            onPress={onDismiss}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Dismiss">
            <Feather name="x" size={18} color={isDark ? '#e2e8f0' : '#0f172a'} />
          </Pressable>

          <View style={styles.headerRow}>
            <View style={styles.avatar}>
              <MaterialCommunityIcons name="stethoscope" size={22} color="#fff" />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.title, isDark && styles.titleDark]}>
                {variant === 'browse' ? clinic.name : `You're near ${clinic.name}`}
              </Text>
              <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
                {canReport ? 'Report the current wait time?' : 'Doctor office details and navigation'}
              </Text>
              <View style={styles.addressRow}>
                <Feather name="map-pin" size={12} color="#64748b" />
                <Text style={[styles.address, isDark && styles.addressDark]}>
                  {clinic.address}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.statusBanner, { backgroundColor: tier.backgroundColor }]}>
            <Feather name="clock" size={14} color={tier.waitTextColor} />
            <Text style={[styles.statusBannerText, { color: tier.waitTextColor, fontWeight: '700' }]}>
              {hasRecentReport
                ? `Latest report: about ${clinic.latestWaitMinutes} min wait`
                : tier.waitLabel}
            </Text>
          </View>

          {canReport ? (
            <>
              <Text style={[styles.sectionLabel, isDark && styles.sectionLabelDark]}>Report Wait Time</Text>
              <View style={styles.bucketGrid}>
                <View style={styles.bucketRowLine}>
                  {visibleBuckets.slice(0, 2).map((bucket) => (
                    <Pressable
                      key={bucket.key}
                      style={({ pressed }) => [styles.bucketBtn, isDark && styles.bucketBtnDark, pressed && styles.bucketBtnPressed]}
                      disabled={submitting}
                      onPress={() => onQuickReport?.(bucket.minutes)}
                      accessibilityRole="button"
                      accessibilityLabel={bucket.label}>
                      <Swatch kind={bucket.swatch} />
                      <Text style={[styles.bucketLabel, isDark && styles.bucketLabelDark]}>
                        {bucket.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {visibleBuckets.length > 2 && (
                  <View style={styles.bucketRowLine}>
                    {visibleBuckets.slice(2, 4).map((bucket) => (
                      <Pressable
                        key={bucket.key}
                        style={({ pressed }) => [styles.bucketBtn, isDark && styles.bucketBtnDark, pressed && styles.bucketBtnPressed]}
                        disabled={submitting}
                        onPress={() => onQuickReport?.(bucket.minutes)}
                        accessibilityRole="button"
                        accessibilityLabel={bucket.label}>
                        <Swatch kind={bucket.swatch} />
                        <Text style={[styles.bucketLabel, isDark && styles.bucketLabelDark]}>
                          {bucket.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            </>
          ) : (
            <View style={[styles.statusBanner, styles.statusBannerBlocked]}>
              <Feather name="alert-circle" size={14} color="#dc2626" />
              <Text style={[styles.statusBannerText, styles.statusBannerTextBlocked]}>
                You are not close enough to submit a wait report for this doctor office right now.
              </Text>
            </View>
          )}

          {variant === 'browse' && onViewOnMap ? (
            <Pressable
              style={[styles.viewOnMapBtn, isDark && styles.viewOnMapBtnDark]}
              onPress={() => onViewOnMap(clinic)}
              accessibilityRole="button"
              accessibilityLabel="View on map">
              <Feather name="map" size={16} color="#1d4ed8" />
              <Text style={[styles.viewOnMapBtnText, isDark && styles.viewOnMapBtnTextDark]}>View on map</Text>
            </Pressable>
          ) : null}

          <Pressable
            style={[styles.directionsBtn, isDark && styles.directionsBtnDark]}
            onPress={openDirections}
            accessibilityRole="button"
            accessibilityLabel="Get directions">
            <Feather name="navigation" size={16} color="#334155" />
            <Text style={[styles.directionsBtnText, isDark && styles.directionsBtnTextDark]}>Get Directions</Text>
          </Pressable>

          <Pressable
            style={styles.mapsLinkBtn}
            onPress={openInMaps}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="View on Google Maps">
            <Feather name="external-link" size={13} color="#64748b" />
            <Text style={[styles.mapsLinkText, isDark && styles.mapsLinkTextDark]}>View on Google Maps</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};
