/**
 * Accessibility menu: text size, high contrast, highlighted links, readable
 * font, stop animations, grayscale. Preferences persist per browser.
 * (Applied before first paint by the inline script in BaseLayout.)
 */
const KEY = 'moshik-a11y';
const OPTIONS = ['contrast', 'links', 'font', 'motion', 'gray'] as const;
type Option = (typeof OPTIONS)[number];
interface Prefs {
  scale: number;
  on: Option[];
}

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Prefs>;
      return { scale: Number(p.scale) || 1, on: Array.isArray(p.on) ? p.on.filter((o): o is Option => OPTIONS.includes(o as Option)) : [] };
    }
  } catch {
    /* storage unavailable */
  }
  return { scale: 1, on: [] };
}

function save(p: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

function apply(p: Prefs) {
  const html = document.documentElement;
  html.style.setProperty('--a11y-scale', String(p.scale));
  for (const o of OPTIONS) html.classList.toggle(`a11y-${o}`, p.on.includes(o));
  window.dispatchEvent(new CustomEvent('a11y:change', { detail: p }));
}

export function initA11yMenu() {
  const root = document.querySelector<HTMLElement>('[data-a11y]');
  if (!root) return;
  const toggle = root.querySelector<HTMLButtonElement>('[data-a11y-toggle]')!;
  const panel = root.querySelector<HTMLElement>('[data-a11y-panel]')!;
  const sizeOut = root.querySelector<HTMLOutputElement>('[data-a11y-size-value]')!;
  let prefs = load();

  const render = () => {
    sizeOut.value = `${Math.round(prefs.scale * 100)}%`;
    root.querySelectorAll<HTMLButtonElement>('[data-a11y-opt]').forEach((b) => {
      b.setAttribute('aria-pressed', String(prefs.on.includes(b.dataset.a11yOpt as Option)));
    });
  };

  const open = (state: boolean) => {
    panel.hidden = !state;
    toggle.setAttribute('aria-expanded', String(state));
    if (state) panel.querySelector<HTMLElement>('button')?.focus();
  };

  toggle.addEventListener('click', () => open(panel.hidden));
  root.querySelector('[data-a11y-close]')?.addEventListener('click', () => {
    open(false);
    toggle.focus();
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) {
      open(false);
      toggle.focus();
    }
  });
  document.addEventListener('click', (e) => {
    if (!panel.hidden && !root.contains(e.target as Node)) open(false);
  });

  root.querySelectorAll<HTMLButtonElement>('[data-a11y-size]').forEach((b) =>
    b.addEventListener('click', () => {
      const step = Number(b.dataset.a11ySize);
      prefs.scale = Math.min(1.5, Math.max(0.9, Math.round((prefs.scale + step * 0.1) * 10) / 10));
      apply(prefs);
      save(prefs);
      render();
    }),
  );
  root.querySelectorAll<HTMLButtonElement>('[data-a11y-opt]').forEach((b) =>
    b.addEventListener('click', () => {
      const o = b.dataset.a11yOpt as Option;
      prefs.on = prefs.on.includes(o) ? prefs.on.filter((x) => x !== o) : [...prefs.on, o];
      apply(prefs);
      save(prefs);
      render();
    }),
  );
  root.querySelector('[data-a11y-reset]')?.addEventListener('click', () => {
    prefs = { scale: 1, on: [] };
    apply(prefs);
    save(prefs);
    render();
  });

  render();
}
