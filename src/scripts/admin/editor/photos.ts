/** Photos grid: multi-select, sort, chapter filter, cover, delete and a preview dialog. */
import type { PhotoMeta } from '~/shared/gallery-types';
import { api, errorText } from '../core/api';
import { $, h, icon } from '../core/dom';
import { T, fmtBytes, fmtDateTime, fmtNumber, naturalCompare, photosLabel, plural } from '../core/i18n';
import { confirmDialog, emptyState, openDialog, setBusy, toast, toastError } from '../core/ui';
import { uploads } from '../upload/queue';
import { ed, emit, enc, galleryApi, on, patchGallery, scheduleSync, thumbUrl, webUrl } from './state';

type Sort = 'order' | 'taken' | 'name';

const S = {
  open: { he: 'פתיחת התמונה {n}', en: 'Open photo {n}' },
  select: { he: 'בחירת {n}', en: 'Select {n}' },
  cover: { he: 'שער', en: 'Cover' },
  selected: { he: '{n} נבחרו', en: '{n} selected' },
  selectedOne: { he: 'תמונה אחת נבחרה', en: '1 selected' },
  setCover: { he: 'הגדרה כתמונת שער', en: 'Set as cover' },
  coverSet: { he: 'תמונת השער עודכנה', en: 'Cover photo updated' },
  remove: { he: 'מחיקה', en: 'Delete' },
  clear: { he: 'ביטול הבחירה', en: 'Clear selection' },
  selectAll: { he: 'בחירת הכל', en: 'Select all' },
  deleteTitle: { he: 'למחוק {n}?', en: 'Delete {n}?' },
  deleteText: { he: 'התמונות יימחקו מהגלריה לצמיתות (כולל הקבצים המקוריים). אי אפשר לבטל את זה.', en: 'They’ll be permanently removed from the gallery (originals included). This can’t be undone.' },
  deleteOk: { he: 'מחיקה לצמיתות', en: 'Delete permanently' },
  deleting: { he: 'מוחק {d} מתוך {n}…', en: 'Deleting {d} of {n}…' },
  deleted: { he: ['התמונה נמחקה', '{n} תמונות נמחקו'], en: ['Photo deleted', '{n} photos deleted'] } as { he: [string, string]; en: [string, string] },
  deletePartial: { he: '{ok} נמחקו, {fail} לא — כדאי לנסות שוב', en: '{ok} deleted, {fail} failed — please try again' },
  emptyTitle: { he: 'עוד אין תמונות בגלריה', en: 'No photos in this gallery yet' },
  emptyText: { he: 'התמונות שתעלה יופיעו כאן. אפשר לגרור תיקייה שלמה לאזור ההעלאה שלמעלה.', en: 'Photos you upload appear here. You can drag a whole folder into the upload area above.' },
  noneInSet: { he: 'אין תמונות בפרק הזה', en: 'No photos in this chapter' },
  noSet: { he: 'בלי פרק', en: 'No chapter' },
  allSets: { he: 'כל התמונות', en: 'All photos' },
  showMore: { he: 'להציג עוד', en: 'Show more' },
  dims: { he: '{w}×{h} פיקסלים', en: '{w}×{h} px' },
  taken: { he: 'צולמה {d}', en: 'Taken {d}' },
  uploaded: { he: 'הועלתה {d}', en: 'Uploaded {d}' },
  original: { he: 'הקובץ המקורי', en: 'Original file' },
  noOriginal: { he: 'רק גרסת רשת (המקור לא נשמר)', en: 'Web version only (original not kept)' },
  prev: { he: 'התמונה הקודמת', en: 'Previous photo' },
  next: { he: 'התמונה הבאה', en: 'Next photo' },
  position: { he: '{i} מתוך {n}', en: '{i} of {n}' },
  moveTo: { he: 'העברה לפרק…', en: 'Move to chapter…' },
  moved: { he: ['התמונה הועברה', '{n} תמונות הועברו'], en: ['Photo moved', '{n} photos moved'] } as { he: [string, string]; en: [string, string] },
};

const CHUNK = 160;

let sort: Sort = 'order';
let setFilter = 'all';
let limit = CHUNK;
let anchor = -1;
let wired = false;
let previewIndex = -1;
const selected = new Set<string>();
const tiles = new Map<string, HTMLElement>();
let io: IntersectionObserver | null = null;

const photosOf = () => ed.state?.photos ?? [];

