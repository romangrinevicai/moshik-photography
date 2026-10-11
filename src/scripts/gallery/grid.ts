/**
 * Virtualised justified grid. Only the photos near the viewport exist in the
 * DOM, so galleries with thousands of photos scroll smoothly. Tiles are
 * positioned absolutely from a precomputed layout (see layout.ts).
 *
 * Keyboard: one tile is "current" (roving tabindex). Arrow keys move between
 * photos (row-aware for up/down), Home/End jump, Enter opens, F favourites.
 */
import type { PhotoMeta } from '~/shared/gallery-types';
import { iconSvg } from '~/shared/icons';
import { justify, metricsFor, type Layout } from './layout';
import { media } from './api';

export interface GridSection {
  key: string;
  title: string;
  /** Number of photos (taken in order from the flat list). */
  count: number;
}

export interface GridOptions {
  root: HTMLElement;
  gid: string;
  rtl: boolean;
  isFav: (pid: string) => boolean;
  onOpen: (index: number) => void;
  onToggleFav: (pid: string, index: number) => void;
  /** Height covered by sticky chrome at the top of the viewport. */
  topInset: () => number;
  scrollTo: (y: number, smooth: boolean) => void;
  labels: {
    alt: (n: number, total: number) => string;
    favAdd: (n: number) => string;
    favRemove: (n: number) => string;
    view: string;
    sectionCount: (n: number) => string;
  };
}

const HEART = iconSvg('heart', { size: 18, stroke: 1.6 });

export class PhotoGrid {
  private o: GridOptions;
  private root: HTMLElement;
  private items: PhotoMeta[] = [];
  private sections: GridSection[] = [];
  private headings = false;
  private layout: Layout | null = null;
  private width = 0;
  private tiles = new Map<string, HTMLElement>();
  private heads = new Map<string, HTMLElement>();
  private indexOf = new Map<string, number>();
  private current = 0;
  private raf = 0;
  private settleTimer = 0;
  private highlight = new Set<string>();
  private ro: ResizeObserver;

  constructor(o: GridOptions) {
    this.o = o;
    this.root = o.root;
    this.root.addEventListener('click', this.onClick);
    this.root.addEventListener('keydown', this.onKey);
    this.root.addEventListener('focusin', this.onFocusIn);
    window.addEventListener('scroll', this.schedule, { passive: true });
    window.addEventListener('resize', this.schedule, { passive: true });
    this.ro = new ResizeObserver(() => {
      const w = Math.round(this.root.clientWidth);
      if (w && w !== this.width) this.relayout(true);
    });
    this.ro.observe(this.root);
  }

  /* ───────────────────────────── data ───────────────────────────── */

  /** Replace the photos shown. `sections` split the flat list into headed groups. */
  setItems(items: PhotoMeta[], sections: GridSection[], headings: boolean, keepPosition = false) {
    const prevCurrent = this.items[this.current]?.id;
    this.items = items;
    this.sections = sections.length ? sections : [{ key: 'all', title: '', count: items.length }];
    this.headings = headings;
    this.indexOf = new Map(items.map((p, i) => [p.id, i]));
    this.current = prevCurrent && this.indexOf.has(prevCurrent) ? this.indexOf.get(prevCurrent)! : 0;
    // Tiles of photos that are no longer listed go away; the rest are reused.
    for (const [pid, el] of this.tiles) {
      if (!this.indexOf.has(pid)) {
        el.remove();
        this.tiles.delete(pid);
      }
    }
    for (const el of this.heads.values()) el.remove();
    this.heads.clear();
    this.relayout(keepPosition);
  }

  get length() {
    return this.items.length;
  }

  /** Briefly mark photos as new (live mode). */
  markNew(ids: string[]) {
    ids.forEach((id) => this.highlight.add(id));
    for (const id of ids) this.tiles.get(id)?.classList.add('is-new');
    window.setTimeout(() => {
      ids.forEach((id) => {
        this.highlight.delete(id);
        this.tiles.get(id)?.classList.remove('is-new');
      });
    }, 6000);
  }

  /** Re-sync heart buttons (all, or one photo). */
  refreshFav(pid?: string | null) {
    const update = (id: string, el: HTMLElement) => {
      const on = this.o.isFav(id);
      const i = this.indexOf.get(id) ?? 0;
      el.classList.toggle('is-fav', on);
      const btn = el.querySelector<HTMLButtonElement>('.g-tile__fav');
      if (btn) {
        btn.setAttribute('aria-pressed', String(on));
        btn.setAttribute('aria-label', on ? this.o.labels.favRemove(i + 1) : this.o.labels.favAdd(i + 1));
      }
    };
    if (pid) {
      const el = this.tiles.get(pid);
      if (el) update(pid, el);
    } else this.tiles.forEach((el, id) => update(id, el));
  }

