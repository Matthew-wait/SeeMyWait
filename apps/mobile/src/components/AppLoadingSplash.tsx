import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = {
  isDark: boolean;
};

export const AppLoadingSplash = ({ isDark }: Props) => {
  const palette = isDark
    ? {
        screen: '#080b2a',
        noiseA: 'rgba(30,58,138,0.12)',
        noiseB: 'rgba(30,64,175,0.08)',
        glow: 'rgba(56,189,248,0.22)',
        title: '#f8fbff',
        subtitle: '#7dd3fc',
        caption: '#cbd5e1',
        accent: '#38bdf8',
        iconBg: '#39bdf8',
      }
    : {
        screen: '#0d1338',
        noiseA: 'rgba(14,165,233,0.1)',
        noiseB: 'rgba(59,130,246,0.09)',
        glow: 'rgba(14,165,233,0.2)',
        title: '#ffffff',
        subtitle: '#a5f3fc',
        caption: '#dbeafe',
        accent: '#7dd3fc',
        iconBg: '#38bdf8',
      };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.screen }]}>
      <View pointerEvents="none" style={[styles.layer, styles.layerA, { backgroundColor: palette.noiseA }]} />
      <View pointerEvents="none" style={[styles.layer, styles.layerB, { backgroundColor: palette.noiseB }]} />
      <View style={styles.centerContent}>
        <Image source={require('../../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={[styles.title, { color: palette.title }]}>SeeMyWait</Text>
        <Text style={[styles.tagline, { color: palette.subtitle }]}>Right Doc. Right Spot. Right Time.</Text>
        <Text style={[styles.caption, { color: palette.caption }]}>Real-time wait times. Verified at the doctor office.</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  layer: {
    position: 'absolute',
    borderRadius: 9999,
    transform: [{ rotate: '-8deg' }],
  },
  layerA: {
    width: 480,
    height: 480,
    top: -220,
    left: -120,
  },
  layerB: {
    width: 520,
    height: 520,
    bottom: -270,
    right: -160,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 300,
    gap: 6,
    zIndex: 2,
  },
  logo: {
    width: 90,
    height: 90,
    borderRadius: 20,
    marginBottom: 4,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: 0.2,
    lineHeight: 34,
  },
  tagline: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.2,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: 2,
  },
  caption: {
    fontSize: 9,
    lineHeight: 12,
    textAlign: 'center',
    opacity: 0.95,
    marginTop: 2,
  },
});
