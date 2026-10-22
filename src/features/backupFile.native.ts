import { Share } from 'react-native';

// iOS/Android: Sicherung über das Teilen-Menü weitergeben (z. B. in Dateien sichern oder per AirDrop an den Mac).

export const canImportBackupFile = false;

export async function saveBackupFile(fileName: string, json: string): Promise<void> {
  await Share.share({ title: fileName, message: json });
}

export async function pickBackupFile(): Promise<string | null> {
  return null;
}
