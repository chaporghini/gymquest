// Signal bei Pausenende im Browser bzw. in der Homescreen-App: kurzer Ton und, falls erlaubt
// und die App nicht im Vordergrund ist, eine Benachrichtigung.

let ctx: AudioContext | null = null;

/** Muss bei einer Nutzeraktion (z. B. Satz abhaken) aufgerufen werden, sonst blockiert iOS den Ton. */
export function primeRestSound() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    // Ton ist nur ein Extra
  }
}

function beep(at: number, freq: number) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.4, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.25);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + 0.3);
}

export function canNotify() {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

export function notificationsAllowed() {
  return canNotify() && Notification.permission === 'granted';
}

/** Fragt nach der Erlaubnis für Benachrichtigungen. true, wenn erlaubt. */
export async function requestNotifications(): Promise<boolean> {
  if (!canNotify()) return false;
  if (Notification.permission === 'granted') return true;
  return (await Notification.requestPermission()) === 'granted';
}

export function playRestEnd(options: { sound: boolean; notify: boolean; exerciseName?: string }) {
  if (options.sound && ctx) {
    try {
      if (ctx.state === 'suspended') void ctx.resume();
      const t = ctx.currentTime + 0.05;
      beep(t, 880);
      beep(t + 0.3, 880);
      beep(t + 0.6, 1320);
    } catch {
      // ignorieren
    }
  }
  if (options.notify && notificationsAllowed() && document.visibilityState !== 'visible') {
    navigator.serviceWorker.ready
      .then((reg) => reg.showNotification('Pause vorbei', { body: options.exerciseName ? `Weiter mit ${options.exerciseName}.` : 'Weiter geht’s mit dem nächsten Satz.', tag: 'gymquest-rest' }))
      .catch(() => {});
  }
}
