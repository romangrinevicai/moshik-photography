/** Structured data (JSON-LD) helpers for rich results in Google. */
import { site } from '~/config/site';
import { localizePath, languages, type Lang } from '~/i18n';
import { startingPrice } from './packages';
import type { FaqItem } from './faq';

const base = () => new URL(import.meta.env.SITE ?? 'https://moshik-photography.example');
const abs = (path: string, lang: Lang) => new URL(localizePath(path, lang), base()).href;

export function businessSchema(lang: Lang, image?: string) {
  const sameAs = Object.entries(site.social)
    .filter(([k, v]) => v && k !== 'messenger' && !/instagram\.com\/?$/.test(v))
    .map(([, v]) => v);
  const min = startingPrice('portraits') ?? 0;
  const max = startingPrice('weddings') ?? 0;
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'ProfessionalService'],
    '@id': `${base().href}#business`,
    name: `${site.name[lang]} — ${site.tagline[lang]}`,
    alternateName: site.name[lang === 'he' ? 'en' : 'he'],
    url: abs('/', lang),
    telephone: site.contact.phone,
    email: site.contact.email,
    description: site.tagline[lang],
    inLanguage: languages[lang].locale,
    areaServed: { '@type': 'Country', name: lang === 'he' ? 'ישראל' : 'Israel' },
    priceRange: site.pricing.showPrices && max ? `₪${min}–₪${max}+` : '₪₪₪',
    currenciesAccepted: 'ILS',
    founder: { '@type': 'Person', name: site.fullName[lang], jobTitle: lang === 'he' ? 'צלם' : 'Photographer' },
    knowsLanguage: ['he', 'en'],
    sameAs,
  };
  if (image) data.image = image;
  if (site.location.address) {
    data.address = {
      '@type': 'PostalAddress',
      streetAddress: site.location.address.street[lang],
      addressLocality: site.location.address.city[lang],
      postalCode: site.location.address.postalCode,
      addressCountry: 'IL',
    };
  } else {
    data.address = { '@type': 'PostalAddress', addressCountry: 'IL' };
  }
  return data;
}

export function websiteSchema(lang: Lang) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${base().href}#website`,
    url: abs('/', lang),
    name: site.name[lang],
    inLanguage: languages[lang].locale,
    publisher: { '@id': `${base().href}#business` },
  };
}

export function breadcrumbSchema(lang: Lang, items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: abs(item.path, lang),
    })),
  };
}

export function faqSchema(lang: Lang, items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({
      '@type': 'Question',
      name: f.q[lang],
      acceptedAnswer: { '@type': 'Answer', text: f.a[lang] },
    })),
  };
}

export function serviceSchema(lang: Lang, opts: { name: string; description: string; path: string; price?: number }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: opts.name,
    description: opts.description,
    url: abs(opts.path, lang),
    provider: { '@id': `${base().href}#business` },
    areaServed: { '@type': 'Country', name: lang === 'he' ? 'ישראל' : 'Israel' },
    ...(opts.price && site.pricing.showPrices
      ? { offers: { '@type': 'Offer', priceCurrency: 'ILS', price: opts.price, description: lang === 'he' ? 'החל מ' : 'Starting from' } }
      : {}),
  };
}

export function articleSchema(lang: Lang, opts: { title: string; description: string; path: string; image?: string; date: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: opts.title,
    description: opts.description,
    url: abs(opts.path, lang),
    image: opts.image,
    datePublished: `${opts.date}-01`,
    inLanguage: languages[lang].locale,
    author: { '@type': 'Person', name: site.fullName[lang] },
    publisher: { '@id': `${base().href}#business` },
  };
}
