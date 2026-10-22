// Zugangsdaten für Supabase kommen ausschließlich aus Umgebungsvariablen (.env oder GitHub-Variablen).
// Der "publishable"/"anon" Key ist für Apps gedacht und darf im Code der Web-App stehen;
// geschützt sind die Daten durch Row Level Security (supabase/schema.sql).

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || null;
export const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY?.trim() || null;

export const isCloudConfigured = () => !!SUPABASE_URL && !!SUPABASE_KEY;

export const RECORDS_TABLE = 'gymquest_records';
