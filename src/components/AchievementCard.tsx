import { Dumbbell, Flame, Lock, Medal, Moon, Star, Sunrise, Trophy } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { formatDate } from '@/domain/dates';
import type { AchievementDef, AchievementStatus } from '@/domain/progression';
import { colors, radius, spacing } from '@/theme/tokens';
import { AppText } from './AppText';
import { ProgressBar } from './ProgressBar';

const ICONS: Record<AchievementDef['icon'], typeof Trophy> = {
  trophy: Trophy,
  flame: Flame,
  dumbbell: Dumbbell,
  star: Star,
  sunrise: Sunrise,
  moon: Moon,
  medal: Medal,
};

export function AchievementCard({ achievement }: { achievement: AchievementStatus }) {
  const Icon = achievement.unlocked ? ICONS[achievement.icon] : Lock;
  return (
    <View
      style={[styles.card, achievement.unlocked && styles.unlocked]}
      accessible
      accessibilityLabel={`Achievement ${achievement.title}: ${achievement.description} ${achievement.unlocked ? 'Freigeschaltet.' : `Fortschritt ${achievement.progress} von ${achievement.target}.`}`}>
      <View style={[styles.icon, achievement.unlocked && styles.iconUnlocked]}>
        <Icon size={20} color={achievement.unlocked ? colors.onAccent : colors.textSecondary} />
      </View>
      <AppText variant="bodyStrong" numberOfLines={1} tone={achievement.unlocked ? 'primary' : 'secondary'}>{achievement.title}</AppText>
      <AppText variant="small" tone="secondary" numberOfLines={2} style={styles.desc}>{achievement.description}</AppText>
      {achievement.unlocked ? (
        <AppText variant="caption" tone="accent">
          {achievement.unlockedAt ? formatDate(achievement.unlockedAt) : 'FREIGESCHALTET'}
        </AppText>
      ) : (
        <ProgressBar value={achievement.progress / achievement.target} height={4} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  unlocked: { borderColor: colors.accentBorder },
  icon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  iconUnlocked: { backgroundColor: colors.accent },
  desc: { minHeight: 38 },
});
