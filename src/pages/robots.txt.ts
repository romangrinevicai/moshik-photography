import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL('sitemap-index.xml', site ?? 'https://moshik-photography.example').href;
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin/',
    'Disallow: /en/admin/',
    'Disallow: /gallery/',
    'Disallow: /en/gallery/',
    'Disallow: /api/',
    'Disallow: /media/',
    'Disallow: /thank-you/',
    'Disallow: /en/thank-you/',
    '',
    `Sitemap: ${sitemap}`,
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
