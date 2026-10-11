/** Gallery editor: header, next-step hint, tabs and section wiring. */
import type { GalleryRecord, PhotoMeta } from '~/shared/gallery-types';
import { api, ApiError, errorText } from '../core/api';
import { $, $$, h, icon, setChildren } from '../core/dom';
import { C, T, fmtDay, fmtNumber, isYmd, photosLabel, plural } from '../core/i18n';
import { EDITOR_TABS, go, routes, type EditorTab, type Route } from '../core/router';
import { store } from '../core/store';
import { confirmDialog, copyWithToast, errorState, setBusy, toast, toastError } from '../core/ui';
import type { View } from '../core/view';
import { uploads } from '../upload/queue';
import { statusBadge } from '../views/galleries';
import { ed, emit, galleryApi, on, resetSync, syncNow, thumbUrl } from './state';
import { details } from './details';
import { sets } from './sets';
import { uploader } from './uploader';
import { photos } from './photos';
import { faces } from './faces';
import { share } from './share';
import { selections } from './selections';
import { danger } from './danger';

const SECTIONS = [details, danger, sets, uploader, photos, faces, share, selections];

const S = {
  facesLeaveTitle: { he: 'לעצור את סריקת הפנים?', en: 'Stop the face analysis?' },
  facesLeaveText: { he: 'יציאה מהגלריה תעצור את הסריקה. אפשר להמשיך אחר כך — מה שכבר נסרק נשמר.', en: 'Leaving this gallery stops the analysis. You can continue later — finished photos are remembered.' },
  facesLeaveOk: { he: 'עצירה ויציאה', en: 'Stop and leave' },
  publish: { he: 'פרסום הגלריה', en: 'Publish' },
  update: { he: 'עדכון', en: 'Update' },
  publishedToast: { he: 'הגלריה פורסמה! עכשיו אפשר לשלוח אותה לזוג 🎉', en: 'Published! Now send it to the couple 🎉' },
  updatedToast: { he: 'הגלריה עודכנה — האורחים רואים את הגרסה האחרונה', en: 'Updated — guests see the latest version' },
  shareAction: { he: 'לשיתוף', en: 'Share' },
  emptyPublishTitle: { he: 'אין עדיין תמונות בגלריה', en: 'There are no photos yet' },
  emptyPublishText: { he: 'האורחים יראו גלריה ריקה. לפרסם בכל זאת?', en: 'Guests will see an empty gallery. Publish anyway?' },
  emptyPublishOk: { he: 'לפרסם בכל זאת', en: 'Publish anyway' },
  uploadingPublish: { he: 'התמונות שעדיין עולות יתווספו לגלריה אוטומטית כשההעלאה תסתיים.', en: 'Photos still uploading will be added automatically when the upload finishes.' },
  notFound: { he: 'הגלריה הזאת לא נמצאה — אולי היא נמחקה.', en: 'This gallery wasn’t found — it may have been deleted.' },
  back: { he: 'לכל הגלריות', en: 'All galleries' },
  codeCopied: { he: 'קוד הגישה הועתק', en: 'Access code copied' },
  syncSaving: { he: 'מעדכן את הגלריה החיה…', en: 'Updating the live gallery…' },
  syncError: { he: 'האורחים עוד לא רואים את השינויים האחרונים.', en: 'Guests don’t see your latest changes yet.' },
  syncRetry: { he: 'עדכון עכשיו', en: 'Update now' },
  uploadDone: {
    he: ['ההעלאה הסתיימה — תמונה אחת נוספה לגלריה', 'ההעלאה הסתיימה — {n} תמונות נוספו לגלריה'],
    en: ['Upload complete — 1 photo added', 'Upload complete — {n} photos added'],
  } as { he: [string, string]; en: [string, string] },
  uploadDoneFailed: { he: 'הועלו: {p} · לא הצליחו לעלות: {f}. אפשר לנסות שוב ברשימת ההעלאה.', en: 'Uploaded: {p} · failed: {f}. You can retry them in the upload list.' },
  next: {
    empty: { he: 'מתחילים בהעלאת תמונות — אפשר לגרור לכאן תיקייה שלמה.', en: 'Start by adding photos — you can drag in a whole folder.' },
    emptyCta: { he: 'להעלאת תמונות', en: 'Add photos' },
    draft: { he: 'הכל מוכן? פרסום הגלריה יאפשר לזוג ולאורחים להיכנס עם הקישור או הקוד.', en: 'All set? Publishing lets the couple and guests open it with the link or code.' },
    published: { he: 'הגלריה באוויר. נשאר רק לשלוח את הקישור לזוג — בוואטסאפ, במייל או עם QR לשולחנות.', en: 'The gallery is live. Just send the link to the couple — by WhatsApp, email or a QR code for the tables.' },
    archived: { he: 'הגלריה בארכיון ולא מוצגת ברשימה הפעילה. אפשר לפרסם אותה שוב בכל רגע.', en: 'This gallery is archived and out of your active list. You can publish it again at any time.' },
    shareCta: { he: 'שיתוף הגלריה', en: 'Share the gallery' },
  },
};

