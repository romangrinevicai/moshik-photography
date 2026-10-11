/** Share tab: links, access code, WhatsApp / email message, QR code and a printable table card. */
import { errorText } from '../core/api';
import { $, $$, h, icon } from '../core/dom';
import { TL, T, fmtDay, isYmd, type Lang } from '../core/i18n';
import { copyWithToast, downloadBlob, setBusy, slugFile, toast, toastError } from '../core/ui';
import { waLink } from '../lib/phone';
import { ed, on, syncNow } from './state';

const S = {
  he: { he: 'עברית', en: 'Hebrew' },
  en: { he: 'אנגלית', en: 'English' },
  linkCopied: { he: 'הקישור הועתק', en: 'Link copied' },
  codeCopied: { he: 'הקוד הועתק', en: 'Code copied' },
  msgCopied: { he: 'ההודעה הועתקה — אפשר להדביק בכל מקום', en: 'Message copied — paste it anywhere' },
  published: { he: 'הגלריה פורסמה 🎉', en: 'Gallery published 🎉' },
  qrAlt: { he: 'קוד QR לגלריה', en: 'QR code for the gallery' },
  pngError: { he: 'לא הצלחתי ליצור את התמונה', en: 'Couldn’t create the image' },
  printHint: { he: 'בחלון ההדפסה אפשר גם לשמור כ־PDF.', en: 'In the print dialog you can also save it as a PDF.' },
  draftWarn: {
    he: 'הגלריה עדיין טיוטה — מי שיפתח את הקישור יראה שהיא עוד לא זמינה. כדאי לפרסם לפני ששולחים.',
    en: 'This gallery is still a draft — anyone opening the link will see it isn’t available yet. Publish before you send it.',
  },
  archivedWarn: {
    he: 'הגלריה בארכיון. כדי שהקישור יעבוד, צריך לפרסם אותה שוב.',
    en: 'This gallery is archived. Publish it again so the link works.',
  },
  msg: {
    he: 'היי! 🎉\nהגלריה "{title}" מוכנה ✨\nלצפייה והורדת התמונות:\n{link}\nקוד גישה: {code}\n{tip}\nבאהבה,\nמושיק 📸',
    en: 'Hi! 🎉\nYour gallery “{title}” is ready ✨\nView and download your photos here:\n{link}\nAccess code: {code}\n{tip}\nWith love,\nMoshik 📸',
  },
  tip: { he: 'טיפ: אפשר למצוא את כל התמונות שלכם בעזרת סלפי 🤳\n', en: 'Tip: find all of your photos with a selfie 🤳\n' },
  subject: { he: 'הגלריה שלכם מוכנה ✨ {title}', en: 'Your gallery is ready ✨ {title}' },
  cta: {
    he: 'סרקו כדי לראות את התמונות מהערב — ולמצוא את עצמכם עם סלפי',
    en: 'Scan to see tonight’s photos & find yourself with a selfie',
  },
  ctaNoFaces: { he: 'סרקו כדי לראות את התמונות מהערב', en: 'Scan to see tonight’s photos' },
  visit: { he: 'או היכנסו ל־{host} עם הקוד', en: 'or visit {host} and enter' },
};

let wired = false;
let msgEdited = false;
let qrModule: typeof import('../lib/qr') | null = null;

const linkFor = (l: Lang, code: string) => `${location.origin}${l === 'en' ? '/en' : ''}/gallery/?code=${encodeURIComponent(code)}`;
const primaryLang = (): Lang => (ed.state?.gallery.lang === 'en' ? 'en' : 'he');
const primaryLink = () => (ed.state ? linkFor(primaryLang(), ed.state.gallery.code) : '');

function template(): string {
  const st = ed.state;
  if (!st) return '';
  const l = primaryLang();
  const g = st.gallery;
  return TL(S.msg, l, { title: g.title, link: linkFor(l, g.code), code: g.code, tip: g.faceSearch ? TL(S.tip, l) : '' }).replace(/\n{3,}/g, '\n\n');
}

