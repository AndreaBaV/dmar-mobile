const STORAGE_KEY = 'dmar_week_session_until';

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function getSessionExpiresAt(): number | null {
  const v = localStorage.getItem(STORAGE_KEY);
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

export function isWeeklySessionValid(): boolean {
  const t = getSessionExpiresAt();
  return t != null && Date.now() < t;
}

export function renewWeeklySession(): void {
  localStorage.setItem(STORAGE_KEY, String(Date.now() + WEEK_MS));
}

export function clearWeeklySession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function formatSessionExpiry(): string {
  const t = getSessionExpiresAt();
  if (!t) return '—';
  return new Date(t).toLocaleString();
}
