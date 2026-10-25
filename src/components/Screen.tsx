import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, MAX_CONTENT_WIDTH, MAX_WIDE_WIDTH, spacing } from '@/theme/tokens';

export interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Breiter Inhalt auf großen Bildschirmen (für mehrspaltige Seiten). */
  wide?: boolean;
}

/** Bildschirm-Grundgerüst: sichere Bereiche, Tastatur, Scrollen und begrenzte Breite auf großen Displays. */
export function Screen({ children, scroll = true, edges = ['top'], footer, contentStyle, refreshing, onRefresh, wide }: ScreenProps) {
  const content = <View style={[styles.content, wide && styles.wide, contentStyle]}>{children}</View>;
  return (
    <SafeAreaView style={styles.root} edges={edges}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.accent} /> : undefined}>
            {content}
          </ScrollView>
        ) : (
          content
        )}
        {footer ? <View style={styles.footer}><View style={styles.footerInner}>{footer}</View></View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, alignItems: 'center' },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  wide: { maxWidth: MAX_WIDE_WIDTH },
  footer: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  footerInner: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
});
