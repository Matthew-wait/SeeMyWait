import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ClinicWithMeta } from '@/src/hooks/use-clinics';
import type { LatLng } from '@/src/lib/geolocation';

type Props = {
  clinics: ClinicWithMeta[];
  userLocation: LatLng | null;
  searchArea: { center: LatLng; radiusMeters: number } | null;
  nearbyRadiusMeters: number;
  centerOn: LatLng | null;
  onCenterApplied: () => void;
  onClinicPress?: (clinic: ClinicWithMeta) => void;
};

/** Web: react-native-maps is native-only; show a non-interactive summary instead. */
export const MapView = ({
  clinics,
  searchArea,
  nearbyRadiusMeters,
  centerOn,
  onCenterApplied,
  onClinicPress,
}: Props) => {
  useEffect(() => {
    if (!centerOn) return;
    onCenterApplied();
  }, [centerOn, onCenterApplied]);

  return (
    <View style={styles.mapFallback}>
      <Text style={styles.fallbackTitle}>Map not available on web</Text>
      <Text style={styles.fallbackText}>
        Use the Android or iOS app for the interactive map. This build does not load native map modules.
      </Text>
      <Text style={styles.fallbackText}>Clinics visible: {clinics.length}</Text>
      {searchArea ? (
        <Text style={styles.fallbackText}>Search radius: {Math.round(searchArea.radiusMeters)} m</Text>
      ) : (
        <Text style={styles.fallbackText}>Nearby radius: {Math.round(nearbyRadiusMeters)} m</Text>
      )}
      {onClinicPress && clinics.length > 0 ? (
        <View style={styles.clinicPicker}>
          <Text style={styles.pickerLabel}>Tap a clinic to report wait time</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerScroll}>
            {clinics.map((clinic) => (
              <Pressable
                key={clinic.id}
                style={styles.clinicChip}
                onPress={() => onClinicPress(clinic)}
                accessibilityRole="button"
                accessibilityLabel={clinic.name}>
                <Text style={styles.clinicChipText} numberOfLines={1}>
                  {clinic.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
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
  clinicPicker: {
    marginTop: 20,
    gap: 8,
  },
  pickerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  pickerScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  clinicChip: {
    backgroundColor: '#f8fafc',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    maxWidth: 220,
  },
  clinicChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
});