let wired = false;
let token = 0;
let tab: EditorTab = 'photos';
let liveSyncCount = 0;
let liveSyncAt = 0;

const panel = () => $('[data-panel="gallery"]');

function show(part: 'loading' | 'error' | 'body') {
  $('[data-ed-loading]').hidden = part !== 'loading';
  $('[data-ed-error]').hidden = part !== 'error';
  $('[data-ed-body]').hidden = part !== 'body';
}

async function load(gid: string) {
  const my = ++token;
  resetSync();
  ed.state = null;
  show('loading');
  try {
    const res = await api<{ ok: true; gallery: GalleryRecord; photos: PhotoMeta[]; manifestVersion: number | null; faces: { faces: number; people: number } | null }>(galleryApi(gid));
    if (my !== token) return;
    const list = (res.photos ?? []).slice();
    ed.state = { gid, gallery: res.gallery, photos: list, faces: res.faces ?? null, manifestVersion: res.manifestVersion ?? null };
    store.upsertGallery({ ...res.gallery, photoCount: list.length });
    show('body');
    for (const s of SECTIONS) s.load();
    renderHeader();
    showTab();
  } catch (e) {
    if (my !== token) return;
    if (e instanceof ApiError && e.status === 401) return;
    const box = $('[data-ed-error]');
    box.replaceChildren(
      e instanceof ApiError && e.status === 404
        ? h(
            'div',
            { class: 'adm-empty adm-empty--error' },
            h('span', { class: 'adm-empty__icon' }, icon('circle-alert', 28)),
            h('p', { class: 'adm-empty__text' }, T(S.notFound)),
            h('a', { class: 'btn btn--sm', href: routes.galleries() }, T(S.back)),
          )
        : errorState(errorText(e), () => void load(gid)),
    );
    show('error');
  }
}

/* ─────────────────────────────── header ─────────────────────────────── */

function renderHeader() {
  const st = ed.state;
  if (!st) return;
  const g = st.gallery;
  const root = panel();
  $('[data-ed-title]', root).textContent = g.title;
  $('[data-ed-status]', root).replaceChildren(statusBadge(g.status));
  const date = $('[data-ed-date]', root);
  date.textContent = g.date && isYmd(g.date) ? fmtDay(g.date) : '';
  date.hidden = !date.textContent;
  $('[data-ed-count]', root).textContent = photosLabel(st.photos.length);
  $('[data-ed-code]', root).textContent = g.code;
  const cover = $('[data-ed-cover]', root);
  if (g.coverPhotoId) {
    const img = cover.querySelector('img');
    const src = thumbUrl(g.id, g.coverPhotoId);
    if (!img || img.getAttribute('src') !== src) cover.replaceChildren(h('img', { src, alt: '', decoding: 'async' }));
  } else cover.replaceChildren(h('span', { class: 'adm-gcard__mono' }, [...g.title.trim()][0] ?? '·'));
  $('[data-ed-publish-label]', root).textContent = T(g.status === 'published' ? S.update : S.publish);
  const view = $<HTMLAnchorElement>('[data-ed-view]', root);
  view.href = `${g.lang === 'en' ? '/en' : ''}/gallery/?g=${encodeURIComponent(g.id)}`;
  // tab counts
  const counts: Partial<Record<EditorTab, string>> = { photos: st.photos.length ? fmtNumber(st.photos.length) : '' };
  $$<HTMLElement>('[data-tab-count]', root).forEach((el) => {
    const k = el.dataset.tabCount as EditorTab;
    if (k in counts) el.textContent = counts[k] ?? '';
  });
  $$<HTMLAnchorElement>('[data-ed-tab]', root).forEach((a) => (a.href = routes.gallery(g.id, a.dataset.edTab as EditorTab)));
  $('[data-ed-tab="faces"]', root).classList.toggle('is-muted', !g.faceSearch);
  renderNext();
  renderSync();
}