function renderMessage() {
  const ta = $<HTMLTextAreaElement>('[data-sh-msg]');
  if (!msgEdited) ta.value = template();
  ta.dir = primaryLang() === 'he' ? 'rtl' : 'ltr';
  updateMessageLinks();
}

function updateMessageLinks() {
  const st = ed.state;
  if (!st) return;
  const text = $<HTMLTextAreaElement>('[data-sh-msg]').value;
  const phone = $<HTMLInputElement>('[data-sh-phone]').value;
  $<HTMLAnchorElement>('[data-sh-wa]').href = waLink(phone, text);
  const subject = TL(S.subject, primaryLang(), { title: st.gallery.title });
  $<HTMLAnchorElement>('[data-sh-mail]').href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  $('[data-sh-reset-msg]').hidden = !msgEdited;
}

async function qr() {
  qrModule ??= await import('../lib/qr');
  return qrModule;
}

async function renderQr() {
  const st = ed.state;
  if (!st) return;
  const link = primaryLink();
  try {
    const { qrSvg } = await qr();
    if (ed.state !== st) return;
    const svg = qrSvg(link, { margin: 2, title: T(S.qrAlt) });
    $('[data-sh-qr]').innerHTML = svg;
    $('[data-card-qr]').innerHTML = qrSvg(link, { margin: 1, title: T(S.qrAlt) });
  } catch {
    $('[data-sh-qr]').replaceChildren(icon('qr-code', 40));
  }
}

function renderCard() {
  const st = ed.state;
  if (!st) return;
  const g = st.gallery;
  const choice = ($<HTMLInputElement>('[name="card-lang"]:checked')?.value ?? 'gallery') as 'he' | 'en' | 'both' | 'gallery';
  const langs: Lang[] = choice === 'both' ? ['he', 'en'] : choice === 'gallery' ? [primaryLang()] : [choice];
  const card = $('[data-sh-card]');
  card.dir = langs[0] === 'he' ? 'rtl' : 'ltr';
  card.lang = langs[0]!;
  $('[data-card-title]', card).textContent = g.title;
  const sub = [g.subtitle, g.date && isYmd(g.date) ? fmtDay(g.date, undefined, langs[0]) : ''].filter(Boolean).join(' · ');
  const subEl = $('[data-card-sub]', card);
  subEl.textContent = sub;
  subEl.hidden = !sub;
  const cta = g.faceSearch ? S.cta : S.ctaNoFaces;
  $('[data-card-cta]', card).replaceChildren(
    ...langs.map((l, i) => h('span', { class: i ? 'adm-tc__cta-alt' : 'adm-tc__cta-main', lang: l, dir: l === 'he' ? 'rtl' : 'ltr' }, TL(cta, l))),
  );
  const host = `${location.host}${langs[0] === 'en' ? '/en' : ''}/gallery`;
  $('[data-card-visit]', card).textContent = TL(S.visit, langs[0]!, { host });
  $('[data-card-code]', card).textContent = g.code;
}

function render() {
  const st = ed.state;
  if (!st) return;
  const g = st.gallery;
  $('[data-sh-draft]').hidden = g.status === 'published';
  $('[data-sh-draft-text]').textContent = T(g.status === 'archived' ? S.archivedWarn : S.draftWarn);
  const primary = primaryLang();
  const alt: Lang = primary === 'he' ? 'en' : 'he';
  $('[data-sh-label-primary]').textContent = T(S[primary]);
  $('[data-sh-label-alt]').textContent = T(S[alt]);
  $<HTMLInputElement>('[data-sh-link-primary]').value = linkFor(primary, g.code);
  $<HTMLInputElement>('[data-sh-link-alt]').value = linkFor(alt, g.code);
  $<HTMLAnchorElement>('[data-sh-open-primary]').href = linkFor(primary, g.code);
  $('[data-sh-code]').textContent = g.code;
  renderMessage();
  renderCard();
  void renderQr();
}

