import { testimonials } from '~/data/testimonials';
import { stories } from '~/data/stories';

const host = new URL(import.meta.env.SITE ?? 'https://moshik-photography.example').hostname;

/**
 * A build without the site's real address (SITE_URL), or one meant for a
 * preview domain (workers.dev, pages.dev, github.io), is a preview: every page is marked noindex so
 * sample content never reaches search engines.
 */
export const isPreview = /(^|\.)(example|workers\.dev|pages\.dev|github\.io|localhost)$/.test(host);

/** Sample reviews or stories are still on the site (`npm run checklist` lists them). */
export const hasSampleContent = testimonials.some((t) => t.sample) || stories.some((s) => s.sample);

/** The "Preview · sample content" tag shows until the site launches with real content. */
export const showPreviewTag = isPreview || hasSampleContent;
