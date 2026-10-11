/**
 * Admin i18n: the page language comes from <html lang>, copy lives next to
 * the code that uses it as { he, en } objects (see docs/ARCHITECTURE.md).
 */
import type { GalleryStatus, LeadStatus } from '~/shared/gallery-types';

export type Lang = 'he' | 'en';
export type Text = { he: string; en: string };
type Vars = Record<string, string | number>;

export const lang: Lang = document.documentElement.lang === 'en' ? 'en' : 'he';
export const locale = lang === 'he' ? 'he-IL' : 'en-GB';
export const isRtl = lang === 'he';

/** Fill {placeholders}. */
export const fill = (s: string, vars: Vars = {}) => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
/** Current-language text with optional {placeholders}. */
export const T = (t: Text, vars?: Vars) => fill(t[lang], vars);
/** Text in a specific language (e.g. a message written in the gallery's language). */
export const TL = (t: Text, l: Lang, vars?: Vars) => fill(t[l], vars);

/** Bidi-isolate user content (a title, a name) inside a sentence so mixed Hebrew/English stays readable. */
export const iso = (s: string) => `⁨${s}⁩`;

const nf = new Intl.NumberFormat(locale);
export const fmtNumber = (n: number) => nf.format(n);

/** Singular / plural, `{n}` is replaced by the formatted number. */
export function plural(n: number, forms: { he: [string, string]; en: [string, string] }, l: Lang = lang): string {
  const [one, many] = forms[l];
  return fill(n === 1 ? one : many, { n: l === lang ? fmtNumber(n) : String(n) });
}

export const PHOTOS = { he: ['תמונה אחת', '{n} תמונות'], en: ['1 photo', '{n} photos'] } as { he: [string, string]; en: [string, string] };
export const photosLabel = (n: number) => plural(n, PHOTOS);

export function fmtBytes(bytes: number): string {
  const units = lang === 'he' ? ['ב׳', 'KB', 'MB', 'GB', 'TB'] : ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const digits = i >= 2 && v < 100 ? 1 : 0;
  const out = `${new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v)} ${units[i]}`;
  // "4.5 MB" should read number-then-unit inside Hebrew sentences too.
  return lang === 'he' ? `⁦${out}⁩` : out;
}

/** YYYY-MM-DD as a local noon Date (avoids timezone day shifts). */
export const parseDay = (ymd: string) => new Date(`${ymd}T12:00:00`);
export const toYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const isYmd = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

export function fmtDay(ymd: string | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }, l: Lang = lang): string {
  if (!ymd || !isYmd(ymd)) return '';
  return new Intl.DateTimeFormat(l === 'he' ? 'he-IL' : 'en-GB', opts).format(parseDay(ymd));
}

export function fmtDateTime(iso: string | undefined, withYear = true): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: withYear ? 'numeric' : undefined, hour: '2-digit', minute: '2-digit' }).format(d);
}

const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
export function relTime(iso: string | undefined): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = (t - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return T({ he: 'ממש עכשיו', en: 'just now' });
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), 'day');
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: abs > 86400 * 300 ? 'numeric' : undefined }).format(new Date(t));
}

/** Days from today (Israel) to a YYYY-MM-DD date. */
export function daysUntil(ymd: string): number {
  const today = parseDay(todayYmd());
  return Math.round((parseDay(ymd).getTime() - today.getTime()) / 86400000);
}

export function todayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
}

/** "About 3 minutes" style duration for ETAs. */
export function fmtDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '';
  if (seconds < 50) return T({ he: 'פחות מדקה', en: 'less than a minute' });
  const min = Math.round(seconds / 60);
  if (min < 60) return min === 1 ? T({ he: 'דקה', en: '1 minute' }) : T({ he: '{n} דקות', en: '{n} minutes' }, { n: min });
  const h = Math.floor(min / 60);
  const m = min % 60;
  const hours = h === 1 ? T({ he: 'שעה', en: '1 hour' }) : T({ he: '{n} שעות', en: '{n} hours' }, { n: h });
  return m ? `${hours} ${T({ he: 'ו־{m} דק׳', en: '{m} min' }, { m })}` : hours;
}

/* ── Hebrew calendar (gematria numerals, e.g. "כ״א בחשון תשפ״ז") ── */
const ONES = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
const TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
const HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];

export function gematria(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '';
  n = Math.floor(n) % 1000;
  let s = HUNDREDS[Math.floor(n / 100)]!;
  const rest = n % 100;
  if (rest === 15) s += 'טו';
  else if (rest === 16) s += 'טז';
  else s += TENS[Math.floor(rest / 10)]! + ONES[rest % 10]!;
  return s.length === 1 ? `${s}׳` : `${s.slice(0, -1)}״${s.slice(-1)}`;
}

