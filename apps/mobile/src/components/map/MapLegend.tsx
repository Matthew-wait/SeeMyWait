import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const LEGEND_ITEMS: { key: string; label: string; color: string }[] = [
  { key: 'on-time', label: 'On Time', color: '#22c55e' },
  { key: '30', label: '~30 Min', color: '#eab308' },
  { key: '60', label: '~1 Hour', color: '#f97316' },
  { key: '90', label: '1.5+ Hours', color: '#ef4444' },
];

type Props = {
  top?: number;
  right?: number;
};

export const MapLegend = ({ top = 88, right = 8 }: Props) => {
  const [open, setOpen] = useState(false);

  return (
    <View style={[styles.anchor, { top, right }]} pointerEvents="box-none">
      <Pressable
        style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel="Wait time legend">
        <View style={[styles.pillDot, { backgroundColor: '#22c55e' }]} />
        <View style={[styles.pillDot, { backgroundColor: '#eab308' }]} />
        <View style={[styles.pillDot, { backgroundColor: '#f97316' }]} />
        <View style={[styles.pillDot, { backgroundColor: '#ef4444' }]} />
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#334155" style={styles.pillChevron} />
      </Pressable>

      {open ? (
        <View style={styles.card}>
          <Text style={styles.title}>WAIT TIME LEGEND</Text>
          {LEGEND_ITEMS.map((item) => (
            <View key={item.key} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text style={styles.legendLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    zIndex: 28,
    alignItems: 'flex-end',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 5,
  },
  pillPressed: {
    opacity: 0.92,
  },
  pillDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pillChevron: {
    marginLeft: 2,
  },
  card: {
    marginTop: 8,
    width: 200,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 8,
  },
  title: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#0f172a',
    marginBottom: 10,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 5,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  legendLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#334155',
  },
});
