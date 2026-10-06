import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Dimensions, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';

import { InteractiveTiltCard } from '@/src/components/onboarding/InteractiveTiltCard';
import { useTheme } from '@/src/hooks/use-theme';
import { safeSetItem } from '@/src/lib/safe-storage';

const ONBOARDING_SEEN_KEY = 'onboarding_seen_v2';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Step = {
  key: string;
  title: string;
  subtitle: string;
  bullets: string[];
};

export function OnboardingPage() {
  const router = useRouter();
  const { isDark } = useTheme();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<Step>>(null);

  const steps = useMemo<Step[]>(
    () => [
      {
        key: 'step-1',
        title: 'Find a doctor office near you',
        subtitle: 'Scan the map instantly and pick the best option nearby.',
        bullets: ['Tap Find me for your live position', 'Use the map and list together', 'Compare reports before visiting'],
      },
      {
        key: 'step-2',
        title: 'Report wait in seconds',
        subtitle: 'At the doctor office? Drop a quick update to help everyone.',
        bullets: ['Pick a wait tier and submit', 'Fresh reports stay visible', 'Your update helps other patients'],
      },
      {
        key: 'step-3',
        title: 'Keep data trustworthy',
        subtitle: 'Accurate reports create smarter decisions for the whole community.',
        bullets: ['Only report when you are there', 'Cooldown limits spam reports', 'Reliable data improves choices'],
      },
    ],
    []
  );

  const colors = useMemo(() => {
    const bg = isDark ? '#050913' : '#F4F7FF';
    const text = isDark ? '#F5F7FF' : '#0B1220';
    const sub = isDark ? '#B8C4E6' : '#52627E';
    const border = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(11,18,32,0.08)';
    const card = isDark ? '#0F172A' : '#FFFFFF';
    const primary = isDark ? '#7AA2FF' : '#2F6BFF';
    const primaryText = '#FFFFFF';
    return { bg, text, sub, border, card, primary, primaryText };
  }, [isDark]);

  const finish = useCallback(async () => {
    await safeSetItem(ONBOARDING_SEEN_KEY, '1');
    router.replace({ pathname: '/loader', params: { to: '/map' } });
  }, [router]);

  const onNext = useCallback(() => {
    if (index >= steps.length - 1) {
      void finish();
      return;
    }
    const next = index + 1;
    // Set state directly rather than relying on onMomentumScrollEnd to catch
    // up — that handler can miss a programmatic (non-gesture) scroll on
    // React Native Web, leaving the button's label/step stuck.
    setIndex(next);
    listRef.current?.scrollToOffset({ offset: next * SCREEN_WIDTH, animated: true });
  }, [finish, index, steps.length]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={[styles.brand, { color: colors.text }]}>SeeMyWait</Text>
        <Pressable onPress={() => void finish()} hitSlop={10}>
          <Text style={[styles.skip, { color: colors.sub }]}>Skip</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={steps}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, i) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * i, index: i })}
        onMomentumScrollEnd={(e) => {
          const next = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setIndex(Math.max(0, Math.min(steps.length - 1, next)));
        }}
        renderItem={({ item }) => (
          <View style={{ width: SCREEN_WIDTH }}>
            <InteractiveTiltCard isDark={isDark} />
            <Animated.View
              // key forces enter/exit animations when step changes
              key={item.key}
              entering={FadeInRight.duration(260)}
              exiting={FadeOutLeft.duration(180)}
              style={styles.body}
            >
              <Text style={[styles.stepBadge, { color: colors.primary }]}>
                Step {index + 1} of {steps.length}
              </Text>
              <Text style={[styles.stepTitle, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.stepSubtitle, { color: colors.sub }]}>{item.subtitle}</Text>

              <View style={[styles.bulletsBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
                {item.bullets.map((b) => (
                  <View key={b} style={styles.bulletRow}>
                    <View style={[styles.bulletDot, { backgroundColor: colors.primary }]} />
                    <Text style={[styles.bulletText, { color: colors.sub }]}>{b}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {steps.map((s, i) => (
            <View
              key={s.key}
              style={[
                styles.dot,
                {
                  backgroundColor: i === index ? colors.primary : colors.border,
                  width: i === index ? 22 : 8,
                },
              ]}
            />
          ))}
        </View>

        <Pressable
          onPress={() => onNext()}
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Text style={[styles.primaryBtnText, { color: colors.primaryText }]}>
            {index === steps.length - 1 ? 'Get started' : 'Next'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.45,
  },
  skip: {
    fontSize: 14,
    fontWeight: '700',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 9,
  },
  stepBadge: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.25,
    textTransform: 'uppercase',
  },
  stepTitle: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0.1,
    lineHeight: 34,
  },
  stepSubtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  bulletsBox: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 18,
    padding: 15,
    gap: 12,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bulletDot: {
    marginTop: 7,
    width: 8,
    height: 8,
    borderRadius: 99,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 22,
    gap: 12,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    height: 8,
    borderRadius: 99,
  },
  primaryBtn: {
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2F6BFF',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});