function hebrewParts(ymd: string): { day: number; month: string; year: number } | null {
  try {
    const parts = new Intl.DateTimeFormat('he-u-ca-hebrew', { day: 'numeric', month: 'long', year: 'numeric' }).formatToParts(parseDay(ymd));
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const day = Number.parseInt(get('day'), 10);
    const year = Number.parseInt(get('year'), 10);
    const month = get('month');
    if (!day || !month) return null;
    return { day, month, year };
  } catch {
    return null;
  }
}

/** Full Hebrew date: "ב׳ בכסלו תשפ״ז". */
export function hebrewDate(ymd: string): string {
  const p = hebrewParts(ymd);
  if (!p) return '';
  return `${gematria(p.day)} ב${p.month}${p.year ? ` ${gematria(p.year)}` : ''}`;
}

/** Hebrew day of month only ("כ״א"), plus the month name on the 1st. */
export function hebrewDay(ymd: string): { day: string; month: string; first: boolean } {
  const p = hebrewParts(ymd);
  if (!p) return { day: '', month: '', first: false };
  return { day: gematria(p.day), month: p.month, first: p.day === 1 };
}

/* ── shared labels ── */
export const C = {
  save: { he: 'שמירה', en: 'Save' },
  saveChanges: { he: 'שמירת השינויים', en: 'Save changes' },
  discard: { he: 'ביטול שינויים', en: 'Discard' },
  cancel: { he: 'ביטול', en: 'Cancel' },
  close: { he: 'סגירה', en: 'Close' },
  delete: { he: 'מחיקה', en: 'Delete' },
  copy: { he: 'העתקה', en: 'Copy' },
  copied: { he: 'הועתק ✓', en: 'Copied ✓' },
  copyFailed: { he: 'לא הצלחתי להעתיק — אפשר לסמן ולהעתיק ידנית', en: 'Couldn’t copy — select the text and copy it manually' },
  retry: { he: 'לנסות שוב', en: 'Try again' },
  loading: { he: 'טוען…', en: 'Loading…' },
  saved: { he: 'נשמר ✓', en: 'Saved ✓' },
  unsaved: { he: 'יש שינויים שלא נשמרו', en: 'You have unsaved changes' },
  discardTitle: { he: 'לצאת בלי לשמור?', en: 'Leave without saving?' },
  discardText: { he: 'השינויים שעשית כאן עדיין לא נשמרו.', en: 'The changes you made here haven’t been saved yet.' },
  discardOk: { he: 'יציאה בלי לשמור', en: 'Leave without saving' },
  none: { he: '—', en: '—' },
  search: { he: 'חיפוש', en: 'Search' },
  all: { he: 'הכל', en: 'All' },
  open: { he: 'פתיחה', en: 'Open' },
  refresh: { he: 'רענון', en: 'Refresh' },
  error: { he: 'משהו השתבש. כדאי לנסות שוב.', en: 'Something went wrong. Please try again.' },
  network: { he: 'אין חיבור לשרת. כדאי לבדוק את האינטרנט ולנסות שוב.', en: 'Can’t reach the server. Check your connection and try again.' },
  server: { he: 'השרת לא הצליח להשלים את הפעולה. כדאי לנסות שוב בעוד רגע.', en: 'The server couldn’t complete that. Please try again in a moment.' },
  tooMany: { he: 'יותר מדי ניסיונות. כדאי לחכות כמה דקות ולנסות שוב.', en: 'Too many attempts. Please wait a few minutes and try again.' },
  notFound: { he: 'לא נמצא — אולי זה נמחק?', en: 'Not found — maybe it was deleted?' },
  tooLarge: { he: 'הקובץ גדול מדי (עד 100MB)', en: 'The file is too large (100 MB max)' },
};

export const galleryStatusLabel: Record<GalleryStatus, Text> = {
  draft: { he: 'טיוטה', en: 'Draft' },
  published: { he: 'מפורסמת', en: 'Published' },
  archived: { he: 'בארכיון', en: 'Archived' },
};

export const leadStatusLabel: Record<LeadStatus, Text> = {
  new: { he: 'חדשה', en: 'New' },
  contacted: { he: 'נוצר קשר', en: 'Contacted' },
  booked: { he: 'נסגרה', en: 'Booked' },
  lost: { he: 'לא נסגרה', en: 'Lost' },
};

/** Natural sort for file names (IMG_2 before IMG_10). */
export const naturalCompare = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
