import { Feather } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ClinicWithMeta } from '@/src/hooks/use-clinics';
import { waitTierVisual } from '@/src/lib/wait-tier-style';

type Props = {
  /** Offices standing on the same tapped pin (e.g. one building). */
  clinics: ClinicWithMeta[] | null;
  onSelect: (clinic: ClinicWithMeta) => void;
  onClose: () => void;
};

/** Native counterpart of the web ClinicStackPicker: a list of the offices behind
 *  one pin, so the user chooses which one to open instead of getting only the top one. */
export const ClinicStackPicker = ({ clinics, onSelect, onClose }: Props) => {
  const count = clinics?.length ?? 0;
  return (
    <Modal visible={clinics != null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close picker" />
        <View style={styles.card} accessibilityViewIsModal>
          <View style={styles.header}>
            <Text style={styles.title}>{count} doctor offices at this spot</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <Feather name="x" size={18} color="#0f172a" />
            </Pressable>
          </View>
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {(clinics ?? []).map((clinic) => {
              const tier = waitTierVisual(clinic.latestWaitMinutes);
              return (
                <Pressable
                  key={clinic.id}
                  onPress={() => onSelect(clinic)}
                  accessibilityRole="button"
                  style={[styles.row, { backgroundColor: tier.backgroundColor, borderColor: tier.borderColor }]}>
                  <View style={styles.rowText}>
                    <Text style={styles.name} numberOfLines={2}>{clinic.name}</Text>
                    {clinic.specialty ? <Text style={styles.specialty} numberOfLines={1}>{clinic.specialty}</Text> : null}
                    <Text style={styles.address} numberOfLines={1}>{clinic.address}</Text>
                  </View>
                  <Text style={[styles.wait, { color: tier.waitTextColor }]}>{tier.waitLabel}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.35)' },
  card: { width: '100%', maxWidth: 360, maxHeight: '70%', borderRadius: 16, backgroundColor: '#fff', padding: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingBottom: 8 },
  title: { fontSize: 14, fontWeight: '700', color: '#0f172a', flex: 1 },
  list: { flexGrow: 0 },
  listContent: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 10 },
  rowText: { flex: 1, gap: 2 },
  name: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  specialty: { fontSize: 11, color: '#475569' },
  address: { fontSize: 11, color: '#64748b' },
  wait: { fontSize: 11, fontWeight: '700' },
});
