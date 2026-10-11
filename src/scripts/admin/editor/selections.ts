/** Selections tab: album picks sent by clients from their gallery. */
import type { PhotoMeta, Selection } from '~/shared/gallery-types';
import { api, ApiError, errorText } from '../core/api';
import { $, h, icon, nextId } from '../core/dom';
import { T, fmtDateTime, fmtNumber, photosLabel, relTime } from '../core/i18n';
import { copyWithToast, downloadBlob, emptyState, errorState, skeletons, slugFile } from '../core/ui';
import { toCsv } from '../lib/csv';
import { displayPhone, telHref, waLink } from '../lib/phone';
import { ed, galleryApi, thumbUrl } from './state';

const S = {
  emptyTitle: { he: 'עוד אין בחירות', en: 'No selections yet' },
  emptyText: {
    he: 'כשהזוג יבחר בגלריה את התמונות האהובות לאלבום ולחץ "שליחה", הבחירה תופיע כאן — עם רשימת קבצים מוכנה להעתקה.',
    en: 'When the couple picks favourites for the album in their gallery and sends them, the selection appears here — with a file list ready to copy.',
  },
  show: { he: 'הצגת התמונות', en: 'Show photos' },
  hide: { he: 'הסתרת התמונות', en: 'Hide photos' },
  copyNames: { he: 'העתקת שמות הקבצים', en: 'Copy file names' },
  namesCopied: { he: 'רשימת הקבצים הועתקה — אפשר להדביק בסינון של Lightroom', en: 'File list copied — paste it into Lightroom’s filter' },
  csv: { he: 'הורדת CSV', en: 'Download CSV' },
  csvAll: { he: 'הורדת הכל (CSV)', en: 'Download all (CSV)' },
  missing: { he: 'נמחקה', en: 'Deleted' },
  note: { he: 'הערה', en: 'Note' },
  headers: { he: ['בחירה', 'אימייל', 'טלפון', 'הערה', 'נשלחה', 'שם קובץ', 'מזהה תמונה'], en: ['Selection', 'Email', 'Phone', 'Note', 'Sent', 'File name', 'Photo id'] },
  count: { he: '{n} בחירות', en: '{n} selections' },
  countOne: { he: 'בחירה אחת', en: '1 selection' },
};

let wired = false;
let loadedFor = '';
let data: Selection[] = [];
let loading = false;

function photoMap(): Map<string, PhotoMeta> {
  return new Map((ed.state?.photos ?? []).map((p) => [p.id, p]));
}

const nameOf = (id: string, map: Map<string, PhotoMeta>) => map.get(id)?.name ?? id;

function csvFor(list: Selection[]): Blob {
  const map = photoMap();
  const rows: (string | number | undefined)[][] = [S.headers[document.documentElement.lang === 'en' ? 'en' : 'he']];
  for (const s of list) for (const pid of s.photoIds) rows.push([s.name, s.email, s.phone, s.note, s.createdAt, nameOf(pid, map), pid]);
  return toCsv(rows);
}