function sorted(list: PhotoMeta[]): PhotoMeta[] {
  const withIndex = list.map((p, i) => ({ p, k: p.order ?? i }));
  const byOrder = (a: { p: PhotoMeta; k: number }, b: { p: PhotoMeta; k: number }) => a.k - b.k;
  if (sort === 'name') withIndex.sort((a, b) => naturalCompare(a.p.name ?? '', b.p.name ?? '') || byOrder(a, b));
  else if (sort === 'taken')
    withIndex.sort((a, b) => {
      const ta = a.p.takenAt ? Date.parse(a.p.takenAt) : Number.POSITIVE_INFINITY;
      const tb = b.p.takenAt ? Date.parse(b.p.takenAt) : Number.POSITIVE_INFINITY;
      return ta === tb ? byOrder(a, b) : ta - tb;
    });
  else withIndex.sort(byOrder);
  return withIndex.map((x) => x.p);
}

function visible(): PhotoMeta[] {
  const st = ed.state;
  if (!st) return [];
  const ids = new Set(st.gallery.sets.map((s) => s.id));
  const list = photosOf().filter((p) => {
    if (setFilter === 'all') return true;
    if (setFilter === '__none__') return !p.set || !ids.has(p.set);
    return p.set === setFilter;
  });
  return sorted(list);
}

/* ─────────────────────────────── tiles ─────────────────────────────── */

function tile(p: PhotoMeta): HTMLElement {
  let el = tiles.get(p.id);
  const st = ed.state!;
  const name = p.name || p.id;
  if (!el) {
    el = h(
      'div',
      { class: 'adm-tile', 'data-pid': p.id, role: 'listitem' },
      h(
        'button',
        { type: 'button', class: 'adm-tile__img', 'aria-label': T(S.open, { n: name }), 'data-tile-open': '' },
        h('img', { src: thumbUrl(st.gid, p.id), alt: '', loading: 'lazy', decoding: 'async', width: String(p.w), height: String(p.h) }),
      ),
      h(
        'label',
        { class: 'adm-tile__check' },
        h('input', { type: 'checkbox', 'aria-label': T(S.select, { n: name }), 'data-tile-check': '' }),
        h('span', { class: 'adm-tile__box', 'aria-hidden': 'true' }, icon('check', 14)),
      ),
      h('span', { class: 'adm-tile__cover', hidden: true }, icon('star', 12), T(S.cover)),
      h('span', { class: 'adm-tile__set', hidden: true }),
    );
    tiles.set(p.id, el);
  }
  const isSel = selected.has(p.id);
  el.classList.toggle('is-selected', isSel);
  el.querySelector<HTMLInputElement>('[data-tile-check]')!.checked = isSel;
  el.querySelector<HTMLElement>('.adm-tile__cover')!.hidden = st.gallery.coverPhotoId !== p.id;
  const setEl = el.querySelector<HTMLElement>('.adm-tile__set')!;
  const setName = p.set ? st.gallery.sets.find((s) => s.id === p.set)?.name : '';
  setEl.hidden = !setName || setFilter !== 'all';
  setEl.textContent = setName ?? '';
  return el;
}

function renderFilters() {
  const st = ed.state;
  const box = $('[data-ph-sets]');
  if (!st) return;
  const ids = new Set(st.gallery.sets.map((s) => s.id));
  if (setFilter !== 'all' && setFilter !== '__none__' && !ids.has(setFilter)) setFilter = 'all';
  const none = photosOf().filter((p) => !p.set || !ids.has(p.set)).length;
  const chips: [string, string, number][] = [
    ['all', T(S.allSets), photosOf().length],
    ...st.gallery.sets.map((s) => [s.id, s.name, photosOf().filter((p) => p.set === s.id).length] as [string, string, number]),
  ];
  if (st.gallery.sets.length && none) chips.push(['__none__', T(S.noSet), none]);
  box.hidden = !st.gallery.sets.length;
  box.replaceChildren(
    ...chips.map(([id, label, n]) =>
      h(
        'button',
        { type: 'button', class: 'adm-chip', 'aria-pressed': String(setFilter === id), 'data-set-filter': id },
        h('span', { dir: 'auto' }, label),
        h('span', { class: 'adm-chip__count' }, fmtNumber(n)),
      ),
    ),
  );
}

