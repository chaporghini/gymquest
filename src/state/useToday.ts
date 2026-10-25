import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

const stamp = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;

/**
 * Aktuelles Datum für Ansichten wie „Heute“ oder die Wochenübersicht. Ändert sich, sobald eine neue Stunde
 * oder ein neuer Tag beginnt, auch wenn die App über Nacht offen bleibt.
 */
export function useToday(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const check = () =>
      setNow((prev) => {
        const next = new Date();
        return stamp(prev) === stamp(next) ? prev : next;
      });
    const interval = setInterval(check, 60_000);
    const sub = AppState.addEventListener('change', (state) => state === 'active' && check());
    const onVisible = () => document.visibilityState === 'visible' && check();
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      sub.remove();
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return now;
}
