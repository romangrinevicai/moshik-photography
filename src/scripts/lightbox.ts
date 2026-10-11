/**
 * PhotoSwipe lightbox for every [data-lightbox] container on the page.
 * Children: <a href="large.webp" data-pswp-width data-pswp-height data-pswp-srcset>
 */
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import 'photoswipe/style.css';
import { lockScroll } from './core';

const isHe = document.documentElement.lang === 'he';
const L = isHe
  ? { close: 'סגירה', zoom: 'הגדלה', prev: 'התמונה הקודמת', next: 'התמונה הבאה', error: 'לא הצלחנו לטעון את התמונה', of: ' / ' }
  : { close: 'Close', zoom: 'Zoom', prev: 'Previous photo', next: 'Next photo', error: 'The photo could not be loaded', of: ' / ' };

export function initLightboxes(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-lightbox]').forEach((gallery) => {
    if (gallery.dataset.lightboxReady) return;
    gallery.dataset.lightboxReady = '1';
    const lightbox = new PhotoSwipeLightbox({
      gallery,
      children: 'a[data-pswp-width]',
      pswpModule: () => import('photoswipe'),
      bgOpacity: 0.97,
      showHideAnimationType: 'zoom',
      imageClickAction: 'zoom',
      tapAction: 'toggle-controls',
      wheelToZoom: false,
      padding: { top: 40, bottom: 70, left: 20, right: 20 },
      closeTitle: L.close,
      zoomTitle: L.zoom,
      arrowPrevTitle: L.prev,
      arrowNextTitle: L.next,
      errorMsg: L.error,
      indexIndicatorSep: L.of,
      mainClass: 'pswp--brand',
    });

    lightbox.on('uiRegister', () => {
      lightbox.pswp?.ui?.registerElement({
        name: 'caption',
        order: 9,
        isButton: false,
        appendTo: 'root',
        onInit: (el, pswp) => {
          el.className = 'pswp__caption';
          pswp.on('change', () => {
            const slideEl = pswp.currSlide?.data.element as HTMLElement | undefined;
            el.textContent = slideEl?.dataset.caption ?? '';
          });
        },
      });
    });
    lightbox.on('beforeOpen', () => lockScroll(true));
    lightbox.on('destroy', () => lockScroll(false));
    lightbox.init();
  });
}

initLightboxes();
