/**
 * The client gallery once a manifest is loaded: cover, note, people, sticky
 * toolbar with filters, the virtualised grid, favourites + album selection,
 * downloads, sharing, slideshow, "find me" and live updates.
 */
import type { GalleryManifest, Person, PhotoMeta } from '~/shared/gallery-types';
import { iconSvg, type IconName } from '~/shared/icons';
import { api, media } from './api';
import { fmtDate, fmtNum, t, tn } from './format';
import { Favourites, store } from './store';
import { PhotoGrid, type GridSection } from './grid';
import { announce, closeDialog, copyText, openDialog, scrollToY, shareOrCopy, toast } from './ui';
import { lightboxOpen, openLightbox } from './lightbox';
import { openDownloads } from './download';
import { openSelection } from './selection';
import { initFindMe } from './findme';
import { syncLangLink } from './entry';

export interface AppConfig {
  lang: 'he' | 'en';
  home: string;
  contact: string;
  galleryPath: string;
  otherGalleryPath: string;
  siteName: string;
}

type Filter = { kind: 'all' } | { kind: 'set'; id: string } | { kind: 'favs' } | { kind: 'person'; id: string } | { kind: 'me' };
interface Group {
  key: string;
  title: string;
  items: PhotoMeta[];
}

const OTHER = '__other';
const LIVE_MS = 60_000;
const html = document.documentElement;
const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;
const narrow = matchMedia('(max-width: 760px)');

