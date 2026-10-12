/** Availability lookups shared by the date checker and the booking form. */
import { STATIC_SITE } from '~/config/base';

export interface Availability {
  booked: string[];
  limited: string[];
}
export type DateStatus = 'available' | 'limited' | 'booked' | 'past' | 'invalid';

let cache: Promise<Availability> | null = null;

export function loadAvailability(fallback: Availability): Promise<Availability> {
  if (STATIC_SITE) return Promise.resolve(fallback);
  cache ??= fetch('/api/availability', { headers: { accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((d: Partial<Availability>) => ({ booked: d.booked ?? [], limited: d.limited ?? [] }))
    .catch(() => fallback);
  return cache;
}

export function todayInIsrael(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
}

export function statusFor(date: string, a: Availability): DateStatus {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'invalid';
  if (date < todayInIsrael()) return 'past';
  if (a.booked.includes(date)) return 'booked';
  if (a.limited.includes(date)) return 'limited';
  return 'available';
}

export function formatLongDate(date: string, lang: 'he' | 'en'): string {
  const d = new Date(`${date}T12:00:00`);
  return new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

/** The Hebrew calendar date, e.g. "כ״א בחשון תשפ״ז" — many couples plan by it. */
export function hebrewDate(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  try {
    return new Intl.DateTimeFormat('he-u-ca-hebrew', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  } catch {
    return '';
  }
}