function renderSelbar() {
  const bar = $('[data-ph-selbar]');
  const n = selected.size;
  bar.hidden = n === 0;
  $('[data-ph-grid]').classList.toggle('is-selecting', n > 0);
  if (!n) return;
  $('[data-ph-selcount]').textContent = n === 1 ? T(S.selectedOne) : T(S.selected, { n: fmtNumber(n) });
  $<HTMLButtonElement>('[data-ph-cover]').hidden = n !== 1;
  const move = $<HTMLSelectElement>('[data-ph-move]');
  const sets = ed.state?.gallery.sets ?? [];
  move.hidden = sets.length === 0;
  move.replaceChildren(
    h('option', { value: '__' }, T(S.moveTo)),
    ...sets.map((set) => h('option', { value: set.id }, set.name)),
    h('option', { value: '' }, T(S.noSet)),
  );
  move.value = '__';
  const all = visible();
  const allSelected = all.length > 0 && all.every((p) => selected.has(p.id));
  $('[data-ph-all]').textContent = T(allSelected ? S.clear : S.selectAll);
}

function render() {
  const st = ed.state;
  const grid = $('[data-ph-grid]');
  const empty = $('[data-ph-empty]');
  if (!st) return;
  // drop selection of photos that no longer exist
  const ids = new Set(photosOf().map((p) => p.id));
  for (const id of [...selected]) if (!ids.has(id)) selected.delete(id);
  for (const id of [...tiles.keys()]) if (!ids.has(id)) tiles.delete(id);

  $('[data-ph-count]').textContent = photosOf().length ? `(${fmtNumber(photosOf().length)})` : '';
  $('[data-ph-tools]').hidden = photosOf().length === 0;
  renderFilters();

  const list = visible();
  if (!photosOf().length) {
    grid.replaceChildren();
    empty.hidden = uploads.busy(st.gid);
    if (!empty.firstChild) empty.replaceChildren(emptyState({ icon: 'images', title: T(S.emptyTitle), text: T(S.emptyText) }));
  } else if (!list.length) {
    empty.hidden = false;
    empty.replaceChildren(emptyState({ icon: 'layout-grid', title: T(S.noneInSet) }));
    grid.replaceChildren();
  } else {
    empty.hidden = true;
    empty.replaceChildren();
    const els = list.slice(0, limit).map(tile);
    const same = els.length === grid.children.length && els.every((e, i) => grid.children[i] === e);
    if (!same) grid.replaceChildren(...els);
  }
  const more = $<HTMLButtonElement>('[data-ph-more]');
  more.hidden = list.length <= limit;
  renderSelbar();
}

/* ────────────────────────────── selection ────────────────────────────── */

function toggle(id: string, shift: boolean) {
  const list = visible();
  const idx = list.findIndex((p) => p.id === id);
  if (shift && anchor >= 0 && idx >= 0) {
    const [a, b] = anchor < idx ? [anchor, idx] : [idx, anchor];
    const on = !selected.has(id);
    for (let i = a; i <= b; i++) {
      const pid = list[i]!.id;
      if (on) selected.add(pid);
      else selected.delete(pid);
    }
  } else if (selected.has(id)) selected.delete(id);
  else selected.add(id);
  anchor = idx;
  render();
}

async function setCover(id: string) {
  try {
    await patchGallery({ coverPhotoId: id });
    toast(T(S.coverSet));
    render();
  } catch (e) {
    toastError(errorText(e));
  }
}

async function movePhotos(ids: string[], set: string) {
  const st = ed.state;
  if (!st || !ids.length || set === '__') return;
  const move = $<HTMLSelectElement>('[data-ph-move]');
  move.disabled = true;
  try {
    await api(galleryApi(st.gid, '/photos'), { method: 'PATCH', body: { ids, set } });
    const moved = new Set(ids);
    for (const p of st.photos) if (moved.has(p.id)) p.set = set || undefined;
    emit('photos');
    scheduleSync();
    toast(plural(ids.length, S.moved));
  } catch (e) {
    toastError(errorText(e));
  } finally {
    move.disabled = false;
    move.value = '__';
  }
}

