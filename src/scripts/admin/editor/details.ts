/** Details tab: the gallery record form (PATCH), access code, status, guest options. */
import type { GalleryRecord, GalleryStatus } from '~/shared/gallery-types';
import { ApiError, errorText } from '../core/api';
import { $, $$ } from '../core/dom';
import { C, T, fmtDay, isYmd, toYmd } from '../core/i18n';
import { holdUnload, setBusy, toast, toastError } from '../core/ui';
import { cleanCode, suggestCode } from '../lib/ids';
import { ed, on, patchGallery, syncNow } from './state';

const S = {
  titleRequired: { he: 'לגלריה צריך להיות שם', en: 'The gallery needs a name' },
  codeInvalid: { he: 'קוד של 4–40 תווים: אותיות באנגלית, ספרות ומקפים', en: 'Use 4–40 characters: letters, digits and dashes' },
  codeTaken: { he: 'הקוד הזה כבר בשימוש בגלריה אחרת. אפשר לבחור קוד אחר או ללחוץ על "הצעה חדשה".', en: 'That code is already used by another gallery. Pick another or tap “Suggest”.' },
  codeTakenToast: { he: 'קוד הגישה תפוס — שום דבר לא נשמר', en: 'That access code is taken — nothing was saved' },
  urlInvalid: { he: 'כתובת מלאה שמתחילה ב־https://', en: 'A full address starting with https://' },
  saved: { he: 'השינויים נשמרו ✓', en: 'Changes saved ✓' },
  expiresHint: { he: 'אחרי {d} הגלריה תיסגר לאורחים (אתה תמיד יכול להיכנס).', en: 'After {d} the gallery closes for guests (you can always open it).' },
  expiresNone: { he: 'ריק = הגלריה פתוחה ללא הגבלת זמן.', en: 'Empty = the gallery stays open with no time limit.' },
  messageCount: { he: '{n} / {max}', en: '{n} / {max}' },
};

const MESSAGE_MAX = 1200;
type Values = Record<string, string | boolean>;

let snapshot: Values = {};
let wired = false;

const form = () => $<HTMLFormElement>('[data-details]');

function el<T extends HTMLElement = HTMLInputElement>(name: string): T {
  return form().elements.namedItem(name) as unknown as T;
}

/** ISO timestamp → local YYYY-MM-DD for <input type=date>. */
function isoToDay(iso?: string): string {
  if (!iso) return '';
  if (isYmd(iso)) return iso;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : toYmd(d);
}

function fromRecord(g: GalleryRecord): Values {
  return {
    title: g.title ?? '',
    subtitle: g.subtitle ?? '',
    date: g.date ?? '',
    lang: g.lang ?? 'he',
    message: g.message ?? '',
    code: g.code ?? '',
    status: g.status,
    expiresAt: isoToDay(g.expiresAt),
    externalUrl: g.externalUrl ?? '',
    allowDownload: !!g.allowDownload,
    allowOriginals: !!g.allowOriginals,
    faceSearch: !!g.faceSearch,
    live: !!g.live,
  };
}

function read(): Values {
  const f = form();
  const v: Values = {};
  for (const name of Object.keys(snapshot)) {
    const field = f.elements.namedItem(name);
    if (field instanceof RadioNodeList) v[name] = field.value;
    else if (field instanceof HTMLInputElement && field.type === 'checkbox') v[name] = field.checked;
    else if (field) v[name] = (field as HTMLInputElement).value.trim();
  }
  return v;
}

function write(v: Values) {
  const f = form();
  for (const [name, value] of Object.entries(v)) {
    const field = f.elements.namedItem(name);
    if (field instanceof RadioNodeList) field.value = String(value);
    else if (field instanceof HTMLInputElement && field.type === 'checkbox') field.checked = !!value;
    else if (field) (field as HTMLInputElement).value = String(value);
  }
}

function changed(): string[] {
  const now = read();
  return Object.keys(snapshot).filter((k) => now[k] !== snapshot[k]);
}

function setError(name: string, msg: string) {
  const p = form().querySelector<HTMLElement>(`[data-error-for="${name}"]`);
  if (p) p.textContent = msg;
  const input = el(name);
  input.closest('.field')?.classList.toggle('field--invalid', !!msg);
  if (msg) input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');
}

function clearErrors() {
  for (const n of ['title', 'code', 'externalUrl']) setError(n, '');
}

function updateDirty() {
  const dirty = changed().length > 0;
  $('[data-details-savebar]').hidden = !dirty;
  form().classList.toggle('is-dirty', dirty);
  holdUnload('details', dirty);
  updateHints();
}