  /** Thumbnail image of a photo if it is rendered (for the lightbox zoom animation). */
  thumbOf(index: number): HTMLImageElement | null {
    const p = this.items[index];
    const el = p ? this.tiles.get(p.id) : undefined;
    return el?.querySelector('img') ?? null;
  }

  /** Index of a photo in the current list, or -1. */
  indexOfId(pid: string): number {
    return this.indexOf.get(pid) ?? -1;
  }

  /** Thumbnail of a photo by id, bringing it into view first (lightbox closing). */
  revealThumb(pid: string): HTMLImageElement | null {
    const i = this.indexOfId(pid);
    if (i < 0) return null;
    this.ensureVisible(i);
    return this.thumbOf(i);
  }

  /** Page Y of a photo's tile, or null. */
  yOf(index: number): number | null {
    const t = this.layout?.tiles[index];
    if (!t) return null;
    return this.root.getBoundingClientRect().top + window.scrollY + t.y;
  }

  /** Scroll so that a photo is fully visible, and render it right away. */
  ensureVisible(index: number, smooth = false) {
    const t = this.layout?.tiles[index];
    if (!t) return;
    const gridTop = this.root.getBoundingClientRect().top + window.scrollY;
    const inset = this.o.topInset();
    const viewTop = window.scrollY + inset;
    const viewBottom = window.scrollY + window.innerHeight;
    const top = gridTop + t.y;
    const bottom = top + t.h;
    if (top < viewTop + 8) this.o.scrollTo(Math.max(0, top - inset - 12), smooth);
    else if (bottom > viewBottom - 8) this.o.scrollTo(Math.max(0, bottom - window.innerHeight + 16), smooth);
    this.render();
  }

  /** Move keyboard focus to a photo. */
  focus(index: number) {
    if (!this.items.length) return;
    const i = Math.max(0, Math.min(this.items.length - 1, index));
    this.setCurrent(i);
    this.ensureVisible(i);
    this.tiles.get(this.items[i]!.id)?.querySelector<HTMLElement>('.g-tile__open')?.focus({ preventScroll: true });
  }

  destroy() {
    window.removeEventListener('scroll', this.schedule);
    window.removeEventListener('resize', this.schedule);
    this.ro.disconnect();
    this.root.replaceChildren();
  }

  /* ──────────────────────────── layout ──────────────────────────── */

  private relayout(keepPosition: boolean) {
    const width = Math.round(this.root.clientWidth);
    if (!width) return;
    // Keep the photo at the top of the screen in place when the width changes.
    let anchor: { index: number; offset: number } | null = null;
    if (keepPosition && this.layout) {
      const rect = this.root.getBoundingClientRect();
      const viewTop = -rect.top + this.o.topInset();
      if (viewTop > 0) {
        const row = this.layout.rows.find((r) => r.y + r.h > viewTop);
        if (row) anchor = { index: row.start, offset: row.y - viewTop };
      }
    }
    this.width = width;
    const metrics = metricsFor(width);
    const { gap } = metrics;
    // A handful of photos (e.g. "photos of you") get bigger rows instead of tiny thumbnails.
    const n = this.items.length;
    const boost = n <= 2 ? 2.2 : n <= 4 ? 1.8 : n <= 8 ? 1.4 : 1;
    const targetHeight = Math.round(Math.min(metrics.targetHeight * boost, Math.max(metrics.targetHeight, window.innerHeight * 0.62)));
    const small = width < 600;
    this.layout = justify(this.items, this.headings ? this.sections : [{ key: 'all', count: this.items.length }], {
      width,
      targetHeight,
      gap,
      headingHeight: this.headings ? (small ? 64 : 92) : 0,
      sectionGap: this.headings ? (small ? 28 : 48) : 0,
    });
    this.root.style.blockSize = `${this.layout.height}px`;
    // Existing tiles move to their new spot.
    for (const [pid, el] of this.tiles) {
      const i = this.indexOf.get(pid);
      const t = i === undefined ? undefined : this.layout.tiles[i];
      if (t) this.position(el, t.x, t.y, t.w, t.h, i!);
    }
    if (anchor) {
      const t = this.layout.tiles[anchor.index];
      if (t) {
        const gridTop = this.root.getBoundingClientRect().top + window.scrollY;
        this.o.scrollTo(Math.max(0, gridTop + t.y - this.o.topInset() - anchor.offset), false);
      }
    }
    this.render();
  }

