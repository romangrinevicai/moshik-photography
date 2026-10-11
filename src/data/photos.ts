/**
 * Photo library.
 *
 * Every image inside src/assets/photos is picked up automatically and
 * optimised at build time (AVIF/WebP, responsive sizes). To add or replace
 * photos, drop JPGs into the matching folder — files are ordered by name.
 *
 *   hero/                      home page slideshow
 *   portfolio/<category>/      portfolio grid, filtered by category
 *   stories/<story-slug>/      photos for each featured story
 *   about/                     Moshik's portrait and behind-the-scenes
 */
import type { ImageMetadata } from 'astro';
import type { Lang, Localized } from '~/i18n';

const modules = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/photos/**/*.{jpg,jpeg,JPG,JPEG,png,webp,avif}',
  { eager: true },
);

export interface Photo {
  /** Path relative to src/assets/photos, e.g. "portfolio/weddings/01.jpg" */
  id: string;
  src: ImageMetadata;
  width: number;
  height: number;
  orientation: 'landscape' | 'portrait' | 'square';
}

const ROOT = '/src/assets/photos/';

const all: Photo[] = Object.entries(modules)
  .map(([path, mod]) => {
    const src = mod.default;
    const ratio = src.width / src.height;
    return {
      id: path.slice(ROOT.length),
      src,
      width: src.width,
      height: src.height,
      orientation: ratio > 1.08 ? 'landscape' : ratio < 0.92 ? 'portrait' : 'square',
    } satisfies Photo;
  })
  .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));

/** All photos inside a folder (non-recursive), sorted by file name. */
export function photosIn(folder: string): Photo[] {
  const prefix = folder.endsWith('/') ? folder : `${folder}/`;
  return all.filter((p) => p.id.startsWith(prefix) && !p.id.slice(prefix.length).includes('/'));
}

/** A single photo by id. Throws at build time if it does not exist. */
export function photo(id: string): Photo {
  const found = all.find((p) => p.id === id);
  if (!found) {
    throw new Error(`[photos] "${id}" was not found in src/assets/photos. Check the file name.`);
  }
  return found;
}

/** First photo of a folder (useful for covers). */
export function firstIn(folder: string): Photo {
  const list = photosIn(folder);
  if (!list.length) throw new Error(`[photos] No photos found in "${folder}".`);
  return list[0]!;
}

/**
 * Optional hand-written alt text. Keys are photo ids. Anything not listed
 * gets a sensible generated description.
 */
const altText: Record<string, Localized> = {
  'about/moshik.jpg': { he: 'מושיק, צלם חתונות ואירועים', en: 'Moshik, wedding and event photographer' },
};

const categoryAlt: Record<string, Localized> = {
  hero: { he: 'צילום חתונות ואירועים', en: 'Wedding and event photography' },
  weddings: { he: 'צילום חתונה', en: 'Wedding photography' },
  'bar-bat-mitzvah': { he: 'צילום בר ובת מצווה', en: 'Bar and bat mitzvah photography' },
  events: { he: 'צילום אירוע', en: 'Event photography' },
  portraits: { he: 'צילום פורטרט ומשפחה', en: 'Portrait and family photography' },
  couples: { he: 'צילומי זוגיות', en: 'Couple photography' },
  corporate: { he: 'צילום עסקי ותדמית', en: 'Corporate and brand photography' },
  stories: { he: 'מתוך הסיפור', en: 'From the story' },
  about: { he: 'מאחורי הקלעים', en: 'Behind the scenes' },
};

export function altFor(p: Photo, lang: Lang, context?: string): string {
  const manual = altText[p.id];
  if (manual) return manual[lang];
  const parts = p.id.split('/');
  const key = parts[0] === 'portfolio' ? parts[1] ?? '' : parts[0] ?? '';
  const base = categoryAlt[key]?.[lang] ?? (lang === 'he' ? 'צילום' : 'Photograph');
  const by = lang === 'he' ? 'מאת מושיק' : 'by Moshik';
  return context ? `${base} — ${context}` : `${base} ${by}`;
}
