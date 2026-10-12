/**
 * Where the site is served from. The production Worker serves it at the
 * domain root ("/"); the GitHub Pages preview serves it under a sub-path
 * (BASE_PATH=/moshik-photography at build time).
 */
export const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/+$/, '');

/** Prefix a root-relative path ("/en/") with the base path. Other URLs pass through. */
export const withBase = (path: string): string => (path.startsWith('/') && !path.startsWith('//') && !path.startsWith(BASE + '/') ? BASE + path : path);

/**
 * A static build without the Cloudflare backend (PUBLIC_STATIC_SITE=1, used for
 * the GitHub Pages preview): forms and galleries run in demo mode, with no /api calls.
 */
export const STATIC_SITE = import.meta.env.PUBLIC_STATIC_SITE === '1';
