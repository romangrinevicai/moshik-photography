/** Code entry screen, friendly error screens and the opening loader. */
import { whatsappLink } from '~/config/site';
import { iconSvg, type IconName } from '~/shared/icons';
import { ApiError, media } from './api';
import { escapeHtml, t } from './format';
import { store } from './store';
import type { CopyKey } from '~/components/gallery/copy';

export type Problem = 'notFound' | 'missing' | 'expired' | 'draft' | 'rate' | 'offline' | 'network' | 'server';

const PROBLEMS: Record<Problem, { title: CopyKey; text: CopyKey; icon: IconName; retry?: boolean }> = {
  notFound: { title: 'errNotFoundTitle', text: 'errNotFoundText', icon: 'search' },
  missing: { title: 'errMissingTitle', text: 'errMissingText', icon: 'search' },
  expired: { title: 'errExpiredTitle', text: 'errExpiredText', icon: 'hourglass' },
  draft: { title: 'errDraftTitle', text: 'errDraftText', icon: 'sparkles', retry: true },
  rate: { title: 'errRateTitle', text: 'errRateText', icon: 'timer', retry: true },
  offline: { title: 'errOfflineTitle', text: 'errOfflineText', icon: 'lock' },
  network: { title: 'errNetworkTitle', text: 'errNetworkText', icon: 'refresh-cw', retry: true },
  server: { title: 'errServerTitle', text: 'errServerText', icon: 'circle-alert', retry: true },
};

/** Map an API failure to a friendly problem. `viaCode`: the visitor typed or followed a code. */
export function problemOf(err: unknown, viaCode: boolean): Problem {
  if (!(err instanceof ApiError)) return 'server';
  if (err.kind === 'network') return 'network';
  if (err.kind === 'offline') return 'offline';
  if (err.status === 404) return viaCode ? 'notFound' : 'missing';
  if (err.status === 410 || err.code === 'expired') return 'expired';
  if (err.status === 403) return 'draft';
  if (err.status === 429) return 'rate';
  if (err.status === 503 || err.code === 'unavailable' || err.code === 'not_configured') return 'offline';
  return 'server';
}

const html = document.documentElement;
const q = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel);

