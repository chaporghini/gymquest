import { Crown, Lock } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { RANKS } from '@/domain/ranks';
import { colors, radius, spacing } from '@/theme/tokens';
import { AppText } from './AppText';
import { Card } from './Card';

export function RankList({ level }: { level: number }) {
  const currentId = [...RANKS].reverse().find((r) => level >= r.minLevel)?.id;
  return (
    <Card padded={false} style={styles.card}>
      {RANKS.map((r, i) => {
        const reached = level >= r.minLevel;
        const isCurrent = r.id === currentId;
        return (
          <View
            key={r.id}
            style={[styles.row, i > 0 && styles.divider, isCurrent && styles.current]}
            accessible
            accessibilityLabel={`Rang ${r.name}, ab Level ${r.minLevel}. ${isCurrent ? 'Aktueller Rang.' : reached ? 'Freigeschaltet.' : 'Noch gesperrt.'}`}>
            <View style={[styles.icon, reached && styles.iconReached]}>
              {reached ? <Crown size={18} color={colors.onAccent} /> : <Lock size={16} color={colors.textSecondary} />}
            </View>
            <View style={styles.flex}>
              <AppText variant="bodyStrong" tone={reached ? 'primary' : 'secondary'}>{r.name}</AppText>
              <AppText variant="small" tone="secondary">{r.description}</AppText>
            </View>
            <AppText variant="small" tone={isCurrent ? 'accent' : 'secondary'} style={styles.bold}>
              {isCurrent ? 'AKTUELL' : `Lvl ${r.minLevel}`}
            </AppText>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  current: { backgroundColor: colors.accentFaint },
  icon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center' },
  iconReached: { backgroundColor: colors.accent },
  flex: { flex: 1, gap: 2 },
  bold: { fontWeight: '700' },
});
