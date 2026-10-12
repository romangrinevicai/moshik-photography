/**
 * Site-wide interactions: smooth scrolling, header behaviour, menus,
 * scroll reveals, counters, parallax, custom cursor, WhatsApp availability
 * and analytics hooks. Everything degrades gracefully without JS and
 * respects reduced-motion preferences.
 */

const html = document.documentElement;
const reducedMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
export const motionOff = () => reducedMotionQuery.matches || html.classList.contains('a11y-motion');


/** App-like pages (client gallery, admin) keep the native cursor. */
const isAppPage = () => document.body.hasAttribute('data-app-page');

export function lockScroll(locked: boolean) {
  document.body.style.overflow = locked ? 'hidden' : '';
}

export function scrollToTarget(target: number | HTMLElement) {
  const top = typeof target === 'number' ? target : target.getBoundingClientRect().top + window.scrollY - 90;
  window.scrollTo({ top, behavior: motionOff() ? 'auto' : 'smooth' });
}

/* ───────────────────────────── header ──────────────────────────────── */
function initHeader() {
  const header = document.querySelector<HTMLElement>('[data-header]');
  if (!header) return;
  let lastY = window.scrollY;
  let ticking = false;
  const update = () => {
    const y = window.scrollY;
    header.toggleAttribute('data-scrolled', y > 30);
    const delta = y - lastY;
    if (y > 420 && delta > 6 && !html.classList.contains('menu-open') && !header.matches(':focus-within, :hover')) {
      header.setAttribute('data-hidden', '');
    } else if (delta < -6 || y < 420) {
      header.removeAttribute('data-hidden');
    }
    lastY = y;
    ticking = false;
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();
}

/* ─────────────────────────── mega menu ─────────────────────────────── */
function initMegaMenu() {
  document.querySelectorAll<HTMLElement>('[data-mega]').forEach((item) => {
    const toggle = item.querySelector<HTMLButtonElement>('[data-mega-toggle]');
    const imgs = item.querySelectorAll<HTMLElement>('[data-mega-img]');
    let closeTimer = 0;
    const set = (open: boolean) => {
      item.classList.toggle('is-open', open);
      toggle?.setAttribute('aria-expanded', String(open));
    };
    if (finePointer.matches) {
      item.addEventListener('mouseenter', () => {
        clearTimeout(closeTimer);
        set(true);
      });
      item.addEventListener('mouseleave', () => {
        closeTimer = window.setTimeout(() => set(false), 180);
      });
    }
    toggle?.addEventListener('click', () => set(!item.classList.contains('is-open')));
    item.addEventListener('focusout', (e) => {
      if (!item.contains(e.relatedTarget as Node)) set(false);
    });
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        set(false);
        toggle?.focus();
      }
    });
    item.querySelectorAll<HTMLElement>('[data-mega-index]').forEach((link) => {
      const show = () => imgs.forEach((im) => im.classList.toggle('is-active', im.dataset.megaImg === link.dataset.megaIndex));
      link.addEventListener('mouseenter', show);
      link.addEventListener('focus', show);
    });
  });
}

/* ────────────────────────── mobile menu ────────────────────────────── */
function initMobileMenu() {
  const btn = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const menu = document.querySelector<HTMLElement>('[data-mobile-menu]');
  if (!btn || !menu) return;
  const focusables = () =>
    [btn, ...menu.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')].filter((el) => el.offsetParent !== null || el === btn);

  const set = (open: boolean) => {
    html.classList.toggle('menu-open', open);
    btn.setAttribute('aria-expanded', String(open));
    if (open) menu.hidden = false;
    lockScroll(open);
    if (open) setTimeout(() => menu.querySelector<HTMLElement>('a')?.focus({ preventScroll: true }), 350);
    else setTimeout(() => !html.classList.contains('menu-open') && (menu.hidden = true), 800);
  };
  btn.addEventListener('click', () => set(!html.classList.contains('menu-open')));
  menu.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a')) set(false);
  });
  document.addEventListener('keydown', (e) => {
    if (!html.classList.contains('menu-open')) return;
    if (e.key === 'Escape') {
      set(false);
      btn.focus();
    }
    if (e.key === 'Tab') {
      const list = focusables();
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  });
  matchMedia('(min-width: 1121px)').addEventListener('change', (e) => e.matches && set(false));
}