export function mountGallery(initial: GalleryManifest, cfg: AppConfig, options: { photo?: string | null } = {}) {
  const rtl = cfg.lang === 'he';
  const gid = initial.id;
  let m = initial;
  const favs = new Favourites(gid);
  let photos: PhotoMeta[] = [];
  let byId = new Map<string, PhotoMeta>();
  let numberOf = new Map<string, number>();
  let groups: Group[] = [];
  let allOrder: PhotoMeta[] = [];
  let meIds = store.me(gid);
  let filter: Filter = { kind: 'all' };
  let view: PhotoMeta[] = [];
  let pendingRefresh = false;
  let suppressHideUntil = 0;

  /* ── elements ── */
  const head = $('[data-g-head]');
  const cover = $('[data-cover]');
  const coverImg = $<HTMLImageElement>('[data-cover-img]');
  const note = $('[data-note]');
  const peopleSection = $('[data-people]');
  const strip = $('[data-people-strip]');
  const bar = $('[data-bar]');
  const filters = $('.g-bar__filters');
  const tabsEl = $('[data-tabs]');
  const chip = $('[data-chip]');
  const photosSection = $('[data-photos]');
  const gridEl = $('[data-grid]');
  const emptyEl = $('[data-empty]');
  const favbar = $('[data-favbar]');
  const dlg = (name: string) => $<HTMLDialogElement>(`[data-dlg="${name}"]`);

  const findMe = initFindMe({
    dlg: dlg('findme'),
    gid,
    total: () => photos.length,
    has: (pid) => byId.has(pid),
    onResult: (ids) => {
      meIds = ids;
      store.setMe(gid, ids);
      renderTabs();
      applyFilter({ kind: 'me' }, { scroll: false });
    },
    onClose: () => {
      if (filter.kind === 'me') scrollToGrid(true);
    },
  });

  /* ── data ── */
  function index(manifest: GalleryManifest) {
    photos = (manifest.photos ?? []).filter((p) => p && typeof p.id === 'string');
    byId = new Map(photos.map((p) => [p.id, p]));
    numberOf = new Map(photos.map((p, i) => [p.id, i + 1]));
    const sets = manifest.sets ?? [];
    const setIds = new Set(sets.map((s) => s.id));
    groups = sets.map((s) => ({ key: s.id, title: s.name, items: photos.filter((p) => p.set === s.id) })).filter((g) => g.items.length);
    const rest = photos.filter((p) => !p.set || !setIds.has(p.set));
    if (groups.length && rest.length) groups.push({ key: OTHER, title: t('otherSet'), items: rest });
    if (groups.length < 2) groups = [];
    allOrder = groups.length ? groups.flatMap((g) => g.items) : photos;
    meIds = meIds.filter((id) => byId.has(id));
  }
  const groupOf = (p: PhotoMeta) => groups.find((g) => g.items.includes(p));
  const people = (): Person[] => [...(m.people ?? [])].filter((p) => p.photoIds?.some((id) => byId.has(id))).sort((a, b) => b.count - a.count);
  const favIds = () => favs.ordered(allOrder.map((p) => p.id));

  /* ── grid ── */
  const headHeight = () => (head.hasAttribute('data-hidden') ? 0 : head.getBoundingClientRect().height);
  const topInset = () => {
    const hh = headHeight();
    const b = bar.getBoundingClientRect();
    return b.top <= hh + 2 ? Math.max(hh, b.bottom) : hh;
  };
  const grid = new PhotoGrid({
    root: gridEl,
    gid,
    rtl,
    isFav: favs.has,
    onOpen: (i) => openAt(i),
    onToggleFav: (pid) => toggleFav(pid),
    topInset,
    scrollTo: (y, smooth) => scrollToY(y, smooth),
    labels: {
      alt: (n, total) => t('photoAlt', { n, total }),
      favAdd: (n) => t('favAdd', { n }),
      favRemove: (n) => t('favRemove', { n }),
      view: t('view'),
      sectionCount: (n) => tn('photos', n),
    },
  });

  /* ── cover & note ── */
  function renderCover() {
    const coverId = m.coverPhotoId && byId.has(m.coverPhotoId) ? m.coverPhotoId : photos[0]?.id;
    if (coverId) {
      const src = media.photo(gid, coverId, 'web');
      if (coverImg.dataset.src !== src) {
        coverImg.dataset.src = src;
        coverImg.classList.remove('is-loaded');
        coverImg.onload = () => coverImg.classList.add('is-loaded');
        coverImg.src = src;
        if (coverImg.complete && coverImg.naturalWidth) coverImg.classList.add('is-loaded');
      }
    }
    $('[data-cover-title]').textContent = m.title;
    const sub = $('[data-cover-subtitle]');
    sub.textContent = m.subtitle ?? '';
    sub.hidden = !m.subtitle;
    $('[data-cover-eyebrow]').textContent = m.date ? fmtDate(m.date) : t('coverEyebrow');
    $('[data-live]').hidden = !m.live;
    const meta = $('[data-cover-meta]');
    meta.replaceChildren();
    if (!m.externalUrl && photos.length) {
      const parts = [tn('photos', photos.length)];
      if (groups.length) parts.push(tn('chapters', groups.length));
      parts.forEach((text) => {
        const s = document.createElement('span');
        s.textContent = text;
        meta.append(s);
      });
    }
    const external = $<HTMLAnchorElement>('[data-cover-external]');
    const cta = $('[data-cover-cta]');
    if (m.externalUrl && /^https?:\/\//i.test(m.externalUrl)) {
      external.href = m.externalUrl;
      external.hidden = false;
      cta.hidden = true;
      cover.dataset.external = '';
      meta.textContent = t('externalNote');
    } else {
      external.hidden = true;
      cta.hidden = !photos.length;
      delete cover.dataset.external;
    }
    $('[data-g-head-title]').textContent = m.title;
    document.title = `${m.title} · ${cfg.siteName}`;
  }

  function renderNote() {
    const text = (m.message ?? '').trim();
    note.hidden = !text;
    $('[data-note-text]').textContent = text;
  }

  /* ── people ── */
  function personButton(p: Person, n: number): HTMLLIElement {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'g-person';
    b.dataset.person = p.id;
    b.setAttribute('aria-pressed', 'false');
    const count = p.photoIds.filter((id) => byId.has(id)).length;
    b.setAttribute('aria-label', t('personLabel', { n, count: tn('photos', count) }));
    const face = document.createElement('span');
    face.className = 'g-person__face';
    if (p.hasCrop) {
      const img = document.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.addEventListener('load', () => img.classList.add('is-loaded'));
      img.addEventListener('error', () => img.replaceWith(htmlToNode(iconSvg('user-round', { size: 26 }))));
      img.src = media.person(gid, p.id);
      face.append(img);
    } else face.innerHTML = iconSvg('user-round', { size: 26 });
    const c = document.createElement('span');
    c.className = 'g-person__count';
    c.textContent = fmtNum(count);
    b.append(face, c);
    li.append(b);
    return li;
  }

  function renderPeople() {
    const list = people();
    peopleSection.hidden = !list.length || !!m.externalUrl;
    $('[data-people-count]').textContent = tn('peopleCount', list.length);
    const fill = (target: HTMLElement) => target.replaceChildren(...list.map((p, i) => personButton(p, i + 1)));
    fill(strip);
    fill($('[data-people-grid]'));
    fill($('[data-more-strip]'));
    $('[data-more-people]').hidden = !list.length;
    const stack = $('[data-people-stack]');
    stack.replaceChildren();
    list
      .filter((p) => p.hasCrop)
      .slice(0, 3)
      .forEach((p) => {
        const s = document.createElement('span');
        const img = document.createElement('img');
        img.alt = '';
        img.src = media.person(gid, p.id);
        s.append(img);
        stack.append(s);
      });
    if (!stack.children.length) stack.innerHTML = iconSvg('users', { size: 18 });
    $('[data-act="people"]').hidden = !list.length;
    syncPeople();
    updatePeopleNav();
  }

  function syncPeople() {
    const active = filter.kind === 'person' ? filter.id : null;
    document.querySelectorAll<HTMLElement>('[data-person]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.person === active)));
    strip.classList.toggle('has-active', !!active);
  }

  const prevBtn = $<HTMLButtonElement>('[data-people-prev]');
  const nextBtn = $<HTMLButtonElement>('[data-people-next]');
  function updatePeopleNav() {
    const max = strip.scrollWidth - strip.clientWidth;
    const pos = Math.abs(strip.scrollLeft);
    $('.g-people__nav').hidden = max <= 4;
    prevBtn.disabled = pos <= 4;
    nextBtn.disabled = pos >= max - 4;
  }
  const scrollPeople = (dir: 1 | -1) => strip.scrollBy({ left: dir * (rtl ? -1 : 1) * strip.clientWidth * 0.8, behavior: 'smooth' });
  prevBtn.addEventListener('click', () => scrollPeople(-1));
  nextBtn.addEventListener('click', () => scrollPeople(1));
  strip.addEventListener('scroll', updatePeopleNav, { passive: true });
  window.addEventListener('resize', updatePeopleNav, { passive: true });

  document.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-person]');
    if (!b) return;
    const id = b.dataset.person!;
    const inDialog = b.closest('dialog');
    if (inDialog) void closeDialog(inDialog as HTMLDialogElement, false);
    if (filter.kind === 'person' && filter.id === id) applyFilter({ kind: 'all' }, { scroll: !!inDialog });
    else applyFilter({ kind: 'person', id }, { scroll: true, force: true });
  });

  /* ── tabs & chip ── */
  const keyOf = (f: Filter) => (f.kind === 'set' ? `set:${f.id}` : f.kind);
  function renderTabs() {
    const tabs: { key: string; label: string; count: number; filter: Filter; icon?: IconName; cls?: string }[] = [
      { key: 'all', label: t('tabAll'), count: photos.length, filter: { kind: 'all' } },
      ...groups.map((g) => ({ key: `set:${g.key}`, label: g.title, count: g.items.length, filter: { kind: 'set', id: g.key } as Filter })),
      { key: 'favs', label: t('tabFavs'), count: favIds().length, filter: { kind: 'favs' }, icon: 'heart', cls: 'g-tab--favs' },
    ];
    if (meIds.length) tabs.push({ key: 'me', label: t('tabMe'), count: meIds.length, filter: { kind: 'me' }, icon: 'scan-face' });
    tabsEl.replaceChildren(
      ...tabs.map((tab) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `g-tab${tab.cls ? ` ${tab.cls}` : ''}`;
        b.dataset.tab = tab.key;
        b.innerHTML = `${tab.icon ? iconSvg(tab.icon, { size: 15, stroke: 1.6 }) : ''}<span class="g-tab__label" dir="auto"></span><span class="g-tab__n"></span>`;
        b.querySelector('.g-tab__label')!.textContent = tab.label;
        b.querySelector('.g-tab__n')!.textContent = fmtNum(tab.count);
        b.addEventListener('click', () => applyFilter(tab.filter, { scroll: true }));
        return b;
      }),
    );
    syncTabs();
  }
  function syncTabs() {
    const k = keyOf(filter);
    tabsEl.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === k)));
    const favTab = tabsEl.querySelector('[data-tab="favs"] .g-tab__n');
    if (favTab) favTab.textContent = fmtNum(favIds().length);
    tabsEl.classList.toggle('is-fit', tabsEl.scrollWidth <= tabsEl.clientWidth + 1);
    // Keep the active tab visible inside the tab scroller (never scroll the page).
    const active = tabsEl.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (active && tabsEl.scrollWidth > tabsEl.clientWidth) {
      const box = tabsEl.getBoundingClientRect();
      const r = active.getBoundingClientRect();
      if (r.left < box.left) tabsEl.scrollLeft -= box.left - r.left + 24;
      else if (r.right > box.right) tabsEl.scrollLeft += r.right - box.right + 24;
    }
  }

  function renderChip() {
    const face = $('[data-chip-media]');
    const label = $('[data-chip-text]');
    /** Full sentence on wide screens, a compact one on phones. */
    const setLabel = (long: string, short: string) => {
      label.innerHTML = '<span class="g-chip__long"></span><span class="g-chip__short"></span>';
      label.firstElementChild!.textContent = long;
      label.lastElementChild!.textContent = short;
    };
    if (filter.kind === 'person') {
      const id = filter.id;
      const p = (m.people ?? []).find((x) => x.id === id);
      face.innerHTML = p?.hasCrop ? '' : iconSvg('user-round', { size: 16 });
      if (p?.hasCrop) {
        const img = document.createElement('img');
        img.alt = '';
        img.src = media.person(gid, p.id);
        face.append(img);
      }
      setLabel(t('showingPerson', { count: tn('photos', view.length) }), tn('photos', view.length));
      chip.hidden = false;
    } else if (filter.kind === 'me') {
      face.innerHTML = iconSvg('scan-face', { size: 16 });
      setLabel(`${t('showingMe')} · ${fmtNum(view.length)}`, `${t('tabMe')} · ${fmtNum(view.length)}`);
      chip.hidden = false;
    } else chip.hidden = true;
    filters.classList.toggle('has-chip', !chip.hidden);
  }
  $('[data-chip-clear]').addEventListener('click', () => {
    applyFilter({ kind: 'all' }, { scroll: true });
    tabsEl.querySelector<HTMLElement>('[data-tab="all"]')?.focus();
  });

  /* ── filtering ── */
  function compute(f: Filter): { items: PhotoMeta[]; sections: GridSection[]; headings: boolean } {
    switch (f.kind) {
      case 'set': {
        const g = groups.find((x) => x.key === f.id);
        return { items: g?.items ?? [], sections: [], headings: false };
      }
      case 'favs': {
        const items = allOrder.filter((p) => favs.has(p.id));
        return { items, sections: [], headings: false };
      }
      case 'person': {
        const person = (m.people ?? []).find((p) => p.id === f.id);
        const ids = new Set(person?.photoIds ?? []);
        return { items: allOrder.filter((p) => ids.has(p.id)), sections: [], headings: false };
      }
      case 'me':
        return { items: meIds.map((id) => byId.get(id)).filter((p): p is PhotoMeta => !!p), sections: [], headings: false };
      default:
        return {
          items: allOrder,
          sections: groups.map((g) => ({ key: g.key, title: g.title, count: g.items.length })),
          headings: groups.length > 0,
        };
    }
  }

  function applyFilter(f: Filter, opts: { scroll?: boolean; force?: boolean; quiet?: boolean; keep?: boolean } = {}) {
    if (f.kind === 'set') {
      const id = f.id;
      if (!groups.some((g) => g.key === id)) f = { kind: 'all' };
    }
    if (f.kind === 'me' && !meIds.length) f = { kind: 'all' };
    filter = f;
    const v = compute(f);
    view = v.items;
    grid.setItems(v.items, v.sections, v.headings, !!opts.keep);
    syncTabs();
    renderChip();
    renderEmpty();
    syncPeople();
    if (opts.scroll) scrollToGrid(!!opts.force);
    if (!opts.quiet) announce(tn('announceShowing', view.length));
  }

  function renderEmpty() {
    const empty = view.length === 0;
    emptyEl.hidden = !empty;
    gridEl.hidden = empty;
    if (!empty) return;
    const kind = filter.kind;
    const [title, text, icon]: [string, string, IconName] =
      kind === 'favs'
        ? [t('emptyFavsTitle'), t('emptyFavsText'), 'heart']
        : kind === 'all'
          ? [t('emptyGalleryTitle'), t('emptyGalleryText'), 'images']
          : [t('emptyFilterTitle'), t('emptyFilterText'), 'search'];
    $('[data-empty-title]').textContent = title;
    $('[data-empty-text]').textContent = text;
    $('[data-empty-icon]').innerHTML = iconSvg(icon, { size: 24 });
    $('[data-empty-action]').hidden = kind === 'all';
  }
  $('[data-empty-action]').addEventListener('click', () => applyFilter({ kind: 'all' }, { scroll: true }));

  /** Bring the start of the photos to just below the sticky toolbar. */
  function scrollToGrid(force = false) {
    const target = photosSection.getBoundingClientRect().top + window.scrollY - head.getBoundingClientRect().height - bar.getBoundingClientRect().height;
    const y = window.scrollY;
    if (y > target + 4 || (force && target - y > 40)) {
      suppressHideUntil = Date.now() + 1500;
      head.removeAttribute('data-hidden');
      html.classList.remove('g-head-hidden');
      scrollToY(Math.max(0, target), Math.abs(target - y) < window.innerHeight * 2.5);
    }
  }

  /* ── favourites ── */
  function toggleFav(pid: string) {
    const on = favs.toggle(pid);
    announce(on ? t('announceFavAdd') : t('announceFavRemove'));
    const btn = gridEl.querySelector<HTMLElement>(`.g-tile[data-pid="${CSS.escape(pid)}"] .g-tile__fav`);
    if (btn && on) {
      btn.classList.remove('is-pop');
      void btn.offsetWidth;
      btn.classList.add('is-pop');
    }
  }
  favs.addEventListener('change', (e) => {
    const pid = (e as CustomEvent<{ pid: string | null }>).detail.pid;
    grid.refreshFav(pid);
    syncTabs();
    renderFavbar(true);
    if (filter.kind === 'favs') {
      if (lightboxOpen()) pendingRefresh = true;
      else applyFilter(filter, { quiet: true, keep: true });
    }
  });

  const favCount = $('[data-favbar-count]');
  const favCountBtn = $('[data-favbar-view]');
  const sendLabel = $('[data-favbar-send-label]');
  function renderFavbar(bump = false) {
    const ids = favIds();
    const n = ids.length;
    const wasHidden = favbar.hidden;
    favbar.hidden = n === 0 || !!m.externalUrl;
    if (favbar.hidden) return;
    if (wasHidden) {
      favbar.classList.remove('is-entering');
      void favbar.offsetWidth;
      favbar.classList.add('is-entering');
    }
    favCount.textContent = tn('favCount', n);
    favCountBtn.setAttribute('aria-label', `${tn('favCount', n)} — ${t('favView')}`);
    const sent = store.sent(gid);
    const same = !!sent && sent.ids.length === n && sent.ids.every((id) => favs.has(id));
    $('[data-favbar-sent]').hidden = !same || narrow.matches;
    sendLabel.textContent = sent ? t('favSendUpdate') : narrow.matches ? t('favSendShort') : t('favSend');
    if (bump && !wasHidden) {
      favCountBtn.classList.remove('is-bump');
      void favCountBtn.offsetWidth;
      favCountBtn.classList.add('is-bump');
    }
  }
  narrow.addEventListener('change', () => renderFavbar());
  favCountBtn.addEventListener('click', () => applyFilter({ kind: 'favs' }, { scroll: true, force: true }));
  $('[data-favbar-send]').addEventListener('click', () =>
    openSelection({
      dlg: dlg('select'),
      gid,
      title: m.title,
      favIds: favIds(),
      photos: byId,
      numberOf: (id) => numberOf.get(id) ?? 0,
      onSent: () => renderFavbar(),
    }),
  );

  /* ── lightbox & slideshow ── */
  function openAt(index: number, slideshow = false) {
    const items = view.slice();
    if (!items.length) return;
    void openLightbox({
      gid,
      items,
      index: Math.max(0, Math.min(items.length - 1, index)),
      rtl,
      allowDownload: m.allowDownload,
      allowOriginals: m.allowOriginals,
      slideshow,
      caption: groups.length && filter.kind === 'all' ? (p) => groupOf(p)?.title ?? '' : undefined,
      isFav: favs.has,
      toggleFav: (pid) => toggleFav(pid),
      favEvents: favs,
      thumbOf: (i) => {
        const gi = grid.indexOfId(items[i]?.id ?? '');
        return gi >= 0 ? grid.thumbOf(gi) : null;
      },
      beforeClose: (i) => {
        const pid = items[i]?.id;
        if (pid) grid.revealThumb(pid);
      },
      onChange: (i) => setPhotoParam(items[i]?.id ?? null),
      onClose: (i) => {
        setPhotoParam(null);
        exitFullscreen();
        if (pendingRefresh) {
          pendingRefresh = false;
          applyFilter(filter, { quiet: true, keep: true });
        }
        const gi = grid.indexOfId(items[i]?.id ?? '');
        if (gi >= 0) grid.focus(gi);
      },
      onShare: (p, el) => void sharePhoto(p, el),
    });
  }

  function enterFullscreen() {
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    try {
      if (el.requestFullscreen) void el.requestFullscreen().catch(() => undefined);
      else el.webkitRequestFullscreen?.();
    } catch {
      /* not supported (e.g. iPhone) */
    }
  }
  function exitFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  }
  function startSlideshow() {
    if (!view.length) return;
    enterFullscreen();
    openAt(0, true);
  }

  /* ── sharing ── */
  const galleryUrl = () => `${location.origin}${cfg.galleryPath}?g=${encodeURIComponent(gid)}`;
  const shareTitle = () => t('shareTitle', { title: m.title });
  async function shareGallery() {
    const res = await shareOrCopy({ url: galleryUrl(), title: shareTitle(), text: t('shareText', { title: m.title }) });
    if (res === 'copied') toast(t('linkCopied'), { icon: 'check', action: { label: t('showQr'), run: () => void showQr() } });
    else if (res === 'failed') toast(t('copyFailed'), { icon: 'circle-alert', action: { label: t('showQr'), run: () => void showQr() } });
  }
  async function sharePhoto(p: PhotoMeta, btn: HTMLElement) {
    const url = `${galleryUrl()}&p=${encodeURIComponent(p.id)}`;
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    let files: File[] | undefined;
    if (m.allowDownload && typeof nav.share === 'function' && typeof nav.canShare === 'function') {
      btn.classList.add('is-busy');
      try {
        const res = await fetch(media.photo(gid, p.id, 'web'));
        const blob = await res.blob();
        const file = new File([blob], `photo-${numberOf.get(p.id) ?? 1}.jpg`, { type: blob.type || 'image/jpeg' });
        if (nav.canShare({ files: [file] })) files = [file];
      } catch {
        /* share the link instead */
      } finally {
        btn.classList.remove('is-busy');
      }
    }
    const res = await shareOrCopy({ url, title: shareTitle(), text: t('shareText', { title: m.title }), files });
    if (res === 'copied') toast(t('linkCopied'), { icon: 'check' });
    else if (res === 'failed') toast(t('copyFailed'), { icon: 'circle-alert' });
  }
  async function showQr() {
    const box = $('[data-qr]');
    try {
      const { renderSVG } = await import('uqr');
      box.innerHTML = renderSVG(galleryUrl(), { border: 1, blackColor: '#161311', whiteColor: '#ffffff' });
    } catch {
      box.textContent = galleryUrl();
    }
    openDialog(dlg('qr'));
  }

  /* ── toolbar & menu actions ── */
  document.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!btn || btn.closest('.pswp')) return;
    const act = btn.dataset.act;
    const moreDlg = dlg('more');
    const fromMenu = !!btn.closest('[data-dlg="more"]');
    const afterMenu = (fn: () => void) => {
      if (fromMenu) void closeDialog(moreDlg, false).then(fn);
      else fn();
    };
    switch (act) {
      case 'people':
        openDialog(dlg('people'));
        break;
      case 'findme':
        findMe.open();
        break;
      case 'download':
        afterMenu(() => openDownloads({ dlg: dlg('download'), gid, photos, favIds: favs.ordered(photos.map((p) => p.id)), allowOriginals: m.allowOriginals }));
        break;
      case 'slideshow':
        // Fullscreen must be requested straight from the click.
        if (fromMenu) {
          enterFullscreen();
          void closeDialog(moreDlg, false).then(() => openAt(0, true));
        } else startSlideshow();
        break;
      case 'share':
        afterMenu(() => void shareGallery());
        break;
      case 'qr':
        afterMenu(() => void showQr());
        break;
      case 'copy':
        void copyText(galleryUrl()).then((ok) => toast(ok ? t('linkCopied') : t('copyFailed'), { icon: ok ? 'check' : 'circle-alert' }));
        break;
      case 'more':
        openDialog(moreDlg);
        break;
    }
  });

  /* ── header & toolbar on scroll ── */
  let lastY = window.scrollY;
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const y = window.scrollY;
    const coverH = cover.offsetHeight;
    const hh = head.getBoundingClientRect().height || 60;
    head.toggleAttribute('data-solid', y > coverH - hh - 8);
    const barRect = bar.getBoundingClientRect();
    const stickTop = html.classList.contains('g-head-hidden') ? 0 : hh;
    bar.classList.toggle('is-stuck', !bar.hidden && barRect.top <= stickTop + 1 && y > 10);
    // Hide the header while scrolling down through the photos; show it on the way up.
    const inPhotos = y > photosSection.offsetTop - hh - (bar.hidden ? 0 : barRect.height) - 4;
    const delta = y - lastY;
    let hidden = head.hasAttribute('data-hidden');
    if (Date.now() < suppressHideUntil || !inPhotos || head.matches(':focus-within')) hidden = false;
    else if (delta > 6) hidden = true;
    else if (delta < -6) hidden = false;
    head.toggleAttribute('data-hidden', hidden);
    html.classList.toggle('g-head-hidden', hidden);
    lastY = y;
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(onScroll);
      }
    },
    { passive: true },
  );

  $('[data-cover-cta]').addEventListener('click', (e) => {
    e.preventDefault();
    scrollToGrid(true);
  });
  $('[data-cover-scroll]').addEventListener('click', (e) => {
    e.preventDefault();
    scrollToGrid(true);
  });

  /* ── deep link to a photo (?p=) ── */
  function setPhotoParam(pid: string | null) {
    const url = new URL(location.href);
    if (pid) url.searchParams.set('p', pid);
    else url.searchParams.delete('p');
    history.replaceState(history.state, '', url);
    syncLangLink();
  }

  /* ── live updates ── */
  let liveTimer = 0;
  let lastPoll = Date.now();
  const stopLive = () => {
    clearInterval(liveTimer);
    liveTimer = 0;
  };
  const startLive = () => {
    stopLive();
    if (m.live) liveTimer = window.setInterval(poll, LIVE_MS);
  };
  async function poll() {
    if (document.hidden) return;
    lastPoll = Date.now();
    let next: GalleryManifest;
    try {
      next = await api.gallery(gid);
    } catch {
      return;
    }
    if (next.version === m.version) return;
    const added = (next.photos ?? []).filter((p) => !byId.has(p.id)).map((p) => p.id);
    m = next;
    index(m);
    renderCover();
    renderNote();
    renderTabs();
    renderPeople();
    applyFilter(filter, { quiet: true, keep: true });
    renderFavbar();
    if (added.length) {
      grid.markNew(added);
      toast(t('newPhotos'), {
        icon: 'sparkles',
        action: {
          label: t('showNew'),
          run: () => {
            if (!added.some((id) => view.some((p) => p.id === id))) applyFilter({ kind: 'all' });
            const i = view.findIndex((p) => added.includes(p.id));
            if (i >= 0) grid.focus(i);
          },
        },
      });
    }
    if (!m.live) stopLive();
    else if (!liveTimer) startLive();
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && m.live && Date.now() - lastPoll > LIVE_MS) void poll();
  });

  /* ── go ── */
  index(m);
  favs.prune(new Set(byId.keys()));
  html.classList.add('g-in-gallery');
  renderCover();
  renderNote();
  const external = !!m.externalUrl;
  bar.hidden = external;
  photosSection.hidden = external;
  $<HTMLElement>('[data-act="findme"]').hidden = !(m.faceSearch && m.hasFaces) || external;
  document.querySelectorAll<HTMLElement>('[data-act="download"]').forEach((b) => (b.hidden = !m.allowDownload));
  document.querySelectorAll<HTMLElement>('[data-act="slideshow"]').forEach((b) => (b.hidden = photos.length < 2));
  renderTabs();
  renderPeople();
  if (!external) applyFilter({ kind: 'all' }, { quiet: true });
  renderFavbar();
  startLive();
  requestAnimationFrame(() => {
    cover.classList.add('is-in');
    onScroll();
    syncTabs();
  });
  window.addEventListener('resize', () => syncTabs(), { passive: true });
  store.pushRecent({ id: gid, title: m.title, cover: m.coverPhotoId ?? photos[0]?.id });

  if (options.photo && !external) {
    const i = view.findIndex((p) => p.id === options.photo);
    if (i >= 0) window.setTimeout(() => openAt(i), 350);
  }
}

function htmlToNode(markup: string): Node {
  const tpl = document.createElement('template');
  tpl.innerHTML = markup;
  return tpl.content.firstChild ?? document.createTextNode('');
}