async function removePhotos(ids: string[]) {
  const st = ed.state;
  if (!st || !ids.length) return false;
  const label = photosLabel(ids.length);
  const ok = await confirmDialog({ title: T(S.deleteTitle, { n: label }), message: T(S.deleteText), confirm: T(S.deleteOk), danger: true });
  if (!ok) return false;
  const btn = $<HTMLButtonElement>('[data-ph-delete]');
  setBusy(btn, true);
  const status = $('[data-ph-status]');
  const gone: string[] = [];
  let failed = 0;
  let next = 0;
  const work = async () => {
    while (next < ids.length) {
      const id = ids[next++]!;
      try {
        await api(galleryApi(st.gid, `/photos/${enc(id)}`), { method: 'DELETE' });
        gone.push(id);
      } catch {
        failed++;
      }
      status.textContent = T(S.deleting, { d: fmtNumber(gone.length + failed), n: fmtNumber(ids.length) });
    }
  };
  await Promise.all([work(), work(), work(), work()]);
  status.textContent = '';
  setBusy(btn, false);
  if (ed.state !== st) return gone.length > 0;
  const goneSet = new Set(gone);
  st.photos = st.photos.filter((p) => !goneSet.has(p.id));
  gone.forEach((id) => selected.delete(id));
  if (st.gallery.coverPhotoId && goneSet.has(st.gallery.coverPhotoId)) {
    const nextCover = sorted(st.photos)[0]?.id ?? '';
    st.gallery.coverPhotoId = nextCover || undefined;
    void patchGallery({ coverPhotoId: nextCover }).catch(() => undefined);
  }
  emit('photos');
  scheduleSync();
  if (failed) toastError(T(S.deletePartial, { ok: fmtNumber(gone.length), fail: fmtNumber(failed) }));
  else toast(plural(gone.length, S.deleted));
  return gone.length > 0;
}

/* ─────────────────────────────── preview ─────────────────────────────── */

function renderPreview() {
  const st = ed.state;
  const list = visible();
  const p = list[previewIndex];
  const dlg = $<HTMLDialogElement>('[data-photo-dialog]');
  if (!st || !p) {
    dlg.close();
    return;
  }
  const img = $<HTMLImageElement>('[data-pv-img]', dlg);
  img.src = webUrl(st.gid, p.id);
  img.alt = p.name ?? '';
  img.style.aspectRatio = `${p.w} / ${p.h}`;
  $('[data-pv-name]', dlg).textContent = p.name || p.id;
  $('[data-pv-pos]', dlg).textContent = T(S.position, { i: fmtNumber(previewIndex + 1), n: fmtNumber(list.length) });
  const meta: string[] = [T(S.dims, { w: p.w, h: p.h })];
  if (p.takenAt) meta.push(T(S.taken, { d: fmtDateTime(p.takenAt) }));
  else if (p.uploadedAt) meta.push(T(S.uploaded, { d: fmtDateTime(p.uploadedAt) }));
  const setName = p.set ? st.gallery.sets.find((s) => s.id === p.set)?.name : '';
  if (setName) meta.push(setName);
  if (p.origSize) meta.push(`${T(S.original)} · ${fmtBytes(p.origSize)}`);
  else meta.push(T(S.noOriginal));
  $('[data-pv-meta]', dlg).textContent = meta.join(' · ');
  const orig = $<HTMLAnchorElement>('[data-pv-original]', dlg);
  orig.hidden = !p.origSize;
  orig.href = `/media/${enc(st.gid)}/${enc(p.id)}/original?dl=1`;
  const coverBtn = $<HTMLButtonElement>('[data-pv-cover]', dlg);
  const isCover = st.gallery.coverPhotoId === p.id;
  coverBtn.disabled = isCover;
  coverBtn.querySelector('span')!.textContent = isCover ? T(S.cover) : T(S.setCover);
  $<HTMLButtonElement>('[data-pv-prev]', dlg).disabled = previewIndex <= 0;
  $<HTMLButtonElement>('[data-pv-next]', dlg).disabled = previewIndex >= list.length - 1;
  // warm up the neighbours
  for (const n of [list[previewIndex + 1], list[previewIndex - 1]]) if (n) new Image().src = webUrl(st.gid, n.id);
}

function openPreview(id: string) {
  previewIndex = visible().findIndex((p) => p.id === id);
  if (previewIndex < 0) return;
  const dlg = $<HTMLDialogElement>('[data-photo-dialog]');
  renderPreview();
  openDialog(dlg, $('[data-pv-close]', dlg));
}

function step(d: -1 | 1) {
  const n = previewIndex + d;
  if (n < 0 || n >= visible().length) return;
  previewIndex = n;
  renderPreview();
}

