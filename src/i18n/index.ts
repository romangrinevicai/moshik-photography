import { withBase } from '../shared/base';

export const languages = {
  he: { label: 'עברית', short: 'עב', dir: 'rtl', locale: 'he-IL', ogLocale: 'he_IL' },
  en: { label: 'English', short: 'EN', dir: 'ltr', locale: 'en-US', ogLocale: 'en_US' },
} as const;

export type Lang = keyof typeof languages;
export const langs = Object.keys(languages) as Lang[];
export const defaultLang: Lang = 'he';

/** A value provided in every supported language. */
export type Localized<T = string> = { [K in Lang]: T };

export const otherLang = (lang: Lang): Lang => (lang === 'he' ? 'en' : 'he');
export const dirOf = (lang: Lang) => languages[lang].dir;

/** Prefix a site path with the language segment (Hebrew is the default, unprefixed). */
export function localizePath(path: string, lang: Lang): string {
  let p = path.startsWith('/') ? path : `/${path}`;
  if (!p.endsWith('/') && !p.includes('#') && !p.includes('?') && !/\.[a-z0-9]+$/i.test(p)) p += '/';
  if (lang !== defaultLang) p = p === '/' ? `/${lang}/` : `/${lang}${p}`;
  return withBase(p);
}

/** Remove a language prefix from a pathname, returning the language-neutral path. */
export function stripLang(pathname: string): string {
  for (const lang of langs) {
    if (lang === defaultLang) continue;
    if (pathname === `/${lang}` || pathname === `/${lang}/`) return '/';
    if (pathname.startsWith(`/${lang}/`)) return pathname.slice(lang.length + 1);
  }
  return pathname || '/';
}

export function langFromPath(pathname: string): Lang {
  const seg = pathname.split('/')[1];
  return (langs as string[]).includes(seg ?? '') ? (seg as Lang) : defaultLang;
}

const numberFormatters = new Map<string, Intl.NumberFormat>();

/** Format a price in shekels, e.g. "₪7,900". */
export function formatPrice(amount: number, lang: Lang, currency = 'ILS'): string {
  const key = `${lang}-${currency}`;
  let fmt = numberFormatters.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(languages[lang].locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    });
    numberFormatters.set(key, fmt);
  }
  return fmt.format(amount);
}

export function formatNumber(n: number, lang: Lang): string {
  return new Intl.NumberFormat(languages[lang].locale).format(n);
}

export function formatDate(date: string | Date, lang: Lang, opts?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(`${date}T12:00:00`) : date;
  return new Intl.DateTimeFormat(languages[lang].locale, opts ?? { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

export { ui, useTranslations, type UiKey } from './ui';
