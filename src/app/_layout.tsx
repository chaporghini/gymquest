import { DarkTheme, router, Stack, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, TriangleAlert } from 'lucide-react-native';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppText, EmptyState } from '@/components';
import { AppProvider, useApp } from '@/state/AppProvider';
import { NATIVE_FONTS } from '@/theme/fonts';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.border,
    notification: colors.accent,
  },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(NATIVE_FONTS);
  if (!fontsLoaded && !fontError) return null;
  return (
    <SafeAreaProvider>
      <ThemeProvider value={navigationTheme}>
        <AppProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </AppProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { status, error, retry, profile } = useApp();

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync().catch(() => {});
  }, [status]);

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
        <AppText tone="secondary">GymQuest lädt …</AppText>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.center}>
        <EmptyState
          icon={TriangleAlert}
          tone="error"
          title="Daten konnten nicht geladen werden"
          message={`Die lokale Datenbank ist nicht erreichbar. Deine gespeicherten Daten bleiben erhalten.\n\nDetails: ${error ?? 'unbekannter Fehler'}`}
          actionLabel="Erneut versuchen"
          onAction={retry}
        />
      </View>
    );
  }

  const header = {
    headerShown: true,
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.text,
    headerTitleStyle: { fontWeight: '700' as const },
    headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal' as const,
    // Immer ein Zurück-Pfeil, auch wenn die Seite direkt oder nach einem Neuladen geöffnet wurde (dann gibt es keinen Verlauf).
    headerLeft: () => <BackButton />,
  };

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={!profile} redirectTo="/">
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!!profile} redirectTo="/onboarding">
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="workout/active" options={{ presentation: 'fullScreenModal', gestureEnabled: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="workout/summary" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="plan/edit" options={{ ...header, title: 'Plan bearbeiten' }} />
        <Stack.Screen name="plan/builder" options={{ ...header, title: 'Plan bearbeiten' }} />
        <Stack.Screen name="plan/create" options={{ ...header, title: 'Trainingsplan erstellen' }} />
        <Stack.Screen name="muscle/[id]" options={{ ...header, title: 'Muskelgruppe' }} />
        <Stack.Screen name="lesson/[id]" options={{ ...header, title: 'Techniklektion' }} />
        <Stack.Screen name="settings" options={{ ...header, title: 'Einstellungen', headerLeft: () => <BackButton fallback="/profile" /> }} />
        <Stack.Screen name="plan/day/[dayId]" options={{ ...header, title: 'Einheit bearbeiten' }} />
        <Stack.Screen name="library/index" options={{ ...header, title: 'Übungsbibliothek' }} />
        <Stack.Screen name="library/[id]" options={{ ...header, title: 'Übung' }} />
        <Stack.Screen name="history/[id]" options={{ ...header, title: 'Training' }} />
        <Stack.Screen name="profile/edit" options={{ ...header, title: 'Profil bearbeiten' }} />
        <Stack.Screen name="day/[dayId]" options={{ ...header, title: 'Trainingsdetails' }} />
        <Stack.Screen name="quest/[id]" options={{ ...header, title: 'Quest' }} />
        <Stack.Screen name="progress" options={{ ...header, title: 'XP & Ränge' }} />
        <Stack.Screen name="report" options={{ ...header, title: 'Dein Fortschritt' }} />
      </Stack.Protected>
      <Stack.Screen name="account" options={{ ...header, title: 'Konto & Daten', headerLeft: () => <BackButton fallback="/profile" /> }} />
      <Stack.Screen name="+not-found" options={{ ...header, title: 'Nicht gefunden' }} />
    </Stack>
  );
}

function BackButton({ fallback = '/' }: { fallback?: '/' | '/profile' }) {
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
      accessibilityRole="button"
      accessibilityLabel="Zurück"
      hitSlop={8}
      style={styles.back}>
      <ArrowLeft size={24} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
});
