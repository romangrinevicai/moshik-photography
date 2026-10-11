/**
 * PhotoSwipe lightbox for the client gallery: favourite / download / share
 * buttons, a slideshow mode with progress bar, and true right-to-left
 * navigation on Hebrew pages (the slide order is mirrored so that "next"
 * comes from the left, matching the grid's reading direction).
 */
import type PhotoSwipe from 'photoswipe';
import type { PhotoMeta } from '~/shared/gallery-types';
import { iconSvg } from '~/shared/icons';
import { lockScroll, motionOff } from '~/scripts/core';
import { media } from './api';
import { fmtNum, t } from './format';

export interface LightboxOptions {
  gid: string;
  items: PhotoMeta[];
  index: number;
  rtl: boolean;
  allowDownload: boolean;
  allowOriginals: boolean;
  slideshow?: boolean;
  caption?: (p: PhotoMeta) => string;
  isFav: (pid: string) => boolean;
  toggleFav: (pid: string) => void;
  favEvents: EventTarget;
  thumbOf: (index: number) => HTMLImageElement | null;
  /** Called just before the closing animation, so the grid can bring the photo into view. */
  beforeClose?: (index: number) => void;
  onChange?: (index: number) => void;
  onClose?: (index: number) => void;
  onShare: (p: PhotoMeta, button: HTMLElement) => void;
}

const SLIDE_MS = 5000;
const svg = (name: Parameters<typeof iconSvg>[0], size = 22, cls = '') => iconSvg(name, { size, stroke: 1.5, className: `g-lb-ic ${cls}`.trim() });
const ZOOM_SVG = `<svg class="icon g-lb-ic g-lb-ic--zoom" aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="11" cy="11" r="7.5"/><path d="m20.5 20.5-4-4"/><path class="g-lb-ic__v" d="M11 8v6"/><path d="M8 11h6"/></svg>`;

let active: PhotoSwipe | null = null;
export const lightboxOpen = () => !!active;

