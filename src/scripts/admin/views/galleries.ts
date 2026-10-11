/** Galleries list: cards, search, status filter and the "New gallery" dialog. */
import type { GalleryRecord, GalleryStatus } from '~/shared/gallery-types';
import { api, ApiError, errorText } from '../core/api';
import { $, $$, h, icon } from '../core/dom';
import { T, fmtDay, fmtNumber, galleryStatusLabel, isYmd, photosLabel, relTime } from '../core/i18n';
import { go, routes } from '../core/router';
import { store } from '../core/store';
import { emptyState, errorState, openDialog, setBusy, skeletons, toast } from '../core/ui';
import type { View } from '../core/view';

type Filter = 'all' | GalleryStatus;

let filter: Filter = 'all';
let query = '';
let loading = false;
let wired = false;
let loadError: unknown = null;

const S = {
  summary: { he: '{g} · {p} בסך הכל', en: '{g} · {p} in total' },
  galleriesOne: { he: 'גלריה אחת', en: '1 gallery' },
  galleriesMany: { he: '{n} גלריות', en: '{n} galleries' },
  emptyTitle: { he: 'עוד אין גלריות', en: 'No galleries yet' },
  emptyText: {
    he: 'כל אירוע מקבל גלריה פרטית משלו: מעלים תמונות, משתפים קישור או QR — והאורחים מוצאים את עצמם עם סלפי.',
    en: 'Every event gets its own private gallery: upload photos, share a link or QR code — and guests find themselves with a selfie.',
  },
  emptyCta: { he: 'יצירת הגלריה הראשונה', en: 'Create your first gallery' },
  noMatch: { he: 'לא נמצאו גלריות שמתאימות לחיפוש', en: 'No galleries match your search' },
  noMatchText: { he: 'אפשר לחפש לפי שם, תאריך או קוד גישה.', en: 'Search by name, date or access code.' },
  clear: { he: 'ניקוי החיפוש', en: 'Clear search' },
  open: { he: 'פתיחת הגלריה {t}', en: 'Open gallery {t}' },
  updated: { he: 'עודכנה {t}', en: 'Updated {t}' },
  created: { he: 'הגלריה נוצרה — עכשיו אפשר להעלות תמונות', en: 'Gallery created — now add some photos' },
  titleRequired: { he: 'נא לתת שם לגלריה', en: 'Please give the gallery a name' },
};

const galleriesLabel = (n: number) => (n === 1 ? T(S.galleriesOne) : T(S.galleriesMany, { n: fmtNumber(n) }));

function matches(g: GalleryRecord): boolean {
  if (filter !== 'all' && g.status !== filter) return false;
  if (!query) return true;
  const q = query.toLowerCase();
  return [g.title, g.subtitle, g.code, g.date, g.date ? fmtDay(g.date) : ''].some((v) => (v ?? '').toLowerCase().includes(q));
}

export function coverUrl(g: Pick<GalleryRecord, 'id' | 'coverPhotoId'>) {
  return g.coverPhotoId ? `/media/${encodeURIComponent(g.id)}/${encodeURIComponent(g.coverPhotoId)}/thumb` : '';
}

export function statusBadge(status: GalleryStatus) {
  return h('span', { class: `adm-status adm-status--${status}` }, h('span', { class: 'adm-status__dot', 'aria-hidden': 'true' }), T(galleryStatusLabel[status]));
}

/** Initials / first letter for galleries without a cover. */
function monogram(title: string) {
  const letter = [...title.trim()][0] ?? '·';
  return h('span', { class: 'adm-gcard__mono', 'aria-hidden': 'true' }, letter);
}

function card(g: GalleryRecord) {
  const cover = coverUrl(g);
  const count = g.photoCount ?? 0;
  return h(
    'a',
    { class: 'adm-gcard', href: routes.gallery(g.id), 'aria-label': T(S.open, { t: g.title }) },
    h(
      'div',
      { class: 'adm-gcard__media' },
      cover ? h('img', { src: cover, alt: '', loading: 'lazy', decoding: 'async', onerror: (e: Event) => (e.target as HTMLElement).replaceWith(monogram(g.title)) }) : monogram(g.title),
      statusBadge(g.status),
    ),
    h(
      'div',
      { class: 'adm-gcard__body' },
      h('h2', { class: 'adm-gcard__title', dir: 'auto' }, g.title),
      g.subtitle ? h('p', { class: 'adm-gcard__sub', dir: 'auto' }, g.subtitle) : null,
      h(
        'p',
        { class: 'adm-gcard__meta' },
        g.date && isYmd(g.date) ? h('span', null, icon('calendar', 14), fmtDay(g.date, { day: 'numeric', month: 'short', year: 'numeric' })) : null,
        h('span', null, icon('images', 14), photosLabel(count)),
      ),
      h(
        'p',
        { class: 'adm-gcard__foot' },
        h('span', { class: 'adm-code adm-code--static', dir: 'ltr' }, g.code),
        h('span', { class: 'adm-gcard__time' }, T(S.updated, { t: relTime(g.updatedAt || g.createdAt) })),
      ),
    ),
  );
}

