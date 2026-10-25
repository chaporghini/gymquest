import { router } from 'expo-router';
import { BottomTabBar, Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { ChartColumn, Dumbbell, House, Play, Trophy, User } from 'lucide-react-native';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components';
import { completedSetCount, plannedSetCount } from '@/domain/workout';
import { useApp } from '@/state/AppProvider';
import { colors, DESKTOP_BREAKPOINT, radius, spacing } from '@/theme/tokens';

const NAV = [
  { name: 'index', title: 'Home', icon: House },
  { name: 'training', title: 'Training', icon: Dumbbell },
  { name: 'stats', title: 'Fortschritt', icon: ChartColumn },
  { name: 'quests', title: 'Quests & Erfolge', icon: Trophy },
  { name: 'profile', title: 'Profil', icon: User },
] as const;

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const desktop = width >= DESKTOP_BREAKPOINT;
  return (
    <Tabs
      tabBar={(props) =>
        desktop ? (
          <Sidebar {...props} />
        ) : (
          <View>
            <ActiveWorkoutBanner />
            <BottomTabBar {...props} />
          </View>
        )
      }
      screenOptions={{
        headerShown: false,
        tabBarPosition: desktop ? 'left' : 'bottom',
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarAccessibilityLabel: 'Home', tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }} />
      <Tabs.Screen name="training" options={{ title: 'Training', tabBarAccessibilityLabel: 'Training', tabBarIcon: ({ color, size }) => <Dumbbell color={color} size={size} /> }} />
      <Tabs.Screen name="stats" options={{ title: 'Fortschritt', tabBarAccessibilityLabel: 'Fortschritt', tabBarIcon: ({ color, size }) => <ChartColumn color={color} size={size} /> }} />
      <Tabs.Screen name="quests" options={{ title: 'Quests', tabBarAccessibilityLabel: 'Quests und Erfolge', tabBarIcon: ({ color, size }) => <Trophy color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarAccessibilityLabel: 'Profil', tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </Tabs>
  );
}

/** Navigation auf Laptop und PC: Seitenleiste mit allen Bereichen. */
function Sidebar({ state, navigateToTab }: BottomTabBarProps) {
  const current = state.routes[state.index]?.name;
  return (
    <SafeAreaView edges={['top', 'bottom', 'left']} style={styles.sidebar}>
      <AppText variant="title" style={styles.logo}>
        Gym<AppText variant="title" tone="accent">Quest</AppText>
      </AppText>
      <View style={styles.nav}>
        {NAV.map(({ name, title, icon: Icon }) => {
          const active = current === name;
          const route = state.routes.find((r) => r.name === name);
          if (!route) return null;
          return (
            <Pressable
              key={name}
              onPress={() => navigateToTab(route.key)}
              accessibilityRole="link"
              accessibilityState={{ selected: active }}
              style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.navItem, (hovered || pressed) && styles.navHover, active && styles.navActive]}>
              <Icon size={20} color={active ? colors.accent : colors.textSecondary} />
              <AppText tone={active ? 'accent' : 'secondary'} style={active ? styles.bold : undefined}>{title}</AppText>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.flex} />
      <ActiveWorkoutBanner compact />
    </SafeAreaView>
  );
}

/** Erinnert auf allen Tabs an ein laufendes Training, damit es nicht verloren geht. */
function ActiveWorkoutBanner({ compact }: { compact?: boolean }) {
  const { activeWorkout } = useApp();
  if (!activeWorkout) return null;
  const done = completedSetCount(activeWorkout);
  const total = plannedSetCount(activeWorkout);
  return (
    <Pressable
      onPress={() => router.push('/workout/active')}
      accessibilityRole="button"
      accessibilityLabel={`Training ${activeWorkout.name} läuft, ${done} von ${total} Sätzen. Fortsetzen.`}
      style={({ pressed }) => [styles.banner, compact && styles.bannerCompact, pressed && { opacity: 0.9 }]}>
      <View style={styles.pulse} />
      <View style={styles.flex}>
        <AppText variant="caption" tone="onAccent">TRAINING LÄUFT</AppText>
        <AppText variant={compact ? 'small' : 'bodyStrong'} tone="onAccent" numberOfLines={1}>{activeWorkout.name} · {done}/{total} Sätze</AppText>
      </View>
      {compact ? null : <View style={styles.resume}>
        <Play size={16} color={colors.accent} fill={colors.accent} />
        <AppText variant="small" tone="accent" style={styles.bold}>Fortsetzen</AppText>
      </View>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
  },
  bannerCompact: { marginHorizontal: 0, marginBottom: 0 },
  sidebar: { width: 240, backgroundColor: colors.background, borderRightWidth: 1, borderRightColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.xl, gap: spacing.xl },
  logo: { paddingHorizontal: spacing.md },
  nav: { gap: spacing.xs },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radius.md },
  navHover: { backgroundColor: colors.card },
  navActive: { backgroundColor: colors.cardSecondary },
  pulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.onAccent },
  flex: { flex: 1 },
  resume: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.onAccent, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  bold: { fontWeight: '700' },
});
