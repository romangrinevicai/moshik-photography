/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  SITE CONFIGURATION — the one file to edit with Moshik's real details.
 * ─────────────────────────────────────────────────────────────────────────────
 *  Values marked `TODO(launch)` are placeholders. Run `npm run checklist`
 *  to list everything that still needs a real value before going live.
 */
import type { Localized } from '~/i18n';

export const site = {
  /** Brand wordmark shown in the logo. */
  brand: 'MOSHIK',
  name: { he: 'מושיק', en: 'Moshik' } as Localized,
  fullName: { he: 'מושיק', en: 'Moshik' } as Localized, // TODO(launch): full name for About & structured data
  tagline: {
    he: 'צילום חתונות ואירועים',
    en: 'Wedding & Event Photography',
  } as Localized,
  /** Year the business started. Used for the "years behind the camera" counter. */
  since: 2012, // TODO(launch)

  contact: {
    /** International format, digits only, no "+" — used for wa.me links. */
    whatsapp: '972500000000', // TODO(launch)
    /** E.164 format for tel: links. */
    phone: '+972500000000', // TODO(launch)
    phoneDisplay: '050-000-0000', // TODO(launch)
    email: 'hello@moshik-photography.example', // TODO(launch)
  },

  /** Social profiles. Leave a value empty ('') to hide it everywhere. */
  social: {
    facebook: 'https://www.facebook.com/moshikss',
    messenger: 'https://m.me/moshikss',
    instagram: 'https://www.instagram.com/', // TODO(launch): e.g. https://www.instagram.com/moshik.photo
    tiktok: '',
    youtube: '',
    /** Google Business Profile reviews link ("Read our reviews"). */
    googleReviews: '', // TODO(launch)
  },

  /** Optional online scheduler (Calendly / Cal.com) for intro calls. */
  schedulerUrl: '',

  location: {
    /** Shown in the footer and contact page. */
    base: { he: 'מרכז הארץ', en: 'Based in Central Israel' } as Localized, // TODO(launch)
    serviceArea: {
      he: 'צילום בכל רחבי הארץ — מהגליל ועד הערבה',
      en: 'Available all over Israel, and for destination weddings abroad',
    } as Localized,
    /** Optional studio address. Set to null when working on location only. */
    address: null as null | { street: Localized; city: Localized; postalCode?: string },
    /** Optional navigation links to the studio. */
    waze: '',
    googleMaps: '',
  },

  /**
   * Working hours in Israel time, used for the "available now" hint
   * next to WhatsApp. Days: 0 = Sunday … 6 = Saturday.
   */
  hours: {
    timeZone: 'Asia/Jerusalem',
    schedule: {
      0: ['09:00', '21:00'],
      1: ['09:00', '21:00'],
      2: ['09:00', '21:00'],
      3: ['09:00', '21:00'],
      4: ['09:00', '21:00'],
      5: ['09:00', '13:00'],
    } as Partial<Record<number, [string, string]>>,
    replyTime: { he: 'בדרך כלל עונה תוך שעה', en: 'Usually replies within an hour' } as Localized,
  },

  /** Social-proof numbers on the home page. Replace with real figures. */
  stats: {
    events: 650, // TODO(launch)
    couples: 320, // TODO(launch)
    rating: '5.0', // TODO(launch)
    reviews: 140, // TODO(launch)
  },

  pricing: {
    currency: 'ILS',
    /** Set to false to hide all prices and show "contact for a quote" instead. */
    showPrices: true,
    /** Israeli consumer law requires consumer prices to include VAT. */
    includesVat: true,
  },

  /** Optional third-party services. Leave empty to disable. */
  integrations: {
    /** Cloudflare Turnstile site key (spam protection on the booking form). */
    turnstileSiteKey: '',
    /** Google Analytics 4 measurement ID, e.g. G-XXXXXXX. */
    ga4: '',
    /** Meta (Facebook/Instagram) Pixel ID. */
    metaPixel: '',
  },

  features: {
    /** TEMPORARY: header button that switches between design directions (src/config/themes.ts). */
    themeSwitcher: true,
    /** Private client galleries (requires the Cloudflare Worker + R2 bucket). */
    clientGalleries: true,
    /** Floating accessibility menu (text size, contrast, motion…). */
    accessibilityMenu: true,
  },

  /** Accessibility coordinator, shown in the accessibility statement. */
  accessibilityContact: {
    name: { he: 'מושיק', en: 'Moshik' } as Localized, // TODO(launch)
    lastReviewed: '2026-10-11',
  },
} as const;

export type SiteConfig = typeof site;

/** wa.me deep link with an optional pre-filled message. */
export function whatsappLink(message?: string): string {
  const base = `https://wa.me/${site.contact.whatsapp}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export const telLink = `tel:${site.contact.phone}`;
export const mailLink = `mailto:${site.contact.email}`;
