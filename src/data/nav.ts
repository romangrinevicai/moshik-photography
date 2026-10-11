import type { UiKey } from '~/i18n';

export interface NavItem {
  key: UiKey;
  href: string;
  /** Render the services mega-menu under this item. */
  services?: boolean;
}

export const mainNav: NavItem[] = [
  { key: 'nav.portfolio', href: '/portfolio/' },
  { key: 'nav.services', href: '/services/', services: true },
  { key: 'nav.stories', href: '/stories/' },
  { key: 'nav.pricing', href: '/pricing/' },
  { key: 'nav.about', href: '/about/' },
];

export const footerNav: NavItem[] = [
  { key: 'nav.home', href: '/' },
  { key: 'nav.portfolio', href: '/portfolio/' },
  { key: 'nav.stories', href: '/stories/' },
  { key: 'nav.pricing', href: '/pricing/' },
  { key: 'nav.about', href: '/about/' },
  { key: 'nav.faq', href: '/faq/' },
  { key: 'nav.contact', href: '/contact/' },
  { key: 'nav.gallery', href: '/gallery/' },
];
