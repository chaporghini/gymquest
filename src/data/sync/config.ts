// Zugangsdaten für Supabase kommen ausschließlich aus Umgebungsvariablen (.env oder GitHub-Variablen).
// Der "publishable"/"anon" Key ist für Apps gedacht und darf im Code der Web-App stehen;
// geschützt sind die Daten durch Row Level Security (supabase/schema.sql).

// Anführungszeichen und Leerzeichen entfernen, falls sie beim Kopieren mit in die Variable geraten sind.
const clean = (v: string | undefined) => v?.trim().replace(/^["']|["']$/g, '').trim() || null;

export const SUPABASE_URL = clean(process.env.EXPO_PUBLIC_SUPABASE_URL);
export const SUPABASE_KEY = clean(process.env.EXPO_PUBLIC_SUPABASE_KEY);

export const isCloudConfigured = () => !!SUPABASE_URL && !!SUPABASE_KEY;

export const RECORDS_TABLE = 'gymquest_records';
