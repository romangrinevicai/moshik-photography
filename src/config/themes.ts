import type { Localized } from '~/i18n';

/**
 * TEMPORARY — design directions to compare, switched with the header button
 * (src/components/layout/ThemeSwitcher.astro, src/styles/themes/*). "classic"
 * is the original design. Shareable link: any page + `?theme=noir`.
 */
export const themes: { id: string; name: Localized }[] = [
  { id: 'classic', name: { he: 'קלאסי', en: 'Classic' } },
  { id: 'noir', name: { he: 'נואר', en: 'Noir' } },
  { id: 'gallery', name: { he: 'גלריה', en: 'Gallery' } },
  { id: 'romance', name: { he: 'רומנטי', en: 'Romance' } },
];