function renderNext() {
  const st = ed.state;
  const box = $('[data-ed-next]');
  if (!st) return;
  const g = st.gallery;
  let text = '';
  let action: HTMLElement | null = null;
  let glyph: 'upload' | 'send' | 'share2' | 'info' = 'info';
  if (!st.photos.length && !uploads.busy(st.gid)) {
    text = T(S.next.empty);
    glyph = 'upload';
    if (tab !== 'photos') action = h('a', { class: 'btn btn--sm', href: routes.gallery(st.gid) }, T(S.next.emptyCta));
  } else if (g.status === 'draft') {
    text = T(S.next.draft);
    glyph = 'send';
    action = h('button', { type: 'button', class: 'btn btn--sm btn--solid', onclick: () => void publishClick() }, icon('send', 16, 'flip-rtl'), T(S.publish));
  } else if (g.status === 'published') {
    if (tab === 'share') {
      box.hidden = true;
      return;
    }
    text = T(S.next.published);
    glyph = 'share2';
    action = h('a', { class: 'btn btn--sm', href: routes.gallery(st.gid, 'share') }, icon('share2', 16), T(S.next.shareCta));
  } else {
    text = T(S.next.archived);
  }
  box.hidden = !text;
  box.dataset.kind = g.status;
  setChildren(box, h('span', { class: 'adm-next__icon' }, icon(glyph, 20, glyph === 'send' ? 'flip-rtl' : '')), h('p', { class: 'adm-next__text' }, text), action);
}

function renderSync() {
  const el = $('[data-ed-sync]');
  if (ed.sync === 'saving') {
    el.hidden = false;
    el.dataset.state = 'saving';
    el.replaceChildren(h('span', { class: 'adm-spinner', 'aria-hidden': 'true' }), T(S.syncSaving));
  } else if (ed.sync === 'error') {
    el.hidden = false;
    el.dataset.state = 'error';
    el.replaceChildren(
      icon('circle-alert', 16),
      T(S.syncError),
      h('button', { type: 'button', class: 'adm-linkbtn', onclick: () => ed.state && void syncNow(ed.state.gid) }, T(S.syncRetry)),
    );
  } else {
    el.hidden = true;
  }
}

async function publishClick() {
  const st = ed.state;
  if (!st) return;
  if (!st.photos.length && !uploads.busy(st.gid)) {
    const ok = await confirmDialog({ title: T(S.emptyPublishTitle), message: T(S.emptyPublishText), confirm: T(S.emptyPublishOk) });
    if (!ok) return;
  }
  const btn = $<HTMLButtonElement>('[data-ed-publish]');
  const wasPublished = st.gallery.status === 'published';
  setBusy(btn, true);
  try {
    await syncNow(st.gid, 'published');
    toast(T(wasPublished ? S.updatedToast : S.publishedToast), {
      action: { label: T(S.shareAction), run: () => ed.state && go(routes.gallery(ed.state.gid, 'share')) },
    });
    if (uploads.busy(st.gid)) toast(T(S.uploadingPublish), { type: 'info' });
  } catch (e) {
    toastError(errorText(e));
  } finally {
    setBusy(btn, false);
  }
}

/* ──────────────────────────────── tabs ──────────────────────────────── */

