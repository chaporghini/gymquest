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
  const Icon = ICONS[achievement.icon];
  return (
    <View
      style={[styles.card, achievement.unlocked ? styles.unlocked : styles.locked]}
      accessible
      accessibilityLabel={`Achievement ${achievement.title}: ${achievement.description} ${achievement.unlocked ? 'Freigeschaltet.' : `Fortschritt ${achievement.progress} von ${achievement.target}.`}`}>
      {!achievement.unlocked ? <Lock size={14} color={colors.textSecondary} style={styles.lock} /> : null}
      <View style={[styles.badgeRing, achievement.unlocked && styles.badgeRingOn]}>
        <View style={[styles.icon, achievement.unlocked && styles.iconUnlocked]}>
          <Icon size={26} color={achievement.unlocked ? colors.onAccent : colors.textSecondary} />
        </View>
      </View>
      <AppText variant="bodyStrong" align="center" numberOfLines={1} tone={achievement.unlocked ? 'primary' : 'secondary'}>{achievement.title}</AppText>
      <AppText variant="small" tone="secondary" align="center" numberOfLines={2} style={styles.desc}>{achievement.description}</AppText>
      {achievement.unlocked ? (
        <AppText variant="caption" tone="accent" align="center">
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
    alignItems: 'stretch',
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  unlocked: { borderColor: colors.accentBorder, backgroundColor: colors.accentFaint },
  locked: { opacity: 0.75 },
  lock: { position: 'absolute', top: spacing.md, right: spacing.md },
  badgeRing: { alignSelf: 'center', padding: 5, borderRadius: radius.xl, borderWidth: 2, borderColor: colors.borderStrong, marginBottom: spacing.xs },
  badgeRingOn: { borderColor: colors.accent },
  icon: { width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center' },
  iconUnlocked: { backgroundColor: colors.accent },
  desc: { minHeight: 38 },
});