  private schedule = () => {
    if (!this.raf) this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.render();
    });
    clearTimeout(this.settleTimer);
    this.settleTimer = window.setTimeout(this.settle, 180);
  };

  /** After scrolling stops: if the keyboard "current" photo is far away, adopt one on screen. */
  private settle = () => {
    if (!this.layout || this.root.contains(document.activeElement)) return;
    const t = this.layout.tiles[this.current];
    const rect = this.root.getBoundingClientRect();
    const viewTop = -rect.top + this.o.topInset();
    const viewBottom = -rect.top + window.innerHeight;
    if (t && t.y + t.h > viewTop && t.y < viewBottom) return;
    const row = this.layout.rows.find((r) => r.y + r.h > viewTop);
    if (row && row.y < viewBottom) {
      this.setCurrent(row.start);
      this.render();
    }
  };

  /** Create/remove DOM nodes for the rows around the viewport. */
  private render() {
    const L = this.layout;
    if (!L) return;
    const rect = this.root.getBoundingClientRect();
    const vh = window.innerHeight;
    const over = Math.max(600, vh);
    const top = -rect.top - over;
    const bottom = -rect.top + vh + over;
    const wanted = new Set<string>();
    if (rect.bottom > -over && rect.top < vh + over && L.rows.length) {
      // binary search the first row intersecting the window
      let lo = 0;
      let hi = L.rows.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        const r = L.rows[mid]!;
        if (r.y + r.h < top) lo = mid + 1;
        else hi = mid;
      }
      for (let ri = lo; ri < L.rows.length; ri++) {
        const r = L.rows[ri]!;
        if (r.y > bottom) break;
        for (let i = r.start; i < r.end; i++) wanted.add(this.items[i]!.id);
      }
    }
    // The keyboard-current tile always exists so Tab can reach the grid.
    const cur = this.items[this.current];
    if (cur) wanted.add(cur.id);

    for (const [pid, el] of this.tiles) {
      if (!wanted.has(pid) && el !== document.activeElement && !el.contains(document.activeElement)) {
        el.remove();
        this.tiles.delete(pid);
      }
    }
    const frag = document.createDocumentFragment();
    for (const pid of wanted) {
      if (this.tiles.has(pid)) continue;
      const i = this.indexOf.get(pid)!;
      const t = L.tiles[i];
      if (!t) continue;
      const el = this.createTile(this.items[i]!);
      this.position(el, t.x, t.y, t.w, t.h, i);
      this.tiles.set(pid, el);
      frag.append(el);
    }
    // Section headings
    if (this.headings) {
      L.headings.forEach((h, si) => {
        const visible = h.y + h.h > top && h.y < bottom;
        const el = this.heads.get(h.key);
        if (visible && !el) {
          const sec = this.sections.find((s) => s.key === h.key) ?? this.sections[si];
          const head = document.createElement('div');
          head.className = 'g-sec';
          head.style.insetBlockStart = `${h.y}px`;
          head.style.blockSize = `${h.h}px`;
          head.innerHTML = `<h2 class="g-sec__title" dir="auto"></h2><span class="g-sec__count"></span>`;
          head.querySelector('h2')!.textContent = sec?.title ?? '';
          head.querySelector('span')!.textContent = this.o.labels.sectionCount(sec?.count ?? 0);
          this.heads.set(h.key, head);
          frag.append(head);
        } else if (!visible && el) {
          el.remove();
          this.heads.delete(h.key);
        } else if (el) {
          el.style.insetBlockStart = `${h.y}px`;
          el.style.blockSize = `${h.h}px`;
        }
      });
    }
    if (frag.childNodes.length) this.root.append(frag);
  }

  private position(el: HTMLElement, x: number, y: number, w: number, h: number, i: number) {
    const s = el.style;
    s.insetInlineStart = `${x}px`;
    s.insetBlockStart = `${y}px`;
    s.inlineSize = `${w}px`;
    s.blockSize = `${h}px`;
    el.dataset.i = String(i);
    const img = el.querySelector('img');
    if (img) {
      img.alt = this.o.labels.alt(i + 1, this.items.length);
      // Big tiles (rare single-photo rows on large screens) use the sharper web size.
      const p = this.items[i]!;
      const want = media.photo(this.o.gid, p.id, w > 700 ? 'web' : 'thumb');
      if (img.dataset.src !== want && !(img.dataset.src?.endsWith('/web') && want.endsWith('/thumb'))) this.setSrc(el, img, want);
    }
    const btn = el.querySelector<HTMLButtonElement>('.g-tile__fav');
    if (btn) {
      const on = this.o.isFav(this.items[i]!.id);
      btn.setAttribute('aria-label', on ? this.o.labels.favRemove(i + 1) : this.o.labels.favAdd(i + 1));
    }
    const isCurrent = i === this.current;
    el.querySelectorAll<HTMLElement>('.g-tile__open, .g-tile__fav').forEach((f) => (f.tabIndex = isCurrent ? 0 : -1));
  }

  private setSrc(tile: HTMLElement, img: HTMLImageElement, src: string) {
    img.dataset.src = src;
    img.src = src;
    if (img.complete && img.naturalWidth) tile.classList.add('is-loaded');
  }

  private createTile(p: PhotoMeta): HTMLElement {
    const el = document.createElement('div');
    el.className = 'g-tile';
    el.dataset.pid = p.id;
    const fav = this.o.isFav(p.id);
    if (fav) el.classList.add('is-fav');
    if (this.highlight.has(p.id)) el.classList.add('is-new');
    const a = document.createElement('a');
    a.className = 'g-tile__open';
    a.href = media.photo(this.o.gid, p.id, 'web');
    a.dataset.cursor = this.o.labels.view;
    a.tabIndex = -1;
    const img = document.createElement('img');
    img.decoding = 'async';
    img.loading = 'lazy';
    img.draggable = false;
    img.width = p.w;
    img.height = p.h;
    img.addEventListener('load', () => el.classList.add('is-loaded'));
    img.addEventListener('error', () => el.classList.add('is-error'));
    a.append(img);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'g-tile__fav';
    btn.tabIndex = -1;
    btn.setAttribute('aria-pressed', String(fav));
    btn.innerHTML = HEART;
    el.append(a, btn);
    return el;
  }

  /* ─────────────────────────── interaction ─────────────────────────── */

  private indexFromEvent(e: Event): number {
    const tile = (e.target as HTMLElement).closest<HTMLElement>('.g-tile');
    return tile ? Number(tile.dataset.i) : -1;
  }

  private onClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const i = this.indexFromEvent(e);
    if (i < 0) return;
    if (target.closest('.g-tile__fav')) {
      e.preventDefault();
      this.setCurrent(i);
      this.o.onToggleFav(this.items[i]!.id, i);
      return;
    }
    if (target.closest('.g-tile__open')) {
      // Let modified clicks open the photo in a new tab.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      this.setCurrent(i);
      this.o.onOpen(i);
    }
  };

  private onFocusIn = (e: FocusEvent) => {
    const i = this.indexFromEvent(e);
    if (i >= 0 && i !== this.current) this.setCurrent(i);
  };

  private setCurrent(i: number) {
    const prev = this.items[this.current];
    this.current = i;
    if (prev) {
      this.tiles.get(prev.id)?.querySelectorAll<HTMLElement>('.g-tile__open, .g-tile__fav').forEach((f) => (f.tabIndex = -1));
    }
    const next = this.items[i];
    if (next) {
      this.tiles.get(next.id)?.querySelectorAll<HTMLElement>('.g-tile__open, .g-tile__fav').forEach((f) => (f.tabIndex = 0));
    }
  }

  private onKey = (e: KeyboardEvent) => {
    if (!this.layout || e.altKey || e.ctrlKey || e.metaKey) return;
    const i = this.indexFromEvent(e);
    if (i < 0) return;
    const onFav = !!(e.target as HTMLElement).closest('.g-tile__fav');
    const fwd = this.o.rtl ? 'ArrowLeft' : 'ArrowRight';
    const back = this.o.rtl ? 'ArrowRight' : 'ArrowLeft';
    let next = -1;
    switch (e.key) {
      case fwd:
        next = i + 1;
        break;
      case back:
        next = i - 1;
        break;
      case 'ArrowDown':
        next = this.vertical(i, 1);
        break;
      case 'ArrowUp':
        next = this.vertical(i, -1);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = this.items.length - 1;
        break;
      case 'PageDown':
        next = this.byDistance(i, window.innerHeight * 0.8);
        break;
      case 'PageUp':
        next = this.byDistance(i, -window.innerHeight * 0.8);
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        this.o.onToggleFav(this.items[i]!.id, i);
        return;
      case ' ':
        if (!onFav) {
          e.preventDefault();
          this.o.onOpen(i);
        }
        return;
      default:
        return;
    }
    e.preventDefault();
    if (next >= 0 && next < this.items.length && next !== i) this.focus(next);
  };

  /** Photo in the row above/below whose centre is closest horizontally. */
  private vertical(i: number, dir: 1 | -1): number {
    const L = this.layout!;
    const ri = L.rows.findIndex((r) => i >= r.start && i < r.end);
    const target = L.rows[ri + dir];
    if (!target) return dir > 0 ? this.items.length - 1 : 0;
    const t = L.tiles[i]!;
    const cx = t.x + t.w / 2;
    let best = target.start;
    let bestD = Infinity;
    for (let k = target.start; k < target.end; k++) {
      const c = L.tiles[k]!;
      const d = Math.abs(c.x + c.w / 2 - cx);
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    }
    return best;
  }

  private byDistance(i: number, dy: number): number {
    const L = this.layout!;
    const t = L.tiles[i]!;
    const y = t.y + dy;
    const row = dy > 0 ? L.rows.find((r) => r.y >= y) ?? L.rows[L.rows.length - 1]! : [...L.rows].reverse().find((r) => r.y <= y) ?? L.rows[0]!;
    return row.start;
  }
}