function render() {
  const list = $('[data-gal-list]');
  const all = store.galleries;
  list.setAttribute('aria-busy', String(loading && !all));
  if (!all) {
    if (loadError) list.replaceChildren(errorState(errorText(loadError), () => void load()));
    else list.replaceChildren(...skeletons(6, 'adm-skel--card'));
    return;
  }
  // counts per status
  const counts: Record<Filter, number> = { all: all.length, draft: 0, published: 0, archived: 0 };
  for (const g of all) counts[g.status]++;
  $$<HTMLButtonElement>('[data-gal-filter] [data-filter]').forEach((b) => {
    const f = b.dataset.filter as Filter;
    b.setAttribute('aria-pressed', String(f === filter));
    const c = b.querySelector('[data-chip-count]');
    if (c) c.textContent = fmtNumber(counts[f]);
    b.hidden = f !== 'all' && f !== filter && counts[f] === 0;
  });
  const photos = all.reduce((n, g) => n + (g.photoCount ?? 0), 0);
  $('[data-gal-summary]').textContent = all.length ? T(S.summary, { g: galleriesLabel(all.length), p: photosLabel(photos) }) : '';
  $('[data-gal-toolbar]').hidden = all.length === 0;

  if (!all.length) {
    list.replaceChildren(
      emptyState({
        icon: 'images',
        title: T(S.emptyTitle),
        text: T(S.emptyText),
        action: h('button', { type: 'button', class: 'btn btn--solid', onclick: openNew }, icon('plus', 18), T(S.emptyCta)),
      }),
    );
    return;
  }
  const shown = all.filter(matches);
  if (!shown.length) {
    list.replaceChildren(
      emptyState({
        icon: 'search',
        title: T(S.noMatch),
        text: T(S.noMatchText),
        action: h(
          'button',
          {
            type: 'button',
            class: 'btn btn--sm',
            onclick: () => {
              query = '';
              filter = 'all';
              $<HTMLInputElement>('[data-gal-search]').value = '';
              render();
            },
          },
          T(S.clear),
        ),
      }),
    );
    return;
  }
  list.replaceChildren(...shown.map(card));
}

async function load() {
  loading = true;
  loadError = null;
  render();
  try {
    const res = await api<{ ok: true; galleries: GalleryRecord[] }>('/api/admin/galleries');
    store.galleries = res.galleries ?? [];
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 401)) loadError = e;
  } finally {
    loading = false;
    render();
  }
}

/* ─────────────────────────── new gallery dialog ─────────────────────────── */

function openNew() {
  const dlg = $<HTMLDialogElement>('[data-new-dialog]');
  const form = $<HTMLFormElement>('[data-new-form]');
  form.reset();
  form.querySelectorAll('.field--invalid').forEach((f) => f.classList.remove('field--invalid'));
  $('[data-new-error]').textContent = '';
  openDialog(dlg, form.querySelector<HTMLInputElement>('[name="title"]'));
}

function wire() {
  if (wired) return;
  wired = true;
  $$('[data-new-gallery]').forEach((b) => b.addEventListener('click', openNew));
  const search = $<HTMLInputElement>('[data-gal-search]');
  search.addEventListener('input', () => {
    query = search.value.trim();
    render();
  });
  $('[data-gal-filter]').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-filter]');
    if (!b) return;
    filter = b.dataset.filter as Filter;
    render();
  });

  const dlg = $<HTMLDialogElement>('[data-new-dialog]');
  const form = $<HTMLFormElement>('[data-new-form]');
  $$('[data-dialog-close]', dlg).forEach((b) => b.addEventListener('click', () => dlg.close()));
  const titleInput = form.querySelector<HTMLInputElement>('[name="title"]')!;
  titleInput.addEventListener('input', () => {
    titleInput.closest('.field')?.classList.remove('field--invalid');
    $('[data-new-error]').textContent = '';
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const title = String(data.get('title') ?? '').trim();
    if (!title) {
      titleInput.closest('.field')?.classList.add('field--invalid');
      $('[data-new-error]').textContent = T(S.titleRequired);
      titleInput.focus();
      return;
    }
    const body = {
      title,
      subtitle: String(data.get('subtitle') ?? '').trim() || undefined,
      date: String(data.get('date') ?? '') || undefined,
      lang: data.get('lang') === 'en' ? 'en' : 'he',
    };
    const submit = form.querySelector<HTMLButtonElement>('[type="submit"]');
    setBusy(submit, true);
    try {
      const res = await api<{ ok: true; gallery: GalleryRecord }>('/api/admin/galleries', { method: 'POST', body });
      store.upsertGallery(res.gallery);
      if (!store.galleries) store.galleries = [res.gallery];
      dlg.close();
      toast(T(S.created));
      go(routes.gallery(res.gallery.id));
    } catch (err) {
      $('[data-new-error]').textContent = errorText(err);
    } finally {
      setBusy(submit, false);
    }
  });
}

export const galleriesView: View = {
  mount(_route, entered) {
    wire();
    if (entered) void load();
    else render();
  },
};
