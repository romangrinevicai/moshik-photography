/** Strings, plurals, numbers, dates and byte sizes for the client gallery. */
import type { ClientStrings, CopyKey, Plural } from '~/components/gallery/copy';

export type Vars = Record<string, string | number>;

let strings = {} as ClientStrings;
let lang: 'he' | 'en' = 'he';
let locale = 'he-IL';
let plurals = new Intl.PluralRules('he');
let numbers = new Intl.NumberFormat('he-IL');

export function initFormat(s: ClientStrings, l: 'he' | 'en') {
  strings = s;
  lang = l;
  locale = l === 'he' ? 'he-IL' : 'en-US';
  plurals = new Intl.PluralRules(l);
  numbers = new Intl.NumberFormat(locale);
}

export const getLang = () => lang;
export const fmtNum = (n: number) => numbers.format(n);

const fill = (s: string, vars?: Vars) =>
  vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(typeof vars[k] === 'number' ? fmtNum(vars[k] as number) : vars[k]) : m)) : s;

/** Translate a key, filling {placeholders}. */
export function t(key: CopyKey, vars?: Vars): string {
  const v = strings[key];
  if (v === undefined) return key;
  return fill(typeof v === 'string' ? v : v.other, vars);
}

/** Plural-aware translation: {n} is replaced by the formatted count. */
export function tn(key: CopyKey, n: number, vars?: Vars): string {
  const v = strings[key];
  if (v === undefined) return String(n);
  if (typeof v === 'string') return fill(v, { n, ...vars });
  const cat = plurals.select(n) as keyof Plural;
  const form = (cat === 'one' && n === 1 ? v.one : cat === 'two' ? (v.two ?? v.other) : v.other) ?? v.other;
  return fill(form, { n, ...vars });
}

/** "1.2 GB", "340 MB" — decimal units, like the OS file manager on most phones. */
export function fmtBytes(bytes: number): string {
  const units: [string, number][] = [
    ['gigabyte', 1e9],
    ['megabyte', 1e6],
    ['kilobyte', 1e3],
  ];
  for (const [unit, size] of units) {
    if (bytes >= size * 0.95 || unit === 'kilobyte') {
      const v = bytes / size;
      return new Intl.NumberFormat(locale, {
        style: 'unit',
        unit,
        unitDisplay: 'short',
        maximumFractionDigits: v < 10 && unit !== 'kilobyte' ? 1 : 0,
      }).format(v);
    }
  }
  return `${bytes} B`;
}

/** "12 September 2026" / "12 בספטמבר 2026" from a YYYY-MM-DD string. */
export function fmtDate(value?: string): string {
  if (!value) return '';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

const esc: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => esc[c]!);

/** "Your photos are *waiting*" → escaped HTML with <em>. */
export const accent = (s: string) => escapeHtml(s).replace(/\*(.+?)\*/g, '<em>$1</em>');
