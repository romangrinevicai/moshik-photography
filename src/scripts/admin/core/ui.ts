/** Shared UI pieces: toasts, dialogs, confirmations, clipboard, downloads. */
import { h, icon, nextId } from './dom';
import { C, T } from './i18n';
import type { IconName } from '~/shared/icons';

/* ───────────────────────────── toasts ───────────────────────────── */
type ToastType = 'success' | 'error' | 'info';
interface ToastOptions {
  type?: ToastType;
  duration?: number;
  action?: { label: string; run: () => void };
}

/** Toasts live inside the top-most open modal (the rest of the page is inert behind it). */
function toastRegion(): HTMLElement | null {
  const open = [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')];
  const top = open[open.length - 1];
  if (!top) return document.querySelector<HTMLElement>('[data-toasts]');
  let region = top.querySelector<HTMLElement>(':scope > .adm-toasts');
  if (!region) {
    region = h('div', { class: 'adm-toasts adm-toasts--dialog', 'aria-live': 'polite' });
    top.append(region);
  }
  return region;
}

export function toast(message: string, opts: ToastOptions = {}) {
  const region = toastRegion();
  if (!region) return () => {};
  const type = opts.type ?? 'success';
  const glyph: IconName = type === 'error' ? 'circle-alert' : type === 'info' ? 'info' : 'check';
  let timer = 0;
  const dismiss = () => {
    window.clearTimeout(timer);
    el.classList.remove('is-in');
    window.setTimeout(() => el.remove(), 260);
  };
  const el = h(
    'div',
    { class: `adm-toast adm-toast--${type}`, role: type === 'error' ? 'alert' : undefined },
    h('span', { class: 'adm-toast__icon' }, icon(glyph, 18)),
    h('p', { class: 'adm-toast__msg' }, message),
    opts.action &&
      h(
        'button',
        {
          type: 'button',
          class: 'adm-toast__action',
          onclick: () => {
            opts.action?.run();
            dismiss();
          },
        },
        opts.action.label,
      ),
    h('button', { type: 'button', class: 'adm-toast__close', 'aria-label': T(C.close), onclick: dismiss }, icon('x', 16)),
  );
  // Newest on top; keep the stack short so it never becomes noise.
  region.prepend(el);
  while (region.children.length > 3) region.lastElementChild?.remove();
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-in')));
  const duration = opts.duration ?? (type === 'error' ? 6500 : type === 'info' ? 4500 : 3200);
  const arm = () => (timer = window.setTimeout(dismiss, duration));
  el.addEventListener('pointerenter', () => window.clearTimeout(timer));
  el.addEventListener('pointerleave', arm);
  arm();
  return dismiss;
}

export const toastError = (message: string) => toast(message, { type: 'error' });

/* ───────────────────────────── dialogs ──────────────────────────── */

/** Opens a native modal <dialog> (focus trap + Esc for free) and closes on backdrop click. */
export function openDialog(dlg: HTMLDialogElement, focus?: HTMLElement | null) {
  if (!dlg.dataset.wired) {
    dlg.dataset.wired = '1';
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg && !dlg.hasAttribute('data-sticky')) dlg.close('backdrop');
    });
    dlg.addEventListener('close', () => {
      if (!document.querySelector('dialog[open]')) document.documentElement.classList.remove('adm-modal-open');
    });
  }
  if (!dlg.open) dlg.showModal();
  document.documentElement.classList.add('adm-modal-open');
  if (focus) requestAnimationFrame(() => focus.focus());
}

interface ConfirmOptions {
  title: string;
  message?: string;
  confirm: string;
  cancel?: string;
  danger?: boolean;
  /** The user must type this exact text to enable the confirm button. */
  typeToConfirm?: string;
  typeLabel?: string;
}

export function confirmDialog(o: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const titleId = nextId('confirm');
    let result = false;
    const input = o.typeToConfirm
      ? h('input', { class: 'input', type: 'text', autocomplete: 'off', spellcheck: 'false', 'aria-describedby': `${titleId}-hint` })
      : null;
    const ok = h(
      'button',
      { type: 'submit', class: `btn btn--sm ${o.danger ? 'adm-btn-danger' : 'btn--solid'}`, disabled: !!o.typeToConfirm },
      o.danger ? icon('trash2', 16) : null,
      o.confirm,
    );
    const cancel = h('button', { type: 'button', class: 'btn btn--sm', onclick: () => dlg.close() }, o.cancel ?? T(C.cancel));
    const form = h(
      'form',
      { class: 'adm-dialog__box adm-confirm', method: 'dialog' },
      h('div', { class: `adm-confirm__icon${o.danger ? ' is-danger' : ''}` }, icon(o.danger ? 'circle-alert' : 'info', 22)),
      h('h2', { class: 'adm-dialog__title', id: titleId }, o.title),
      o.message ? h('p', { class: 'adm-confirm__text' }, o.message) : null,
      input
        ? h(
            'label',
            { class: 'field adm-confirm__type' },
            h('span', { class: 'field__label', id: `${titleId}-hint` }, o.typeLabel ?? ''),
            h('span', { class: 'adm-confirm__expect', dir: 'auto' }, o.typeToConfirm),
            input,
          )
        : null,
      h('div', { class: 'adm-dialog__actions' }, cancel, ok),
    );
    const dlg = h('dialog', { class: 'adm-dialog adm-dialog--sm', 'aria-labelledby': titleId }, form);
    input?.addEventListener('input', () => {
      ok.disabled = input.value.trim().toLowerCase() !== (o.typeToConfirm ?? '').trim().toLowerCase();
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (ok.disabled) return;
      result = true;
      dlg.close();
    });
    dlg.addEventListener('close', () => {
      dlg.remove();
      resolve(result);
    });
    (document.querySelector('[data-adm]') ?? document.body).append(dlg);
    openDialog(dlg, input ?? (o.danger ? cancel : ok));
  });
}