export const share = {
  init() {
    if (wired) return;
    wired = true;
    $$<HTMLButtonElement>('[data-sh-copy]').forEach((b) =>
      b.addEventListener('click', () => {
        const which = b.dataset.shCopy;
        if (which === 'code') void copyWithToast(ed.state?.gallery.code ?? '', T(S.codeCopied));
        else {
          const input = $<HTMLInputElement>(`[data-sh-link-${which}]`);
          input.select();
          void copyWithToast(input.value, T(S.linkCopied));
        }
      }),
    );
    $$<HTMLInputElement>('[data-sh-link-primary], [data-sh-link-alt]').forEach((i) => i.addEventListener('focus', () => i.select()));
    const ta = $<HTMLTextAreaElement>('[data-sh-msg]');
    ta.addEventListener('input', () => {
      msgEdited = ta.value !== template();
      updateMessageLinks();
    });
    $('[data-sh-phone]').addEventListener('input', updateMessageLinks);
    $('[data-sh-copy-msg]').addEventListener('click', () => void copyWithToast(ta.value, T(S.msgCopied)));
    $('[data-sh-reset-msg]').addEventListener('click', () => {
      msgEdited = false;
      renderMessage();
      ta.focus();
    });
    $('[data-sh-publish]').addEventListener('click', async (e) => {
      const st = ed.state;
      if (!st) return;
      const btn = e.currentTarget as HTMLButtonElement;
      setBusy(btn, true);
      try {
        await syncNow(st.gid, 'published');
        toast(T(S.published));
      } catch (err) {
        toastError(errorText(err));
      } finally {
        setBusy(btn, false);
      }
    });
    $('[data-sh-png]').addEventListener('click', async (e) => {
      const st = ed.state;
      if (!st) return;
      const btn = e.currentTarget as HTMLButtonElement;
      setBusy(btn, true);
      try {
        const { qrPng } = await qr();
        downloadBlob(await qrPng(primaryLink(), { px: 1600, margin: 4 }), `qr-${slugFile(st.gallery.title)}.png`);
      } catch {
        toastError(T(S.pngError));
      } finally {
        setBusy(btn, false);
      }
    });
    $('[data-sh-svg]').addEventListener('click', async () => {
      const st = ed.state;
      if (!st) return;
      const { qrSvg } = await qr();
      const svg = `<?xml version="1.0" encoding="UTF-8"?>\n${qrSvg(primaryLink(), { margin: 4 })}`;
      downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `qr-${slugFile(st.gallery.title)}.svg`);
    });
    $$<HTMLInputElement>('[name="card-lang"]').forEach((r) => r.addEventListener('change', renderCard));
    $('[data-sh-print]').addEventListener('click', () => {
      const html = document.documentElement;
      html.classList.add('adm-print-card');
      const done = () => {
        html.classList.remove('adm-print-card');
        window.removeEventListener('afterprint', done);
      };
      window.addEventListener('afterprint', done);
      toast(T(S.printHint), { type: 'info', duration: 3500 });
      window.setTimeout(() => window.print(), 50);
      // Some browsers don't fire afterprint; clean up anyway.
      window.setTimeout(done, 60_000);
    });
    on('gallery', () => {
      if (!$('[data-ed-panel="share"]').hidden) render();
    });
  },
  load() {
    msgEdited = false;
    $<HTMLInputElement>('[data-sh-phone]').value = '';
    const gal = $maybeRadio('gallery');
    if (gal) gal.checked = true;
    if (!$('[data-ed-panel="share"]').hidden) render();
  },
  show() {
    render();
  },
};

function $maybeRadio(value: string) {
  return document.querySelector<HTMLInputElement>(`[name="card-lang"][value="${value}"]`);
}