function showTab() {
  const root = panel();
  $$<HTMLElement>('[data-ed-panel]', root).forEach((p) => (p.hidden = p.dataset.edPanel !== tab));
  $$<HTMLAnchorElement>('[data-ed-tab]', root).forEach((a) => {
    if (a.dataset.edTab === tab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  const map = { photos, details, faces, share, selections } as const;
  map[tab].show?.();
  renderNext();
}

/* ─────────────────────────── upload events ─────────────────────────── */

async function ensureCover(gid: string, photoId: string) {
  const st = ed.state;
  if (st && st.gid === gid) {
    if (st.gallery.coverPhotoId) return;
    st.gallery.coverPhotoId = photoId;
    renderHeader();
  } else {
    const g = store.galleries?.find((x) => x.id === gid);
    if (!g || g.coverPhotoId) return;
  }
  try {
    const res = await api<{ ok: true; gallery: GalleryRecord }>(galleryApi(gid), { method: 'PATCH', body: { coverPhotoId: photoId } });
    if (ed.state?.gid === gid) ed.state.gallery = { ...ed.state.gallery, ...res.gallery };
    store.upsertGallery(res.gallery);
  } catch {
    /* not critical: the cover can be chosen by hand */
  }
}

function onUploadPhoto(e: Event) {
  const { gid, photo } = (e as CustomEvent<{ gid: string; photo: PhotoMeta }>).detail;
  const g = store.galleries?.find((x) => x.id === gid);
  if (g) g.photoCount = (g.photoCount ?? 0) + 1;
  const st = ed.state;
  if (!st || st.gid !== gid) return;
  st.photos.push(photo);
  emit('photos');
  renderHeader();
  // Live events: let guests see new photos while the upload continues.
  if (st.gallery.live && st.gallery.status === 'published') {
    liveSyncCount++;
    const now = Date.now();
    if (liveSyncCount >= 25 || now - liveSyncAt > 60_000) {
      liveSyncCount = 0;
      liveSyncAt = now;
      void syncNow(gid);
    }
  }
}

function onUploadDrain(e: Event) {
  const { gids } = (e as CustomEvent<{ gids: string[] }>).detail;
  for (const gid of gids) {
    const items = uploads.forGallery(gid);
    const done = items.filter((i) => i.status === 'done');
    const failed = items.filter((i) => i.status === 'failed').length;
    const first = done.slice().sort((a, b) => a.order - b.order)[0];
    void (async () => {
      if (first?.photo) await ensureCover(gid, first.photo.id);
      await syncNow(gid);
    })();
    if (ed.state?.gid === gid) {

      if (failed) toast(T(S.uploadDoneFailed, { p: fmtNumber(done.length), f: fmtNumber(failed) }), { type: 'error' });
      else if (done.length) toast(plural(done.length, S.uploadDone));
    }
  }
  renderNext();
}

/* ─────────────────────────────── wiring ─────────────────────────────── */

function wire() {
  if (wired) return;
  wired = true;
  const root = panel();
  $('[data-ed-publish]', root).addEventListener('click', () => void publishClick());
  $('[data-ed-share]', root).addEventListener('click', () => ed.state && go(routes.gallery(ed.state.gid, 'share')));
  $('[data-ed-code-copy]', root).addEventListener('click', () => ed.state && void copyWithToast(ed.state.gallery.code, T(S.codeCopied)));
  $<HTMLAnchorElement>('[data-ed-view]', root).addEventListener('click', (e) => {
    // A draft's preview should include changes that are still being saved.
    const st = ed.state;
    if (!st || ed.sync === 'idle' || ed.sync === 'error') return;
    e.preventDefault();
    const url = (e.currentTarget as HTMLAnchorElement).href;
    const w = window.open('about:blank', '_blank');
    void syncNow(st.gid).finally(() => {
      if (w) w.location.href = url;
      else window.open(url, '_blank');
    });
  });
  on('gallery', renderHeader);
  on('photos', renderHeader);
  on('sync', renderSync);
  uploads.addEventListener('photo', onUploadPhoto);
  uploads.addEventListener('drain', onUploadDrain);
  uploads.addEventListener('change', () => {
    if (ed.state && !ed.state.photos.length) renderNext();
  });
  for (const s of SECTIONS) s.init();
}

export const editorView: View = {
  mount(route: Route) {
    if (route.view !== 'gallery') return;
    wire();
    tab = (EDITOR_TABS as readonly string[]).includes(route.tab) ? route.tab : 'photos';
    if (!ed.state || ed.state.gid !== route.id) void load(route.id);
    else showTab();
  },
  leaveWarning(next: Route) {
    if (!ed.state) return null;
    const leavingGallery = next.view !== 'gallery' || next.id !== ed.state.gid;
    if (!leavingGallery) return null;
    if (faces.isRunning()) return { title: T(S.facesLeaveTitle), message: T(S.facesLeaveText), confirm: T(S.facesLeaveOk) };
    if (details.isDirty()) return { title: T(C.discardTitle), message: T(C.discardText), confirm: T(C.discardOk) };
    return null;
  },
  discard() {
    faces.stop();
    details.reset();
  },
};