/* ─────────────────────────────── wiring ─────────────────────────────── */

export const photos = {
  init() {
    if (wired) return;
    wired = true;
    const grid = $('[data-ph-grid]');
    grid.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const el = t.closest<HTMLElement>('[data-pid]');
      if (!el) return;
      const id = el.dataset.pid!;
      const me = e as MouseEvent;
      // The round checkbox (label + input): handle once, without the label's synthetic second click.
      if (t.closest('.adm-tile__check')) {
        e.preventDefault();
        toggle(id, me.shiftKey);
        return;
      }
      if (t.closest('[data-tile-open]')) {
        if (selected.size || me.shiftKey || me.metaKey || me.ctrlKey) toggle(id, me.shiftKey);
        else openPreview(id);
      }
    });
    // keyboard: space on the checkbox toggles via the click handler above
    grid.addEventListener('keydown', (e) => {
      const t = e.target as HTMLElement;
      if (e.key === 'Delete' && selected.size) {
        e.preventDefault();
        void removePhotos([...selected]);
      }
      if (e.key === 'Escape' && selected.size) {
        selected.clear();
        render();
        t.focus();
      }
    });
    $('[data-ph-sets]').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-set-filter]');
      if (!b) return;
      setFilter = b.dataset.setFilter!;
      limit = CHUNK;
      anchor = -1;
      render();
    });
    const sortSel = $<HTMLSelectElement>('[data-ph-sort]');
    sortSel.addEventListener('change', () => {
      sort = sortSel.value as Sort;
      anchor = -1;
      render();
    });
    $('[data-ph-all]').addEventListener('click', () => {
      const all = visible();
      const allSelected = all.length > 0 && all.every((p) => selected.has(p.id));
      if (allSelected) selected.clear();
      else all.forEach((p) => selected.add(p.id));
      render();
    });
    $('[data-ph-select-all]').addEventListener('click', () => {
      visible().forEach((p) => selected.add(p.id));
      render();
    });
    $('[data-ph-clear]').addEventListener('click', () => {
      selected.clear();
      render();
    });
    $('[data-ph-cover]').addEventListener('click', () => {
      const [id] = [...selected];
      if (id) void setCover(id).then(() => (selected.clear(), render()));
    });
    $('[data-ph-delete]').addEventListener('click', () => void removePhotos([...selected]));
    const move = $<HTMLSelectElement>('[data-ph-move]');
    move.addEventListener('change', () => void movePhotos([...selected], move.value));
    const more = $<HTMLButtonElement>('[data-ph-more]');
    more.addEventListener('click', () => {
      limit += CHUNK * 2;
      render();
    });
    // Load more automatically when the end of the grid scrolls into view.
    io = new IntersectionObserver((entries) => {
      if (entries.some((en) => en.isIntersecting) && !more.hidden) {
        limit += CHUNK;
        render();
      }
    }, { rootMargin: '600px 0px' });
    io.observe(more);

    // preview dialog
    const dlg = $<HTMLDialogElement>('[data-photo-dialog]');
    $('[data-pv-close]', dlg).addEventListener('click', () => dlg.close());
    $('[data-pv-prev]', dlg).addEventListener('click', () => step(-1));
    $('[data-pv-next]', dlg).addEventListener('click', () => step(1));
    dlg.addEventListener('keydown', (e) => {
      const rtl = document.documentElement.dir === 'rtl';
      if (e.key === 'ArrowRight') step(rtl ? -1 : 1);
      if (e.key === 'ArrowLeft') step(rtl ? 1 : -1);
    });
    $('[data-pv-cover]', dlg).addEventListener('click', () => {
      const p = visible()[previewIndex];
      if (p) void setCover(p.id).then(renderPreview);
    });
    $('[data-pv-delete]', dlg).addEventListener('click', async () => {
      const p = visible()[previewIndex];
      if (!p) return;
      const removed = await removePhotos([p.id]);
      if (!removed) return;
      if (!visible().length) dlg.close();
      else {
        previewIndex = Math.min(previewIndex, visible().length - 1);
        renderPreview();
      }
    });

    on('photos', render);
    on('gallery', render);
  },
  load() {
    selected.clear();
    tiles.clear();
    setFilter = 'all';
    limit = CHUNK;
    anchor = -1;
    $<HTMLSelectElement>('[data-ph-sort]').value = sort;
    render();
  },
  show() {
    render();
  },
};