function updateHints() {
  const exp = el('expiresAt').value;
  $('[data-expires-hint]').textContent = exp ? T(S.expiresHint, { d: fmtDay(exp) }) : T(S.expiresNone);
  const msg = el<HTMLTextAreaElement>('message').value;
  $('[data-message-count]').textContent = T(S.messageCount, { n: msg.length, max: MESSAGE_MAX });
  // Originals need downloads to be useful.
  const dl = el('allowDownload');
  const orig = el('allowOriginals');
  orig.disabled = !dl.checked;
  orig.closest('.adm-switch')?.classList.toggle('is-disabled', !dl.checked);
}

function fill() {
  const st = ed.state;
  if (!st) return;
  snapshot = fromRecord(st.gallery);
  write(snapshot);
  clearErrors();
  updateDirty();
}

function validate(v: Values): boolean {
  let ok = true;
  clearErrors();
  if (!String(v.title)) {
    setError('title', T(S.titleRequired));
    ok = false;
  }
  const code = cleanCode(String(v.code));
  if (code.replace(/-/g, '').length < 4) {
    setError('code', T(S.codeInvalid));
    ok = false;
  }
  const url = String(v.externalUrl);
  if (url && !/^https?:\/\/[^\s.]+\.[^\s]{2,}/i.test(url)) {
    setError('externalUrl', T(S.urlInvalid));
    ok = false;
  }
  if (!ok) form().querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  return ok;
}

async function save() {
  const st = ed.state;
  if (!st) return;
  const codeInput = el('code');
  codeInput.value = cleanCode(codeInput.value);
  const v = read();
  if (!validate(v)) return;
  const keys = changed();
  if (!keys.length) return;
  const patch: Record<string, unknown> = {};
  let newStatus: GalleryStatus | null = null;
  for (const k of keys) {
    if (k === 'status') newStatus = v.status as GalleryStatus;
    else if (k === 'expiresAt') patch.expiresAt = v.expiresAt ? new Date(`${v.expiresAt}T23:59:59`).toISOString() : '';
    else if (k === 'message') patch.message = String(v.message).slice(0, MESSAGE_MAX);
    else patch[k] = v[k];
  }
  // Archiving is a plain record change; publish/unpublish also rebuilds the manifest.
  if (newStatus === 'archived') patch.status = 'archived';
  const btn = $<HTMLButtonElement>('[data-details-save]');
  setBusy(btn, true);
  try {
    if (Object.keys(patch).length) await patchGallery(patch);
    if (newStatus && newStatus !== 'archived') await syncNow(st.gid, newStatus);
    fill();
    toast(T(S.saved));
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      setError('code', T(S.codeTaken));
      codeInput.focus();
      toastError(T(S.codeTakenToast));
    } else toastError(errorText(e));
  } finally {
    setBusy(btn, false);
  }
}

export const details = {
  init() {
    if (wired) return;
    wired = true;
    const f = form();
    f.addEventListener('input', updateDirty);
    f.addEventListener('change', updateDirty);
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      void save();
    });
    el('code').addEventListener('blur', () => {
      const c = el('code');
      c.value = cleanCode(c.value);
      updateDirty();
    });
    $('[data-code-suggest]').addEventListener('click', () => {
      const st = ed.state;
      el('code').value = suggestCode(el('title').value, el('subtitle').value, st?.gallery.title);
      setError('code', '');
      updateDirty();
      el('code').focus();
    });
    $('[data-details-discard]').addEventListener('click', () => {
      fill();
      toast(T(C.discard), { type: 'info', duration: 2000 });
    });
    $$<HTMLButtonElement>('[data-clear-field]').forEach((b) =>
      b.addEventListener('click', () => {
        const input = el(b.dataset.clearField!);
        input.value = '';
        updateDirty();
        input.focus();
      }),
    );
    // Reflect record changes made elsewhere (publish, cover…) unless the user is mid-edit.
    on('gallery', () => {
      if (!ed.state) return;
      if (!changed().length) fill();
      else {
        const fresh = fromRecord(ed.state.gallery);
        if (snapshot.status !== fresh.status && read().status === snapshot.status) {
          snapshot.status = fresh.status;
          el<HTMLSelectElement>('status').value = String(fresh.status);
        }
        updateDirty();
      }
    });
  },
  load() {
    fill();
  },
  show() {
    updateHints();
  },
  isDirty() {
    return ed.state ? changed().length > 0 : false;
  },
  reset() {
    fill();
  },
};