export const normalizeCode = (raw: string) => {
  let v = raw.trim();
  // Pasted a whole share link? Take its code.
  const m = v.match(/[?&]code=([^&#\s]+)/i);
  if (m) v = decodeURIComponent(m[1]!);
  return v.toUpperCase().replace(/[^A-Z0-9\- ]/g, '').replace(/\s+/g, ' ').trim();
};

export interface EntryHandlers {
  /** Called with the typed code; resolves when done (the entry screen handles errors it's given). */
  submit: (code: string) => Promise<void>;
  retry: () => void;
}

let handlers: EntryHandlers | null = null;

export function initEntry(h: EntryHandlers) {
  handlers = h;
  const form = q<HTMLFormElement>('[data-entry-form]')!;
  const input = q<HTMLInputElement>('[data-entry-input]')!;
  // Auto-uppercase while typing, keeping the caret in place.
  input.addEventListener('input', () => {
    const { selectionStart: s, selectionEnd: e } = input;
    const up = input.value.toUpperCase();
    if (up !== input.value) {
      input.value = up;
      input.setSelectionRange(s, e);
    }
    form.classList.remove('is-invalid');
    setEntryError('');
  });
  input.addEventListener('paste', () => {
    window.setTimeout(() => {
      if (/code=/i.test(input.value)) input.value = normalizeCode(input.value);
    }, 0);
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = normalizeCode(input.value);
    if (code.replace(/[^A-Z0-9]/g, '').length < 3) {
      setEntryError(t('entryEmpty'));
      shake();
      input.focus();
      return;
    }
    input.value = code;
    form.classList.add('is-busy');
    q('[data-entry-submit-label]')!.textContent = t('entryOpening');
    try {
      await handlers?.submit(code);
    } finally {
      form.classList.remove('is-busy');
      q('[data-entry-submit-label]')!.textContent = t('entrySubmit');
    }
  });
  q('[data-status-retry]')!.addEventListener('click', () => handlers?.retry());
}

function shake() {
  const form = q<HTMLFormElement>('[data-entry-form]')!;
  form.classList.add('is-invalid');
  form.classList.remove('is-shaking');
  void form.offsetWidth;
  form.classList.add('is-shaking');
}

export function setEntryError(message: string, title = '') {
  const el = q('[data-entry-error]')!;
  el.innerHTML = title ? `<strong>${escapeHtml(title)}</strong>${escapeHtml(message)}` : escapeHtml(message);
}

function setView(view: 'entry' | 'gallery') {
  html.dataset.gview = view;
  q('[data-view="entry"]')!.hidden = view !== 'entry';
  q('[data-view="gallery"]')!.hidden = view !== 'gallery';
  const head = q('[data-g-head]');
  if (head) head.dataset.mode = view;
}

/** Show the code form (optionally prefilled, with an error under it). */
export function showEntry(opts: { code?: string; problem?: Problem } = {}) {
  endBoot();
  setView('entry');
  q('[data-entry-pane="form"]')!.hidden = false;
  q('[data-entry-pane="status"]')!.hidden = true;
  const input = q<HTMLInputElement>('[data-entry-input]')!;
  if (opts.code) input.value = opts.code;
  if (opts.problem) {
    const p = PROBLEMS[opts.problem];
    setEntryError(t(p.text), t(p.title));
    shake();
  } else setEntryError('');
  renderRecent();
  // Don't pop the keyboard open on phones when arriving; do focus on desktop.
  if (opts.problem || matchMedia('(hover: hover) and (pointer: fine)').matches) input.focus({ preventScroll: true });
}

/** Full-screen friendly error with a WhatsApp link. `ref` identifies the gallery for Moshik. */
export function showProblem(problem: Problem, ref: string) {
  endBoot();
  setView('entry');
  const p = PROBLEMS[problem];
  q('[data-entry-pane="form"]')!.hidden = true;
  const pane = q('[data-entry-pane="status"]')!;
  pane.hidden = false;
  q('[data-status-icon]')!.innerHTML = iconSvg(p.icon, { size: 26, stroke: 1.3 });
  q('[data-status-title]')!.textContent = t(p.title);
  q('[data-status-text]')!.textContent = t(p.text);
  q<HTMLAnchorElement>('[data-status-wa]')!.href = whatsappLink(t('waHelp', { ref: ref || '—' }));
  q('[data-status-retry]')!.hidden = !p.retry;
  q<HTMLElement>('[data-status-title]')!.focus({ preventScroll: true });
}

export function showGalleryView() {
  setView('gallery');
}

/** The language switch keeps the gallery in the URL (?g=… / ?code=…). */
export function syncLangLink() {
  const a = q<HTMLAnchorElement>('[data-g-lang]');
  if (!a) return;
  const base = a.dataset.base ?? a.pathname;
  const params = new URLSearchParams(location.search);
  params.delete('p');
  const qs = params.toString();
  a.href = qs ? `${base}?${qs}` : base;
}

/** Remove the opening loader with a soft fade. */
export function endBoot() {
  if (!html.classList.contains('g-booting')) return;
  const boot = q('[data-g-boot]');
  if (!boot) return html.classList.remove('g-booting');
  boot.classList.add('is-done');
  window.setTimeout(() => html.classList.remove('g-booting'), 700);
}

export function startBoot() {
  q('[data-g-boot]')?.classList.remove('is-done');
  html.classList.add('g-booting');
}

function renderRecent() {
  const wrap = q('[data-recent]')!;
  const list = q('[data-recent-list]')!;
  const recent = store.recent();
  list.replaceChildren();
  wrap.hidden = !recent.length;
  for (const r of recent) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.className = 'g-recent__item';
    a.href = `?g=${encodeURIComponent(r.id)}`;
    const thumb = r.cover
      ? `<img src="${escapeHtml(media.photo(r.id, r.cover, 'thumb'))}" alt="" loading="lazy" decoding="async" />`
      : iconSvg('images', { size: 18 });
    a.innerHTML = `<span class="g-recent__thumb">${thumb}</span><span class="g-recent__text"><span class="g-recent__title" dir="auto"></span></span>${iconSvg('arrow-right', { size: 16, className: 'icon--arrow' })}`;
    a.querySelector('.g-recent__title')!.textContent = t('entryContinue', { title: r.title });
    a.querySelector('img')?.addEventListener('error', (e) => ((e.target as HTMLElement).outerHTML = iconSvg('images', { size: 18 })));
    li.append(a);
    list.append(li);
  }
}
