// iOS/Android: localStorage-kompatibler Speicher auf Basis von SQLite (von Supabase für Expo empfohlen).
import 'expo-sqlite/localStorage/install';

export function getAuthStorage(): Storage | undefined {
  return globalThis.localStorage;
}