export async function openLightbox(o: LightboxOptions): Promise<void> {
  if (active || !o.items.length) return;
  const { default: PhotoSwipeLightbox } = await import('photoswipe/lightbox');
  const n = o.items.length;
  const flip = o.rtl;
  // user index <-> PhotoSwipe index (mirrored on RTL pages)
  const ps = (i: number) => (flip ? n - 1 - i : i);
  const order = flip ? [...o.items].reverse() : o.items;
  const quiet = motionOff();
  const data = order.map((p, k) => {
    const userIndex = flip ? n - 1 - k : k;
    return {
      src: media.photo(o.gid, p.id, 'web'),
      msrc: media.photo(o.gid, p.id, 'thumb'),
      width: p.w > 0 ? p.w : 1500,
      height: p.h > 0 ? p.h : 1000,
      alt: t('photoAlt', { n: userIndex + 1, total: n }),
      pid: p.id,
    };
  });

  const lightbox = new PhotoSwipeLightbox({
    dataSource: data,
    pswpModule: () => import('photoswipe'),
    index: ps(o.index),
    bgOpacity: o.slideshow ? 1 : 0.97,
    showHideAnimationType: quiet ? 'none' : 'zoom',
    showAnimationDuration: quiet ? 0 : 380,
    hideAnimationDuration: quiet ? 0 : 340,
    zoomAnimationDuration: quiet ? 0 : 320,
    imageClickAction: 'zoom',
    tapAction: 'toggle-controls',
    wheelToZoom: false,
    returnFocus: false,
    preload: [1, 2],
    padding: o.slideshow ? { top: 0, bottom: 0, left: 0, right: 0 } : { top: 64, bottom: 56, left: 12, right: 12 },
    counter: false,
    closeTitle: t('lbClose'),
    zoomTitle: t('lbZoom'),
    arrowPrevTitle: flip ? t('lbNext') : t('lbPrev'),
    arrowNextTitle: flip ? t('lbPrev') : t('lbNext'),
    errorMsg: t('lbError'),
    closeSVG: svg('x', 24),
    zoomSVG: ZOOM_SVG,
    arrowPrevSVG: svg('chevron-left', 30),
    arrowNextSVG: svg('chevron-right', 30),
    mainClass: `pswp--brand pswp--gallery${o.slideshow ? ' pswp--slideshow' : ''}`,
  });

  const current = () => {
    const i = lightbox.pswp?.currIndex ?? ps(o.index);
    return ps(i);
  };
  const photoAt = (userIndex: number) => o.items[userIndex]!;

  // The grid's thumbnail drives the zoom-in / zoom-out animation.
  lightbox.addFilter('thumbEl', (el, _d, index) => (o.thumbOf(ps(index)) ?? el) as HTMLElement);

  let playing = false;
  let timer = 0;
  let progressEl: HTMLElement | null = null;
  let playBtn: HTMLElement | null = null;
  const cleanups: (() => void)[] = [];

  const restartProgress = () => {
    if (!progressEl) return;
    progressEl.classList.remove('is-running');
    void progressEl.offsetWidth;
    if (playing) progressEl.classList.add('is-running');
  };
  const advance = () => {
    const p = lightbox.pswp;
    if (!p) return;
    if (flip) p.prev();
    else p.next();
  };
  const schedule = () => {
    clearTimeout(timer);
    if (playing) timer = window.setTimeout(advance, SLIDE_MS);
    restartProgress();
  };
  const setPlaying = (on: boolean) => {
    playing = on;
    lightbox.pswp?.element?.classList.toggle('is-playing', on);
    if (!on) lightbox.pswp?.element?.classList.add('pswp--ui-visible');
    if (playBtn) {
      playBtn.innerHTML = on ? svg('pause', 20) : svg('play', 20);
      const label = on ? t('lbPause') : t('lbPlay');
      playBtn.setAttribute('aria-label', label);
      playBtn.title = label;
      playBtn.setAttribute('aria-pressed', String(on));
    }
    schedule();
  };

  lightbox.on('uiRegister', () => {
    const pswp = lightbox.pswp!;
    const ui = pswp.ui!;

    ui.registerElement({
      name: 'g-counter',
      order: 5,
      isButton: false,
      appendTo: 'bar',
      onInit: (el, p) => {
        el.className = 'pswp__counter g-lb-counter';
        el.setAttribute('aria-live', 'polite');
        const update = () => (el.textContent = `${fmtNum(ps(p.currIndex) + 1)} / ${fmtNum(n)}`);
        p.on('change', update);
        update();
      },
    });

    ui.registerElement({
      name: 'g-play',
      order: 8,
      isButton: true,
      html: svg('play', 20),
      title: t('lbPlay'),
      ariaLabel: t('lbPlay'),
      className: 'g-lb-btn',
      onInit: (el) => {
        playBtn = el;
        el.setAttribute('aria-pressed', 'false');
      },
      onClick: () => setPlaying(!playing),
    });

    ui.registerElement({
      name: 'g-fav',
      order: 9,
      isButton: true,
      html: svg('heart', 22),
      title: t('lbFav'),
      ariaLabel: t('lbFav'),
      className: 'g-lb-btn g-lb-fav',
      onInit: (el, p) => {
        const sync = () => {
          const pid = photoAt(ps(p.currIndex)).id;
          const on = o.isFav(pid);
          el.classList.toggle('is-on', on);
          el.setAttribute('aria-pressed', String(on));
          const label = on ? t('lbUnfav') : t('lbFav');
          el.setAttribute('aria-label', label);
          el.title = label;
        };
        p.on('change', sync);
        o.favEvents.addEventListener('change', sync);
        cleanups.push(() => o.favEvents.removeEventListener('change', sync));
        sync();
      },
      onClick: (_e, el, p) => {
        o.toggleFav(photoAt(ps(p.currIndex)).id);
        el.classList.remove('is-pop');
        void el.offsetWidth;
        el.classList.add('is-pop');
      },
    });

    ui.registerElement({
      name: 'g-share',
      order: 9.2,
      isButton: true,
      html: svg('share2', 21),
      title: t('lbShare'),
      ariaLabel: t('lbShare'),
      className: 'g-lb-btn',
      onClick: (_e, el, p) => o.onShare(photoAt(ps(p.currIndex)), el),
    });

    if (o.allowDownload) {
      ui.registerElement({
        name: 'g-download',
        order: 9.4,
        isButton: true,
        tagName: 'a',
        html: svg('download', 21),
        title: t('lbDownload'),
        ariaLabel: t('lbDownload'),
        className: 'g-lb-btn',
        onInit: (el, p) => {
          const a = el as HTMLAnchorElement;
          a.setAttribute('download', '');
          a.removeAttribute('type');
          const update = () => {
            const pid = photoAt(ps(p.currIndex)).id;
            a.href = media.photo(o.gid, pid, o.allowOriginals ? 'original' : 'web', true);
          };
          p.on('change', update);
          update();
        },
      });
    }

    ui.registerElement({
      name: 'g-caption',
      order: 30,
      isButton: false,
      appendTo: 'root',
      onInit: (el, p) => {
        el.className = 'pswp__caption g-lb-caption';
        const update = () => (el.textContent = o.caption?.(photoAt(ps(p.currIndex))) ?? '');
        p.on('change', update);
        update();
      },
    });

    ui.registerElement({
      name: 'g-progress',
      order: 31,
      isButton: false,
      appendTo: 'root',
      onInit: (el) => {
        el.className = 'g-lb-progress';
        el.style.setProperty('--slide-ms', `${SLIDE_MS}ms`);
        el.innerHTML = '<span></span>';
        progressEl = el;
      },
    });
  });

  lightbox.on('change', () => {
    o.onChange?.(current());
    if (playing) schedule();
  });
  lightbox.on('close', () => {
    clearTimeout(timer);
    o.beforeClose?.(current());
  });
  lightbox.on('beforeOpen', () => {
    active = lightbox.pswp ?? null;
    lockScroll(true);
  });
  lightbox.on('afterInit', () => {
    if (!o.slideshow) return;
    // Reduced motion: the slideshow opens paused (no auto-advance).
    setPlaying(!motionOff());
    // Cinematic: controls fade away while playing, back on any movement.
    const el = lightbox.pswp?.element;
    if (!el) return;
    let idle = 0;
    const wake = () => {
      el.classList.add('pswp--ui-visible');
      clearTimeout(idle);
      idle = window.setTimeout(() => playing && el.classList.remove('pswp--ui-visible'), 2600);
    };
    el.addEventListener('pointermove', wake);
    el.addEventListener('keydown', wake);
    cleanups.push(() => clearTimeout(idle));
    wake();
  });
  lightbox.on('destroy', () => {
    const last = current();
    clearTimeout(timer);
    cleanups.forEach((fn) => fn());
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('visibilitychange', onVisibility);
    active = null;
    lockScroll(false);
    o.onClose?.(last);
    // Release the lightbox's listeners once PhotoSwipe has finished tearing down
    // (calling it synchronously here would re-enter PhotoSwipe's destroy).
    window.setTimeout(() => lightbox.destroy(), 0);
  });

  // PhotoSwipe ignores close() during its opening animation; remember an early Esc.
  let closeAfterOpen = false;
  lightbox.on('openingAnimationEnd', () => {
    // Deferred: PhotoSwipe binds its own key/focus handlers in a later listener
    // of this same event, and close() must run after that to unbind them.
    if (closeAfterOpen) window.setTimeout(() => lightbox.pswp?.close(), 0);
  });

  // Space toggles the slideshow, F favourites the photo.
  const onKey = (e: KeyboardEvent) => {
    if (!lightbox.pswp || e.altKey || e.ctrlKey || e.metaKey) return;
    if ((e.target as HTMLElement)?.closest?.('input, textarea')) return;
    if (e.key === 'Escape' && lightbox.pswp.opener?.isOpening) {
      closeAfterOpen = true;
      return;
    }
    if (e.key === ' ' || e.key === 'Spacebar') {
      if ((e.target as HTMLElement)?.closest?.('button, a')) return;
      e.preventDefault();
      setPlaying(!playing);
    } else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      o.toggleFav(photoAt(current()).id);
    }
  };
  const onVisibility = () => {
    if (document.hidden) clearTimeout(timer);
    else if (playing) schedule();
  };
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('visibilitychange', onVisibility);

  lightbox.init();
  lightbox.loadAndOpen(ps(o.index));
}
