// Web: Supabase speichert die Anmeldung im localStorage des Browsers.
export function getAuthStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}
