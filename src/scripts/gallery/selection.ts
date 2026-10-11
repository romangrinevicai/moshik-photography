/**
 * "Send to Moshik for the album": a short form that posts the favourites as
 * a selection. If the API is unreachable, the same list can be sent on
 * WhatsApp in one tap.
 */
import type { PhotoMeta } from '~/shared/gallery-types';
import { whatsappLink } from '~/config/site';
import { api, media } from './api';
import { t, tn } from './format';
import { store, type SentInfo } from './store';
import { openDialog } from './ui';

export interface SelectionContext {
  dlg: HTMLDialogElement;
  gid: string;
  title: string;
  favIds: string[];
  photos: Map<string, PhotoMeta>;
  /** 1-based position of each photo in the gallery, used when names are missing. */
  numberOf: (pid: string) => number;
  onSent: (info: SentInfo) => void;
}

const isPhone = (v: string) => /^\+?\d{9,15}$/.test(v.replace(/[\s\-().]/g, ''));
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

export function openSelection(ctx: SelectionContext) {
  const { dlg, favIds } = ctx;
  const n = favIds.length;
  const form = dlg.querySelector<HTMLFormElement>('[data-sel-form]')!;
  const paneForm = dlg.querySelector<HTMLElement>('[data-sel-pane="form"]')!;
  const paneDone = dlg.querySelector<HTMLElement>('[data-sel-pane="done"]')!;
  const submit = form.querySelector<HTMLButtonElement>('[data-sel-submit]')!;
  const submitLabel = submit.querySelector<HTMLElement>('[data-sel-submit-label]')!;
  const fail = form.querySelector<HTMLElement>('[data-sel-fail]')!;
  const hint = form.querySelector<HTMLElement>('[data-sel-contact-hint]')!;
  const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement;

  paneForm.hidden = false;
  paneDone.hidden = true;
  fail.hidden = true;
  submit.disabled = false;
  submitLabel.textContent = tn('selSubmit', n);
  dlg.querySelector<HTMLElement>('[data-sel-intro]')!.textContent = t('selIntro', { count: tn('chosenCount', n) });

  // A peek at what's being sent
  const thumbs = dlg.querySelector<HTMLElement>('[data-sel-thumbs]')!;
  thumbs.replaceChildren();
  const max = window.innerWidth < 640 ? 5 : 7;
  favIds.slice(0, max).forEach((id) => {
    const img = document.createElement('img');
    img.src = media.photo(ctx.gid, id, 'thumb');
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    thumbs.append(img);
  });
  if (n > max) {
    const more = document.createElement('span');
    more.className = 'g-sel__more';
    more.textContent = `+${n - max}`;
    thumbs.append(more);
  }

  // Remembered contact details
  const saved = store.contact();
  if (!field('name').value) field('name').value = saved.name ?? '';
  if (!field('phone').value) field('phone').value = saved.phone ?? '';
  if (!field('email').value) field('email').value = saved.email ?? '';

  const setError = (name: string, msg: string) => {
    const p = form.querySelector<HTMLElement>(`[data-error-for="${name}"]`);
    if (p) p.textContent = msg;
    p?.closest('.field')?.classList.toggle('field--invalid', !!msg);
    field(name)?.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };
  ['name', 'phone', 'email'].forEach((k) => setError(k, ''));
  hint.classList.remove('is-error');
  hint.textContent = t('selContactHint');

  const validate = () => {
    const name = field('name').value.trim();
    const phone = field('phone').value.trim();
    const email = field('email').value.trim();
    setError('name', name.length >= 2 ? '' : t('selErrName'));
    setError('phone', !phone || isPhone(phone) ? '' : t('selErrPhone'));
    setError('email', !email || isEmail(email) ? '' : t('selErrEmail'));
    const hasContact = !!phone || !!email;
    hint.classList.toggle('is-error', !hasContact);
    hint.textContent = hasContact ? t('selContactHint') : t('selErrContact');
    if (!hasContact) field('phone').setAttribute('aria-invalid', 'true');
    const ok = name.length >= 2 && hasContact && (!phone || isPhone(phone)) && (!email || isEmail(email));
    if (!ok) {
      const first = form.querySelector<HTMLElement>('[aria-invalid="true"]');
      first?.focus();
    }
    return ok;
  };

  const waMessage = () => {
    const list = favIds.map((id) => ctx.photos.get(id)?.name?.trim() || `#${ctx.numberOf(id)}`);
    let text = list.join(', ');
    if (text.length > 1500) text = `${text.slice(0, 1500)}…`;
    return t('waSelection', { title: ctx.title, count: tn('photos', n), list: text });
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    fail.hidden = true;
    if (!validate()) return;
    const body = {
      name: field('name').value.trim(),
      phone: field('phone').value.trim() || undefined,
      email: field('email').value.trim() || undefined,
      note: field('note').value.trim() || undefined,
      photoIds: favIds,
    };
    store.setContact({ name: body.name, phone: body.phone, email: body.email });
    submit.disabled = true;
    submitLabel.textContent = t('selSending');
    try {
      await api.sendSelection(ctx.gid, body);
      const info: SentInfo = { count: n, at: Date.now(), ids: favIds };
      store.setSent(ctx.gid, info);
      paneForm.hidden = true;
      paneDone.hidden = false;
      dlg.querySelector<HTMLElement>('[data-sel-done-text]')!.textContent = t('selDoneText', { count: tn('chosenCount', n) });
      dlg.querySelector<HTMLElement>('[data-sel-done-title]')!.focus({ preventScroll: true });
      field('note').value = '';
      ctx.onSent(info);
    } catch {
      fail.hidden = false;
      fail.querySelector<HTMLAnchorElement>('[data-sel-wa]')!.href = whatsappLink(waMessage());
      fail.scrollIntoView({ block: 'nearest' });
    } finally {
      submit.disabled = false;
      submitLabel.textContent = tn('selSubmit', n);
    }
  };

  openDialog(dlg, { focus: field('name').value ? submit : field('name') });
}