/* ─────────────────────────── reveals ───────────────────────────────── */
function initReveals() {
  const items = document.querySelectorAll<HTMLElement>('[data-reveal], [data-split]');
  if (!('IntersectionObserver' in window) || motionOff()) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -6% 0px', threshold: 0.08 },
  );
  items.forEach((el) => io.observe(el));
  // Safety net: never leave content hidden (e.g. when printing).
  window.addEventListener('beforeprint', () => items.forEach((el) => el.classList.add('is-in')));
}

/* ─────────────────────────── counters ──────────────────────────────── */
function initCounters() {
  const els = document.querySelectorAll<HTMLElement>('[data-countup]');
  if (!els.length) return;
  const locale = html.lang === 'he' ? 'he-IL' : 'en-US';
  const run = (el: HTMLElement) => {
    const target = Number(el.dataset.countup);
    const decimals = (el.dataset.countup?.split('.')[1] ?? '').length;
    const fmt = new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    if (motionOff()) {
      el.textContent = fmt.format(target);
      return;
    }
    const start = performance.now();
    const dur = 1800;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 4);
      el.textContent = fmt.format(target * eased);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          run(e.target as HTMLElement);
          io.unobserve(e.target);
        }
      }),
    { threshold: 0.6 },
  );
  els.forEach((el) => io.observe(el));
}

/* ─────────────────────────── parallax ──────────────────────────────── */
function initParallax() {
  const els = [...document.querySelectorAll<HTMLElement>('[data-parallax]')];
  if (!els.length) return;
  const visible = new Set<HTMLElement>();
  const io = new IntersectionObserver((entries) =>
    entries.forEach((e) => (e.isIntersecting ? visible.add(e.target as HTMLElement) : visible.delete(e.target as HTMLElement))),
  );
  els.forEach((el) => io.observe(el));
  let ticking = false;
  const update = () => {
    ticking = false;
    if (motionOff()) {
      els.forEach((el) => (el.style.transform = ''));
      return;
    }
    const vh = window.innerHeight;
    visible.forEach((el) => {
      const speed = Number(el.dataset.parallax) || 0.1;
      const rect = el.parentElement!.getBoundingClientRect();
      const offset = (rect.top + rect.height / 2 - vh / 2) * -speed;
      el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
    });
  };
  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
}

/* ─────────────────────────── section snap ──────────────────────────── */
/**
 * Home page, desktop: when scrolling stops with two sections on screen, settle on one —
 * the next one once a fifth of it is showing in the direction of travel, otherwise
 * back. A section that fills the screen is left alone, so tall sections read freely.
 */
function initSectionSnap() {
  if (!html.classList.contains('snap-sections')) return;
  const sections = [...document.querySelectorAll<HTMLElement>('main > section, .site-footer')];
  if (sections.length < 2) return;
  const wide = matchMedia('(min-width: 761px) and (min-height: 600px)');
  let lastY = window.scrollY;
  let dir = 0;
  let keyAt = 0;
  let timer = 0;
  // Safari before 26 has no scrollend event: settle after scroll events go quiet instead.
  const hasScrollEnd = 'onscrollend' in window;
  window.addEventListener('keydown', () => (keyAt = performance.now()), { passive: true });

  const settle = () => {
    if (!wide.matches || motionOff() || performance.now() - keyAt < 800) return;
    const vh = window.innerHeight;
    const y = window.scrollY;
    // The section at the top of the screen (a gap such as the marquee counts as part of it).
    let i = -1;
    sections.forEach((s, n) => s.getBoundingClientRect().top <= 1 && (i = n));
    const cur = sections[i];
    const next = sections[i + 1];
    if (!cur || !next) return;
    const top = cur.getBoundingClientRect().top;
    const edge = next.getBoundingClientRect().top;
    if (edge >= vh - 1) return;
    const toNext = y + edge;
    const toCur = edge - top > vh ? y + edge - vh : y + top;
    const target = (dir > 0 ? vh - edge >= vh * 0.2 : edge < vh * 0.2) ? toNext : toCur;
    if (Math.abs(target - y) > 1) window.scrollTo({ top: target, behavior: 'smooth' });
  };

  window.addEventListener(
    'scroll',
    () => {
      const y = window.scrollY;
      if (y !== lastY) dir = y > lastY ? 1 : -1;
      lastY = y;
      if (!hasScrollEnd) {
        clearTimeout(timer);
        timer = window.setTimeout(settle, 180);
      }
    },
    { passive: true },
  );
  window.addEventListener('scrollend', settle);
}

