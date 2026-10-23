import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { BarChart, LineChart } from 'react-native-gifted-charts';

import { AppText, Card } from '@/components';
import { colors, spacing } from '@/theme/tokens';

interface ChartCardProps {
  title: string;
  /** Zeitraum, z. B. „Letzte 8 Wochen“ */
  period: string;
  /** Einheit der y-Achse */
  unit: string;
  /** Text, wenn (noch) keine Daten vorliegen; ersetzt das Diagramm */
  empty?: string | null;
  /** Kurzbeschreibung der Werte für Screenreader */
  summary: string;
  controls?: ReactNode;
  footnote?: string;
  children: (width: number) => ReactNode;
}

/** Rahmen für jedes Diagramm: Titel, Zeitraum, Einheit und Hinweis bei fehlenden Daten. */
export function ChartCard({ title, period, unit, empty, summary, controls, footnote, children }: ChartCardProps) {
  const [width, setWidth] = useState(0);
  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <AppText variant="heading" accessibilityRole="header">{title}</AppText>
        <AppText variant="small" tone="secondary">{period} · y-Achse: {unit}</AppText>
      </View>
      {controls}
      {empty ? (
        <AppText tone="secondary" style={styles.empty}>{empty}</AppText>
      ) : (
        <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessible accessibilityLabel={`${title}, ${period}, in ${unit}: ${summary}`}>
          {width > 0 ? children(width) : null}
        </View>
      )}
      {footnote && !empty ? <AppText variant="caption" tone="secondary">{footnote}</AppText> : null}
    </Card>
  );
}

const axis = {
  yAxisThickness: 0,
  xAxisThickness: 1,
  xAxisColor: colors.border,
  rulesColor: colors.border,
  rulesType: 'solid' as const,
  yAxisTextStyle: { color: colors.textSecondary, fontSize: 11 },
  xAxisLabelTextStyle: { color: colors.textSecondary, fontSize: 10 },
  yAxisLabelWidth: 36,
  noOfSections: 4,
};

export interface Bar {
  value: number;
  label: string;
  /** laufender Zeitraum: heller dargestellt */
  muted?: boolean;
  selected?: boolean;
  onPress?: () => void;
}

export function Bars({ data, width, height = 160 }: { data: Bar[]; width: number; height?: number }) {
  const inner = width - 44;
  return (
    <BarChart
      {...axis}
      data={data.map((d) => ({ value: d.value, label: d.label, onPress: d.onPress, frontColor: d.selected ? colors.text : d.muted ? colors.accentHalf : colors.accent }))}
      width={inner}
      height={height}
      barWidth={Math.max(10, inner / data.length - 12)}
      spacing={10}
      initialSpacing={6}
      endSpacing={4}
      maxValue={niceMax(Math.max(4, ...data.map((d) => d.value)))}
      barBorderRadius={4}
      disableScroll
    />
  );
}

export function Line({ data, width, height = 160, fromZero = true }: { data: { value: number; label: string }[]; width: number; height?: number; fromZero?: boolean }) {
  const inner = width - 44;
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Körpergewicht und Gewichte: Achse nicht bei 0 beginnen, damit Veränderungen sichtbar sind.
  const offset = fromZero ? 0 : Math.max(0, Math.floor((min - Math.max(2, (max - min) * 0.2)) / 5) * 5);
  const step = data.length > 1 ? Math.max(18, (inner - 24) / (data.length - 1)) : 0;
  // Bei vielen Punkten nur jede n-te Beschriftung zeigen.
  const every = Math.max(1, Math.ceil(data.length / 5));
  // Beschriftungen sind sonst nur so breit wie der Punktabstand und werden abgeschnitten.
  const extra = Math.max(0, 44 - step);
  const labelStyle = { ...axis.xAxisLabelTextStyle, marginLeft: -extra / 2 };
  return (
    <LineChart
      {...axis}
      labelsExtraHeight={extra}
      data={data.map((d, i) => ({ value: d.value, label: i % every === 0 || i === data.length - 1 ? d.label : '', labelTextStyle: labelStyle }))}
      width={inner}
      height={height}
      spacing={step}
      initialSpacing={12}
      endSpacing={12}
      yAxisOffset={offset}
      maxValue={niceMax(max - offset)}
      color={colors.accent}
      thickness={2}
      dataPointsColor={colors.accent}
      dataPointsRadius={3}
      disableScroll={step * data.length < inner * 1.5}
      formatYLabel={(v: string) => String(Math.round(Number(v) * 10) / 10).replace('.', ',')}
    />
  );
}

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 4 ? 4 : n <= 5 ? 5 : n <= 8 ? 8 : 10;
  return nice * pow;
}

const styles = StyleSheet.create({
  card: { gap: spacing.md, overflow: 'hidden' },
  head: { gap: 2 },
  empty: { paddingVertical: spacing.lg },
});