function card(sel: Selection) {
  const st = ed.state!;
  const map = photoMap();
  const gridId = nextId('sel-grid');
  const grid = h('div', { class: 'adm-sel__grid', id: gridId, hidden: true });
  const toggle = h('button', { type: 'button', class: 'btn btn--sm', 'aria-expanded': 'false', 'aria-controls': gridId }, icon('images', 16), h('span', null, T(S.show)));
  toggle.addEventListener('click', () => {
    const open = grid.hidden;
    grid.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('span')!.textContent = T(open ? S.hide : S.show);
    if (open && !grid.childElementCount) {
      grid.replaceChildren(
        ...sel.photoIds.map((pid) => {
          const p = map.get(pid);
          return h(
            'figure',
            { class: `adm-sel__ph${p ? '' : ' is-missing'}` },
            p ? h('img', { src: thumbUrl(st.gid, pid), alt: '', loading: 'lazy', decoding: 'async' }) : h('span', { class: 'adm-sel__gone' }, icon('image', 20)),
            h('figcaption', { dir: 'ltr' }, p ? p.name ?? pid : T(S.missing)),
          );
        }),
      );
    }
  });
  const contacts = [
    sel.email ? h('a', { class: 'adm-contact', href: `mailto:${sel.email}`, dir: 'ltr' }, icon('mail', 15), sel.email) : null,
    sel.phone ? h('a', { class: 'adm-contact', href: telHref(sel.phone), dir: 'ltr' }, icon('phone', 15), displayPhone(sel.phone)) : null,
    sel.phone ? h('a', { class: 'adm-contact', href: waLink(sel.phone, ''), target: '_blank', rel: 'noopener' }, icon('whatsapp', 15), 'WhatsApp') : null,
  ].filter(Boolean);
  return h(
    'article',
    { class: 'adm-card adm-sel' },
    h(
      'header',
      { class: 'adm-sel__head' },
      h('div', null, h('h3', { class: 'adm-sel__name', dir: 'auto' }, sel.name || '—'), h('p', { class: 'adm-sel__time', title: fmtDateTime(sel.createdAt) }, relTime(sel.createdAt))),
      h('span', { class: 'adm-pill' }, icon('heart', 14), photosLabel(sel.photoIds.length)),
    ),
    contacts.length ? h('p', { class: 'adm-sel__contacts' }, ...contacts) : null,
    sel.note ? h('blockquote', { class: 'adm-sel__note', dir: 'auto' }, sel.note) : null,
    h(
      'div',
      { class: 'adm-sel__actions' },
      toggle,
      h('button', { type: 'button', class: 'btn btn--sm', onclick: () => void copyWithToast(sel.photoIds.map((id) => nameOf(id, map)).join(', '), T(S.namesCopied)) }, icon('copy', 16), T(S.copyNames)),
      h(
        'button',
        { type: 'button', class: 'btn btn--sm', onclick: () => downloadBlob(csvFor([sel]), `${slugFile(st.gallery.title)}-${slugFile(sel.name || 'selection')}.csv`) },
        icon('download', 16),
        T(S.csv),
      ),
    ),
    grid,
  );
}

function render() {
  const list = $('[data-sel-list]');
  const st = ed.state;
  if (!st) return;
  const count = $('[data-tab-count="selections"]');
  count.textContent = data.length ? fmtNumber(data.length) : '';
  $('[data-sel-all]').hidden = data.length < 2;
  $('[data-sel-summary]').textContent = data.length ? (data.length === 1 ? T(S.countOne) : T(S.count, { n: fmtNumber(data.length) })) : '';
  if (loading && !data.length) {
    list.replaceChildren(...skeletons(2, 'adm-skel--row'));
    return;
  }
  if (!data.length) {
    list.replaceChildren(emptyState({ icon: 'heart', title: T(S.emptyTitle), text: T(S.emptyText) }));
    return;
  }
  list.replaceChildren(...data.map(card));
}

async function load(force = false) {
  const st = ed.state;
  if (!st || loading || (!force && loadedFor === st.gid)) return;
  const gid = st.gid;
  loading = true;
  render();
  try {
    const res = await api<{ ok: true; selections: Selection[] }>(galleryApi(gid, '/selections'));
    if (ed.state?.gid !== gid) return;
    data = (res.selections ?? []).slice().sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    loadedFor = gid;
    loading = false;
    render();
  } catch (e) {
    loading = false;
    if (ed.state?.gid !== gid) return;
    if (e instanceof ApiError && e.status === 401) return;
    $('[data-sel-list]').replaceChildren(errorState(errorText(e), () => void load(true)));
  }
}

export const selections = {
  init() {
    if (wired) return;
    wired = true;
    $('[data-sel-refresh]').addEventListener('click', () => void load(true));
    $('[data-sel-all]').addEventListener('click', () => {
      const st = ed.state;
      if (st && data.length) downloadBlob(csvFor(data), `${slugFile(st.gallery.title)}-selections.csv`);
    });
  },
  load() {
    data = [];
    loadedFor = '';
    loading = false;
    $('[data-tab-count="selections"]').textContent = '';
    // Prefetch quietly so the tab shows its count.
    void load();
  },
  show() {
    render();
    void load();
  },
};
