import { router } from 'expo-router';
import { BottomTabBar, Tabs } from 'expo-router/js-tabs';
import { ChartColumn, Dumbbell, House, Play, User } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components';
import { completedSetCount, plannedSetCount } from '@/domain/workout';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing } from '@/theme/tokens';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => (
        <View>
          <ActiveWorkoutBanner />
          <BottomTabBar {...props} />
        </View>
      )}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarAccessibilityLabel: 'Home', tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }} />
      <Tabs.Screen name="training" options={{ title: 'Training', tabBarAccessibilityLabel: 'Training', tabBarIcon: ({ color, size }) => <Dumbbell color={color} size={size} /> }} />
      <Tabs.Screen name="stats" options={{ title: 'Fortschritt', tabBarAccessibilityLabel: 'Fortschritt', tabBarIcon: ({ color, size }) => <ChartColumn color={color} size={size} /> }} />
      {/* Quests sind über Home und Fortschritt erreichbar, nicht als eigener Tab. */}
      <Tabs.Screen name="quests" options={{ href: null, title: 'Quests' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarAccessibilityLabel: 'Profil', tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </Tabs>
  );
}

/** Erinnert auf allen Tabs an ein laufendes Training, damit es nicht verloren geht. */
function ActiveWorkoutBanner() {
  const { activeWorkout } = useApp();
  if (!activeWorkout) return null;
  const done = completedSetCount(activeWorkout);
  const total = plannedSetCount(activeWorkout);
  return (
    <Pressable
      onPress={() => router.push('/workout/active')}
      accessibilityRole="button"
      accessibilityLabel={`Training ${activeWorkout.name} läuft, ${done} von ${total} Sätzen. Fortsetzen.`}
      style={({ pressed }) => [styles.banner, pressed && { opacity: 0.9 }]}>
      <View style={styles.pulse} />
      <View style={styles.flex}>
        <AppText variant="caption" tone="onAccent">TRAINING LÄUFT</AppText>
        <AppText variant="bodyStrong" tone="onAccent" numberOfLines={1}>{activeWorkout.name} · {done}/{total} Sätze</AppText>
      </View>
      <View style={styles.resume}>
        <Play size={16} color={colors.accent} fill={colors.accent} />
        <AppText variant="small" tone="accent" style={styles.bold}>Fortsetzen</AppText>
      </View>
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
  pulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.onAccent },
  flex: { flex: 1 },
  resume: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.onAccent, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  bold: { fontWeight: '700' },
});
