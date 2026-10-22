import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import { AppText } from '@/components';
import { MUSCLE_LABELS, musclesWith, type Muscle, type MuscleLevel, type MuscleLoad } from '@/domain/muscles';
import { colors, spacing } from '@/theme/tokens';

export const LEVEL_COLORS: Record<MuscleLevel, string> = {
  primary: '#FF5A4E',
  secondary: '#FFC53D',
  none: '#3FAF6C',
};
const SKIN = '#2C3236';
const GAP = colors.background;

type Shape = { d?: string; ellipse?: [number, number, number, number]; rect?: [number, number, number, number, number] };

// Spiegelt eine Form an der Körpermitte (x = 60).
const mirrorPath = (d: string) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${120 - Number(x)} ${y}`);
const both = (s: Shape): Shape[] => {
  if (s.d) return [s, { d: mirrorPath(s.d) }];
  if (s.ellipse) return [s, { ellipse: [120 - s.ellipse[0], s.ellipse[1], s.ellipse[2], s.ellipse[3]] }];
  return [s];
};

const FRONT: Partial<Record<Muscle, Shape[]>> = {
  side_delts: both({ ellipse: [31, 51, 5, 9] }),
  front_delts: both({ ellipse: [39, 49, 6, 8] }),
  chest: both({ d: 'M59 44 L45 45 Q38 52 42 62 Q50 68 59 64 Z' }),
  biceps: both({ d: 'M30 60 Q25 72 28 86 L36 86 Q39 72 36 60 Z' }),
  forearms: both({ d: 'M27 90 Q22 104 24 118 L31 118 Q36 104 35 90 Z' }),
  abs: [
    { rect: [52, 68, 7, 10, 2] }, { rect: [61, 68, 7, 10, 2] },
    { rect: [52, 80, 7, 10, 2] }, { rect: [61, 80, 7, 10, 2] },
    { rect: [52, 92, 7, 12, 2] }, { rect: [61, 92, 7, 12, 2] },
  ],
  obliques: both({ d: 'M43 66 L50 69 L50 104 L45 102 Q41 86 43 66 Z' }),
  quads: both({ d: 'M43 112 Q37 134 45 166 L54 166 Q60 138 57.5 116 Z' }),
  adductors: both({ d: 'M57 116 L59.5 116 L59.5 146 L56 140 Z' }),
  calves: both({ d: 'M44 178 Q41 196 45 216 L51 216 Q54 196 52 178 Z' }),
};

const BACK: Partial<Record<Muscle, Shape[]>> = {
  traps: [{ d: 'M60 32 L50 41 L56 44 L60 56 L64 44 L70 41 Z' }],
  side_delts: both({ ellipse: [31, 51, 5, 9] }),
  rear_delts: both({ ellipse: [39, 49, 6, 8] }),
  upper_back: both({ d: 'M46 47 L53 47 L59 62 L59 70 L47 62 Z' }),
  lats: both({ d: 'M44 62 L59 72 L59 90 L50 96 Q41 80 44 62 Z' }),
  lower_back: [{ rect: [53, 92, 14, 16, 3] }],
  triceps: both({ d: 'M30 60 Q25 72 28 86 L36 86 Q39 72 36 60 Z' }),
  forearms: both({ d: 'M27 90 Q22 104 24 118 L31 118 Q36 104 35 90 Z' }),
  glutes: both({ ellipse: [51.5, 120, 8.5, 10] }),
  hamstrings: both({ d: 'M43 132 Q39 150 45 168 L54 168 Q59 150 58 132 Z' }),
  calves: both({ d: 'M43 176 Q39 194 45 214 L52 214 Q55 194 52 176 Z' }),
};

// Nicht bewertete Körperteile (Kopf, Hals, Hände, Knie, Füße, Becken) als neutrale Silhouette.
function Base() {
  return (
    <G fill={SKIN}>
      <Ellipse cx={60} cy={18} rx={10} ry={12} />
      <Rect x={55} y={28} width={10} height={8} rx={3} />
      <Rect x={44} y={40} width={32} height={68} rx={10} />
      <Rect x={44} y={104} width={32} height={14} rx={6} />
      {[27.5, 92.5].map((x) => <Circle key={x} cx={x} cy={124} r={5} />)}
      {[48.5, 71.5].map((x) => <Ellipse key={x} cx={x} cy={172} rx={6} ry={6} />)}
      {[48, 72].map((x) => <Ellipse key={x} cx={x} cy={222} rx={6} ry={4} />)}
    </G>
  );
}

function Figure({ shapes, load }: { shapes: Partial<Record<Muscle, Shape[]>>; load: MuscleLoad }) {
  return (
    <Svg viewBox="16 0 88 230" width="100%" height="100%">
      <Base />
      {(Object.entries(shapes) as [Muscle, Shape[]][]).map(([muscle, list]) => (
        <G key={muscle} fill={LEVEL_COLORS[load[muscle]]} stroke={GAP} strokeWidth={1}>
          {list.map((s, i) =>
            s.d ? <Path key={i} d={s.d} /> : s.ellipse ? <Ellipse key={i} cx={s.ellipse[0]} cy={s.ellipse[1]} rx={s.ellipse[2]} ry={s.ellipse[3]} /> : s.rect ? <Rect key={i} x={s.rect[0]} y={s.rect[1]} width={s.rect[2]} height={s.rect[3]} rx={s.rect[4]} /> : null,
          )}
        </G>
      ))}
    </Svg>
  );
}

/** Körper von vorne und hinten: rot = direkt, gelb = indirekt, grün = nicht beansprucht. */
export function BodyMap({ load, size = 220, showLegend = true, showList = false }: { load: MuscleLoad; size?: number; showLegend?: boolean; showList?: boolean }) {
  const primary = musclesWith(load, 'primary');
  const secondary = musclesWith(load, 'secondary');
  const summary = `Direkt beansprucht: ${primary.map((x) => MUSCLE_LABELS[x]).join(', ') || 'keine'}. Indirekt: ${secondary.map((x) => MUSCLE_LABELS[x]).join(', ') || 'keine'}.`;
  return (
    <View style={styles.wrap} accessible accessibilityRole="image" accessibilityLabel={`Muskelkarte. ${summary}`}>
      <View style={styles.figures}>
        {(['Vorne', 'Hinten'] as const).map((label) => (
          <View key={label} style={styles.figure}>
            <View style={{ width: size * 0.42, height: size }}>
              <Figure shapes={label === 'Vorne' ? FRONT : BACK} load={load} />
            </View>
            <AppText variant="caption" tone="secondary">{label.toUpperCase()}</AppText>
          </View>
        ))}
      </View>
      {showLegend ? (
        <View style={styles.legend}>
          <Legend color={LEVEL_COLORS.primary} label="Direkt" />
          <Legend color={LEVEL_COLORS.secondary} label="Indirekt" />
          <Legend color={LEVEL_COLORS.none} label="Nicht beansprucht" />
        </View>
      ) : null}
      {showList && (primary.length || secondary.length) ? (
        <View style={styles.list}>
          {primary.length ? <AppText variant="small"><AppText variant="small" style={{ color: LEVEL_COLORS.primary, fontWeight: '700' }}>Direkt: </AppText>{primary.map((x) => MUSCLE_LABELS[x]).join(', ')}</AppText> : null}
          {secondary.length ? <AppText variant="small"><AppText variant="small" style={{ color: LEVEL_COLORS.secondary, fontWeight: '700' }}>Indirekt: </AppText>{secondary.map((x) => MUSCLE_LABELS[x]).join(', ')}</AppText> : null}
        </View>
      ) : null}
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <AppText variant="caption" tone="secondary">{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md, alignItems: 'center' },
  figures: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xl },
  figure: { alignItems: 'center', gap: spacing.xs },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  list: { gap: 4, alignSelf: 'stretch' },
});
