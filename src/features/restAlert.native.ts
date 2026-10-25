// Nativ: Signal über Vibration (siehe workout/active.tsx). Ton und Benachrichtigung bisher nur im Web.
export function primeRestSound() {}
export function canNotify() {
  return false;
}
export function notificationsAllowed() {
  return false;
}
export async function requestNotifications() {
  return false;
}
export function playRestEnd(_options: { sound: boolean; notify: boolean; exerciseName?: string }) {}