/* ───────────────────────── magnetic buttons ────────────────────────── */
function initMagnetic() {
  if (!finePointer.matches) return;
  document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      if (motionOff()) return;
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - r.left - r.width / 2) / r.width;
      const dy = (e.clientY - r.top - r.height / 2) / r.height;
      el.style.transform = `translate(${dx * 10}px, ${dy * 8}px)`;
    });
    el.addEventListener('pointerleave', () => (el.style.transform = ''));
  });
}

/* ──────────────────── WhatsApp "available now" ─────────────────────── */
function initAvailability() {
  const el = document.querySelector<HTMLElement>('[data-wa-hours]');
  if (!el) return;
  try {
    const { tz, schedule } = JSON.parse(el.dataset.waHours!) as { tz: string; schedule: Record<string, [string, string]> };
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.find((p) => p.type === 'weekday')!.value);
    const hm = `${parts.find((p) => p.type === 'hour')!.value}:${parts.find((p) => p.type === 'minute')!.value}`;
    const today = schedule[String(wd)];
    const online = !!today && hm >= today[0] && hm < today[1];
    el.querySelector('[data-wa-dot]')?.toggleAttribute('data-online', online);
    const text = el.querySelector('[data-wa-text]');
    if (text) text.textContent = online ? el.dataset.onlineText! : el.dataset.offlineText!;
    document.querySelectorAll('[data-wa-status]').forEach((s) => s.toggleAttribute('data-online', online));
  } catch {
    /* ignore */
  }
}

/* ───────────────────────── mobile action bar ───────────────────────── */
function initActionBar() {
  const bars = [...document.querySelectorAll<HTMLElement>('[data-action-bar], [data-wa-float]')];
  if (!bars.length) return;
  const footer = document.querySelector('.site-footer');
  let nearFooter = false;
  if (footer) {
    new IntersectionObserver(([e]) => {
      nearFooter = !!e?.isIntersecting;
      update();
    }).observe(footer);
  }
  const update = () => {
    const show = window.scrollY > window.innerHeight * 0.6 && !nearFooter;
    bars.forEach((bar) => bar.toggleAttribute('data-visible', show));
  };
  window.addEventListener('scroll', update, { passive: true });
  update();
}

/* ───────────────────────── analytics hooks ─────────────────────────── */
type Tracker = (...args: unknown[]) => void;
export function track(event: string, params: Record<string, unknown> = {}) {
  const w = window as unknown as { gtag?: Tracker; fbq?: Tracker; dataLayer?: unknown[] };
  w.gtag?.('event', event, params);
  w.fbq?.('trackCustom', event, params);
  if (event === 'generate_lead' || event === 'whatsapp_click') w.fbq?.('track', 'Contact');
}
function initTracking() {
  document.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-track]');
    if (el) track(el.dataset.track!, { location: el.closest('[data-section]')?.getAttribute('data-section') ?? location.pathname });
  });
}

/* ──────────────────────────── misc ─────────────────────────────────── */
function initScrollTop() {
  document.querySelectorAll('[data-scroll-top]').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToTarget(0);
      document.querySelector<HTMLElement>('#main')?.focus({ preventScroll: true });
    }),
  );
}

function init() {
  initHeader();
  initMegaMenu();
  initMobileMenu();
  initReveals();
  initCounters();
  initParallax();
  initSectionSnap();
  initMagnetic();
  initAvailability();
  initActionBar();
  initTracking();
  initScrollTop();
}

init();
