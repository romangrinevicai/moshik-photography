import type { APIRoute } from 'astro';
import { site } from '~/config/site';

/** "Save contact" card — adds Moshik to the visitor's phone contacts in one tap. */
export const GET: APIRoute = ({ site: siteUrl }) => {
  const esc = (s: string) => s.replace(/([,;\\])/g, '\\$1');
  const url = siteUrl?.href ?? '';
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:;${esc(site.fullName.en)};;;`,
    `FN:${esc(site.fullName.en)} — ${esc(site.tagline.en)}`,
    `ORG:${esc(site.name.en)} Photography`,
    `TITLE:${esc(site.tagline.en)}`,
    `TEL;TYPE=CELL,VOICE:${site.contact.phone}`,
    `EMAIL;TYPE=INTERNET:${site.contact.email}`,
    url && `URL:${url}`,
    site.social.instagram && !/instagram\.com\/?$/.test(site.social.instagram) && `X-SOCIALPROFILE;TYPE=instagram:${site.social.instagram}`,
    site.social.facebook && `X-SOCIALPROFILE;TYPE=facebook:${site.social.facebook}`,
    `NOTE:${esc(site.tagline.he)} · WhatsApp: https://wa.me/${site.contact.whatsapp}`,
    'END:VCARD',
  ].filter(Boolean);
  return new Response(lines.join('\r\n') + '\r\n', {
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': 'attachment; filename="moshik.vcf"',
    },
  });
};
