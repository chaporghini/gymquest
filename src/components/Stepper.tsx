import { Minus, Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme/tokens';
import { AppText } from './AppText';

export interface StepperProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  step?: number;
  min?: number;
  max?: number;
  decimals?: boolean;
  unit?: string;
  placeholder?: string;
  compact?: boolean;
}

/** Zahleneingabe mit Plus/Minus – groß genug für die Bedienung mit verschwitzten Händen. */
export function Stepper({ label, value, onChange, step = 1, min = 0, max = 9999, decimals, unit, placeholder = '–', compact }: StepperProps) {
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n * 100) / 100));
  const change = (delta: number) => onChange(clamp((value ?? 0) + delta));
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <AppText variant="caption" tone="secondary">{label.toUpperCase()}{unit ? ` (${unit})` : ''}</AppText>
      <View style={[styles.row, compact && styles.rowCompact]}>
        <Pressable
          onPress={() => change(-step)}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={`${label} verringern`}
          style={({ pressed }) => [styles.btn, compact && styles.btnCompact, pressed && styles.pressed]}>
          <Minus size={18} color={colors.text} />
        </Pressable>
        <TextInput
          value={value === null ? '' : String(value)}
          onChangeText={(t) => {
            const normalized = t.replace(',', '.').replace(decimals ? /[^0-9.]/g : /[^0-9]/g, '');
            if (normalized === '') return onChange(null);
            const n = Number(normalized);
            if (Number.isFinite(n)) onChange(clamp(n));
          }}
          keyboardType={decimals ? 'decimal-pad' : 'number-pad'}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel={label}
          selectTextOnFocus
          style={styles.input}
        />
        <Pressable
          onPress={() => change(step)}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={`${label} erhöhen`}
          style={({ pressed }) => [styles.btn, compact && styles.btnCompact, pressed && styles.pressed]}>
          <Plus size={18} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: spacing.xs, minWidth: 130 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  rowCompact: {},
  wrapCompact: { minWidth: 104 },
  btnCompact: { width: 36 },
  btn: { width: MIN_TOUCH, height: MIN_TOUCH + 4, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  input: { ...typography.heading, flex: 1, minWidth: 40, color: colors.text, textAlign: 'center', paddingVertical: spacing.sm },
});
