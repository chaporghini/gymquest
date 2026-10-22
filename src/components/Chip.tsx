import { Pressable, StyleSheet } from 'react-native';

import { colors, radius, spacing } from '@/theme/tokens';
import { AppText } from './AppText';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  accessibilityHint?: string;
  /** "radio" für Einfachauswahl, "checkbox" für Mehrfachauswahl */
  role?: 'radio' | 'checkbox' | 'button';
}

export function Chip({ label, selected, onPress, accessibilityHint, role = 'button' }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={role === 'button' ? { selected } : { checked: !!selected }}
      style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && styles.pressed]}>
      <AppText variant="small" tone={selected ? 'accent' : 'primary'} style={selected ? styles.selectedText : undefined}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing.md + 2,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
  },
  selected: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  selectedText: { fontWeight: '700' },
  pressed: { opacity: 0.8 },
});
