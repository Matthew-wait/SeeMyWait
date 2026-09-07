import { usePathname, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/hooks/use-theme';

type NavItem = {
  label: string;
  route: '/map' | '/suggest-clinic' | '/settings';
  icon: keyof typeof Feather.glyphMap;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Map', route: '/map', icon: 'map-pin' },
  { label: 'Add Doctor', route: '/suggest-clinic', icon: 'plus' },
  { label: 'Settings', route: '/settings', icon: 'settings' },
];

export const BottomNav = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: isDark ? '#334155' : '#d4d4d8',
          backgroundColor: isDark ? '#172033' : '#fff',
          paddingBottom: Math.max(14, insets.bottom + 8),
        },
      ]}>
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.route;
        const iconColor = isActive ? '#0284c7' : isDark ? '#cbd5e1' : '#334155';
        const labelColor = isActive ? '#0284c7' : isDark ? '#cbd5e1' : '#475569';
        return (
          <Pressable key={item.route} style={styles.item} onPress={() => router.push(item.route)}>
            <View
              style={[
                styles.iconWrap,
                isActive && styles.iconWrapActive,
                isActive && { backgroundColor: isDark ? '#0f3046' : '#e0f2fe' },
              ]}>
              <Feather name={item.icon} size={16} color={iconColor} />
            </View>
            <Text style={[styles.label, { color: labelColor }]}>{item.label}</Text>
            {isActive ? <View style={styles.activeLine} /> : <View style={styles.inactiveLine} />}
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: '#d4d4d8',
    backgroundColor: '#fff',
    paddingBottom: 14,
    paddingTop: 12,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
    gap: 4,
  },
  iconWrap: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
  },
  iconWrapActive: {
    backgroundColor: '#e0f2fe',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
  activeLine: {
    marginTop: 3,
    width: 20,
    height: 2,
    borderRadius: 999,
    backgroundColor: '#0ea5e9',
  },
  inactiveLine: {
    marginTop: 3,
    width: 20,
    height: 2,
  },
});
