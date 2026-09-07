import { useEffect, useMemo } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  isDark: boolean;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function InteractiveTiltCard({ isDark }: Props) {
  const floatY = useSharedValue(0);
  const orbScale = useSharedValue(1);
  const ringScale = useSharedValue(0.8);
  const ringOpacity = useSharedValue(0.85);
  const chipX = useSharedValue(0);
  const chipX2 = useSharedValue(0);

  const colors = useMemo(() => {
    const bg = isDark ? '#060A13' : '#F4F7FF';
    const card = isDark ? '#0F172A' : '#FFFFFF';
    const text = isDark ? '#F8FAFF' : '#0B1220';
    const sub = isDark ? '#C5D0EE' : '#52627E';
    const accent = isDark ? '#7AA2FF' : '#2F6BFF';
    const accentSoft = isDark ? 'rgba(122,162,255,0.24)' : 'rgba(47,107,255,0.20)';
    return { bg, card, text, sub, accent, accentSoft };
  }, [isDark]);

  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 1700, easing: Easing.inOut(Easing.sin) }),
        withTiming(10, { duration: 1700, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    ringScale.value = withRepeat(withTiming(1.45, { duration: 2000, easing: Easing.out(Easing.quad) }), -1, false);
    ringOpacity.value = withRepeat(withTiming(0.12, { duration: 2000, easing: Easing.out(Easing.quad) }), -1, false);

    chipX.value = withRepeat(
      withSequence(
        withTiming(8, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
        withTiming(-8, { duration: 1500, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
    chipX2.value = withDelay(
      200,
      withRepeat(
        withSequence(
          withTiming(-10, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
          withTiming(10, { duration: 1400, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        true
      )
    );
  }, [chipX, chipX2, floatY, ringOpacity, ringScale]);

  const onOrbPress = () => {
    orbScale.value = withSequence(withTiming(0.92, { duration: 120 }), withTiming(1.06, { duration: 160 }), withTiming(1, { duration: 180 }));
  };

  const animatedCardStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: floatY.value },
      ],
    };
  });

  const animatedRingStyle = useAnimatedStyle(() => {
    return {
      opacity: ringOpacity.value,
      transform: [{ scale: ringScale.value }],
    };
  });

  const animatedOrbStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: orbScale.value }],
    };
  });

  const chip1Style = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: chipX.value }],
    };
  });

  const chip2Style = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: chipX2.value }],
    };
  });

  return (
    <View style={[styles.stage, { backgroundColor: colors.bg }]}>
      <Animated.View style={[styles.card, { backgroundColor: colors.card }, animatedCardStyle]}>
        <View style={[styles.topGlow, { backgroundColor: colors.accentSoft }]} />
        <View style={styles.heroWrap}>
          <Animated.View style={[styles.ring, { borderColor: colors.accent }, animatedRingStyle]} />
          <Pressable onPress={onOrbPress} hitSlop={8} style={styles.orbHitbox}>
            <Animated.View style={[styles.orb, { backgroundColor: colors.accent }, animatedOrbStyle]}>
              <Text style={styles.orbText}>+</Text>
            </Animated.View>
          </Pressable>

          <Animated.View style={[styles.chip, styles.chipTop, { backgroundColor: colors.accentSoft }, chip1Style]}>
            <Text style={[styles.chipText, { color: colors.text }]}>Live Reports</Text>
          </Animated.View>
          <Animated.View style={[styles.chip, styles.chipBottom, { backgroundColor: colors.accentSoft }, chip2Style]}>
            <Text style={[styles.chipText, { color: colors.text }]}>Verified Nearby</Text>
          </Animated.View>
        </View>

        <View style={styles.inner} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  card: {
    width: Math.min(360, SCREEN_WIDTH - 48),
    borderRadius: 26,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
    overflow: 'hidden',
  },
  topGlow: {
    position: 'absolute',
    top: -90,
    right: -50,
    width: 220,
    height: 220,
    borderRadius: 9999,
  },
  heroWrap: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  ring: {
    position: 'absolute',
    width: 126,
    height: 126,
    borderRadius: 999,
    borderWidth: 2,
  },
  orbHitbox: {
    borderRadius: 999,
  },
  orb: {
    width: 74,
    height: 74,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2F6BFF',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  orbText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
    marginTop: -2,
  },
  chip: {
    position: 'absolute',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipTop: {
    top: 26,
    right: 18,
  },
  chipBottom: {
    bottom: 16,
    left: 22,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  inner: {
    height: 0,
  },
});