export const confirmDiscard = () => confirmDialog({ title: T(C.discardTitle), message: T(C.discardText), confirm: T(C.discardOk), danger: true });

/* ───────────────────────── buttons & helpers ────────────────────── */

export function setBusy(btn: HTMLButtonElement | null | undefined, on: boolean) {
  if (!btn) return;
  btn.disabled = on;
  btn.classList.toggle('is-busy', on);
  if (on) btn.setAttribute('aria-busy', 'true');
  else btn.removeAttribute('aria-busy');
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = h('textarea', { style: 'position:fixed;inset-block-start:0;opacity:0', readonly: true });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    let ok = false;
    try {
      // Legacy fallback for browsers without the async clipboard API.
      ok = (document as unknown as { execCommand: (cmd: string) => boolean }).execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

export async function copyWithToast(text: string, message?: string) {
  const ok = await copyText(text);
  if (ok) toast(message ?? T(C.copied));
  else toast(T(C.copyFailed), { type: 'error' });
  return ok;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename, style: 'display:none' });
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 15000);
}

/** File-name friendly version of a title (keeps Hebrew letters). */
export const slugFile = (s: string) =>
  s
    .trim()
    .replace(/[\\/:*?"<>|#%&{}$!'@+`=]+/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60) || 'gallery';

/* ─────────────────────── keep-the-tab-open guard ────────────────── */
const holds = new Set<string>();
window.addEventListener('beforeunload', (e) => {
  if (!holds.size) return;
  e.preventDefault();
  // Older Safari/Firefox still need a return value to show the prompt.
  (e as unknown as { returnValue: string }).returnValue = '';
});
export function holdUnload(key: string, on: boolean) {
  if (on) holds.add(key);
  else holds.delete(key);
}

/** Keep the screen awake during long uploads / analysis (where supported). */
type WakeLockLike = { release: () => Promise<void> };
let wakeLock: WakeLockLike | null = null;
const wakeHolders = new Set<string>();
export async function keepAwake(key: string, on: boolean) {
  if (on) wakeHolders.add(key);
  else wakeHolders.delete(key);
  const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockLike> } };
  try {
    if (wakeHolders.size && !wakeLock && nav.wakeLock) wakeLock = await nav.wakeLock.request('screen');
    else if (!wakeHolders.size && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    wakeLock = null;
  }
}
document.addEventListener('visibilitychange', () => {
  // The browser drops the lock when the tab is hidden; take it again on return.
  if (document.visibilityState === 'visible' && wakeHolders.size) {
    wakeLock = null;
    void keepAwake([...wakeHolders][0]!, true);
  }
});

/** Simple skeleton blocks for loading states. */
export const skeletons = (n: number, cls: string) => Array.from({ length: n }, () => h('div', { class: `adm-skel ${cls}`, 'aria-hidden': 'true' }));

/** Empty-state block. */
export function emptyState(o: { icon: IconName; title: string; text?: string; action?: HTMLElement | null }) {
  return h(
    'div',
    { class: 'adm-empty' },
    h('span', { class: 'adm-empty__icon' }, icon(o.icon, 28, '', undefined)),
    h('h3', { class: 'adm-empty__title' }, o.title),
    o.text ? h('p', { class: 'adm-empty__text' }, o.text) : null,
    o.action ?? null,
  );
}

/** Error block with a retry button. */
export function errorState(message: string, retry: () => void) {
  return h(
    'div',
    { class: 'adm-empty adm-empty--error', role: 'alert' },
    h('span', { class: 'adm-empty__icon' }, icon('circle-alert', 28)),
    h('p', { class: 'adm-empty__text' }, message),
    h('button', { type: 'button', class: 'btn btn--sm', onclick: retry }, icon('refresh-cw', 16), T(C.retry)),
  );
}
