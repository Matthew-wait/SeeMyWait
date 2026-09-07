import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';

/** Shared with MapView so zoom stack sits above this control with a fixed gap. */
export const FIND_ME_MAP_LAYOUT = { left: 10, bottom: 16, size: 38 } as const;

/** Vertical gap between the zoom (+/−) card and the Find Me button. */
export const ZOOM_FIND_ME_GAP = 8;

type Props = {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export const FindMeButton = ({ onPress, loading, disabled }: Props) => {
  return (
    <Pressable onPress={onPress} style={[styles.button, disabled && styles.buttonDisabled]} disabled={disabled}>
      <Feather name={loading ? 'loader' : 'crosshair'} size={18} color="#0284c7" />
      <Text style={styles.hiddenLabel}>{loading ? 'Locating' : 'Find Me'}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    left: FIND_ME_MAP_LAYOUT.left,
    bottom: FIND_ME_MAP_LAYOUT.bottom,
    backgroundColor: '#fff',
    borderRadius: 14,
    width: FIND_ME_MAP_LAYOUT.size,
    height: FIND_ME_MAP_LAYOUT.size,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#dbe1e8',
    zIndex: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  hiddenLabel: {
    width: 0,
    height: 0,
    opacity: 0,
  },
});
