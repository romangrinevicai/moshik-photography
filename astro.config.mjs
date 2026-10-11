// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

/**
 * The public URL of the site. Used for canonical links, Open Graph tags,
 * hreflang alternates and the sitemap. Set SITE_URL in your hosting
 * provider's build settings (or edit the fallback below) before launch.
 */
const SITE_URL = process.env.SITE_URL || 'https://moshik-photography.example';

export default defineConfig({
  site: SITE_URL,
  // Lets parallel builds (e.g. separate git worktrees) keep separate caches.
  cacheDir: process.env.ASTRO_CACHE_DIR || './node_modules/.astro',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
    inlineStylesheets: 'always',
  },
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
  image: {
    // Generated photos are cached between builds in node_modules/.astro
    responsiveStyles: false,
  },
  integrations: [
    sitemap({
      filter: (page) =>
        !/\/(admin|gallery|thank-you)(\/|$)/.test(new URL(page).pathname),
      i18n: {
        defaultLocale: 'he',
        locales: { he: 'he-IL', en: 'en-US' },
      },
    }),
  ],
  vite: {
    build: {
      assetsInlineLimit: 2048,
      // The face-recognition engine (~1.3 MB) is a lazily loaded chunk.
      chunkSizeWarningLimit: 1400,
    },
  },
});
