/** Small UI primitives: modal dialogs, toasts, announcements, scrolling. */
import { getLenis, lockScroll, motionOff } from '~/scripts/core';
import { iconSvg, type IconName } from '~/shared/icons';

/* ─────────────────────────── scrolling ─────────────────────────── */

export function scrollToY(y: number, smooth = true) {
  const lenis = getLenis();
  const animate = smooth && !motionOff();
  if (lenis) lenis.scrollTo(y, { immediate: !animate, force: true, duration: animate ? 1.1 : 0 });
  else window.scrollTo({ top: y, behavior: animate ? 'smooth' : 'auto' });
}

/* ──────────────────────────── dialogs ──────────────────────────── */

const openStack: HTMLDialogElement[] = [];
const returnFocus = new WeakMap<HTMLDialogElement, HTMLElement | null>();
const onCloseHandlers = new WeakMap<HTMLDialogElement, () => void>();

function setupDialog(dlg: HTMLDialogElement) {
  if (dlg.dataset.ready) return;
  dlg.dataset.ready = '1';
  dlg.addEventListener('cancel', (e) => {
    e.preventDefault();
    closeDialog(dlg);
  });
  // Click on the backdrop closes (the dialog element itself is only hit outside the box).
  dlg.addEventListener('click', (e) => {
    if (e.target !== dlg) return;
    const r = dlg.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside || (e.clientX === 0 && e.clientY === 0)) closeDialog(dlg);
  });
  dlg.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-close]')) closeDialog(dlg);
  });
}

export function openDialog(dlg: HTMLDialogElement, opts: { focus?: HTMLElement | null; onClose?: () => void } = {}) {
  setupDialog(dlg);
  if (dlg.open) return;
  returnFocus.set(dlg, document.activeElement as HTMLElement | null);
  if (opts.onClose) onCloseHandlers.set(dlg, opts.onClose);
  else onCloseHandlers.delete(dlg);
  dlg.classList.remove('is-closing');
  dlg.showModal();
  if (!openStack.length) lockScroll(true);
  openStack.push(dlg);
  const target = opts.focus ?? dlg.querySelector<HTMLElement>('[autofocus]') ?? dlg.querySelector<HTMLElement>('.g-dlg__title[tabindex]') ?? null;
  if (target) target.focus({ preventScroll: true });
  // Keep the box scrolled to the top on reopen.
  dlg.querySelector('.g-dlg__box')?.scrollTo?.(0, 0);
}

export function closeDialog(dlg: HTMLDialogElement, restoreFocus = true): Promise<void> {
  return new Promise((resolve) => {
    if (!dlg.open || dlg.classList.contains('is-closing')) return resolve();
    const finish = () => {
      dlg.classList.remove('is-closing');
      dlg.close();
      const i = openStack.indexOf(dlg);
      if (i >= 0) openStack.splice(i, 1);
      if (!openStack.length) lockScroll(false);
      onCloseHandlers.get(dlg)?.();
      onCloseHandlers.delete(dlg);
      const back = returnFocus.get(dlg);
      if (restoreFocus && back && back.isConnected) back.focus({ preventScroll: true });
      resolve();
    };
    if (motionOff()) return finish();
    dlg.classList.add('is-closing');
    window.setTimeout(finish, 210);
  });
}

export const isDialogOpen = () => openStack.length > 0;

/* ──────────────────────────── toasts ───────────────────────────── */

let toastRoot: HTMLElement | null = null;

export function toast(message: string, opts: { icon?: IconName; action?: { label: string; run: () => void }; duration?: number } = {}) {
  toastRoot ??= document.querySelector<HTMLElement>('[data-toasts]');
  if (!toastRoot) return;
  const el = document.createElement('div');
  el.className = 'g-toast';
  if (opts.icon) el.insertAdjacentHTML('beforeend', iconSvg(opts.icon, { size: 18 }));
  const text = document.createElement('span');
  text.textContent = message;
  el.append(text);
  let timer = 0;
  const dismiss = () => {
    clearTimeout(timer);
    el.classList.add('is-leaving');
    window.setTimeout(() => el.remove(), 300);
  };
  if (opts.action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'g-toast__action';
    btn.textContent = opts.action.label;
    btn.addEventListener('click', () => {
      opts.action!.run();
      dismiss();
    });
    el.append(btn);
  }
  // Only a few at a time.
  while (toastRoot.children.length >= 3) toastRoot.firstElementChild?.remove();
  toastRoot.append(el);
  timer = window.setTimeout(dismiss, opts.duration ?? (opts.action ? 7000 : 3600));
  el.addEventListener('pointerenter', () => clearTimeout(timer));
  el.addEventListener('pointerleave', () => (timer = window.setTimeout(dismiss, 2500)));
}

/* ───────────────────────── announcements ───────────────────────── */

let announceEl: HTMLElement | null = null;
let announceTimer = 0;
/** Polite screen-reader announcement. */
export function announce(message: string) {
  announceEl ??= document.querySelector<HTMLElement>('[data-announce]');
  if (!announceEl) return;
  clearTimeout(announceTimer);
  announceEl.textContent = '';
  announceTimer = window.setTimeout(() => (announceEl!.textContent = message), 60);
}

/* ──────────────────────────── sharing ──────────────────────────── */

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers / denied permission: fall back to a hidden textarea.
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.append(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** Web Share API when available, otherwise copy the link. */
export async function shareOrCopy(data: { url: string; title?: string; text?: string; files?: File[] }): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (typeof nav.share === 'function') {
    const payload: ShareData = data.files?.length && nav.canShare?.({ files: data.files }) ? { files: data.files, title: data.title, text: data.text } : { url: data.url, title: data.title, text: data.text };
    try {
      await nav.share(payload);
      return 'shared';
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return 'cancelled';
      /* fall through to copying */
    }
  }
  return (await copyText(data.url)) ? 'copied' : 'failed';
}
