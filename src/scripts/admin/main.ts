/**
 * Admin panel entry: session check, login, shell navigation and hash routing.
 * Views live in ./views and ./editor; the upload queue runs independently.
 */
import { api, ApiError, UNAUTHORIZED_EVENT } from './core/api';
import { $, $$, $maybe, icon } from './core/dom';
import { C, T, fmtNumber } from './core/i18n';
import { parseHash, replaceHash, routes, type Route, type ViewName } from './core/router';
import { confirmDialog, setBusy, toast } from './core/ui';
import type { View } from './core/view';
import { uploads } from './upload/queue';
import { galleriesView } from './views/galleries';
import { editorView } from './editor';
import { inquiriesView, refreshLeadBadge } from './views/inquiries';
import { availabilityView } from './views/availability';
import { helpView } from './views/help';
import { store } from './core/store';

const views: Record<ViewName, View> = {
  galleries: galleriesView,
  gallery: editorView,
  inquiries: inquiriesView,
  availability: availabilityView,
  help: helpView,
};

const TITLES: Record<ViewName, { he: string; en: string }> = {
  galleries: { he: 'גלריות', en: 'Galleries' },
  gallery: { he: 'גלריה', en: 'Gallery' },
  inquiries: { he: 'פניות', en: 'Inquiries' },
  availability: { he: 'יומן זמינות', en: 'Availability' },
  help: { he: 'עזרה', en: 'Help' },
};
const APP_NAME = { he: 'ניהול · מושיק', en: 'Studio · Moshik' };

let authed = false;
let current: ViewName | null = null;
let currentHash = '';
let routing = false;

export function initAdmin() {
  const root = $('[data-adm]');
  document.documentElement.classList.add('adm-page');
  initLogin();
  initNav();
  window.addEventListener('hashchange', onHashChange);
  window.addEventListener(UNAUTHORIZED_EVENT, () => {
    if (!authed) return;
    authed = false;
    toast(T({ he: 'פג תוקף הכניסה — צריך להתחבר שוב.', en: 'Your session ended — please sign in again.' }), { type: 'info' });
    showLogin();
  });
  root.dataset.state = 'boot';
  void checkSession();
}

/* ───────────────────────────── session & login ───────────────────────────── */

async function checkSession() {
  try {
    await api('/api/admin/session', { auth: false });
    enterApp(false);
  } catch (e) {
    showLogin(e instanceof ApiError && e.status !== 401 ? e : undefined);
  }
}

function showLogin(problem?: ApiError) {
  const root = $('[data-adm]');
  root.dataset.state = 'login';
  document.documentElement.classList.remove('adm-authed');
  document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach((d) => d.close());
  $('[data-boot]').hidden = true;
  $('[data-app]').hidden = true;
  $('[data-nav]').hidden = true;
  const login = $('[data-login]');
  login.hidden = false;
  const notice = $('[data-login-offline]');
  notice.hidden = !problem || problem.status === 503;
  if (problem?.status === 503 && problem.code === 'not_configured') $('[data-login-notice]').hidden = false;
  document.title = T({ he: 'כניסה · ניהול', en: 'Sign in · Studio' });
  requestAnimationFrame(() => $<HTMLInputElement>('#adm-pw').focus());
}

function enterApp(fromLogin: boolean) {
  authed = true;
  const root = $('[data-adm]');
  root.dataset.state = 'app';
  document.documentElement.classList.add('adm-authed');
  $('[data-boot]').hidden = true;
  $('[data-login]').hidden = true;
  $('[data-app]').hidden = false;
  $('[data-nav]').hidden = false;
  if (fromLogin) toast(T({ he: 'ברוך הבא, מושיק 👋', en: 'Welcome back, Moshik 👋' }));
  void refreshLeadBadge();
  current = null;
  route();
}

function initLogin() {
  const form = $<HTMLFormElement>('[data-login-form]');
  const input = $<HTMLInputElement>('#adm-pw');
  const error = $('[data-login-error]');
  const submit = $<HTMLButtonElement>('[data-login-submit]');
  const toggle = $<HTMLButtonElement>('[data-pw-toggle]');
  const field = input.closest('.field');

  toggle.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(show));
    toggle.setAttribute('aria-label', show ? T({ he: 'הסתרת הסיסמה', en: 'Hide password' }) : T({ he: 'הצגת הסיסמה', en: 'Show password' }));
    toggle.replaceChildren(icon(show ? 'eye-off' : 'eye', 18));
    input.focus();
  });

  const setError = (msg: string) => {
    error.textContent = msg;
    field?.classList.toggle('field--invalid', !!msg);
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };
  input.addEventListener('input', () => setError(''));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = input.value;
    if (!password) {
      setError(T({ he: 'נא להזין סיסמה', en: 'Please enter your password' }));
      input.focus();
      return;
    }
    setBusy(submit, true);
    setError('');
    try {
      await api('/api/admin/login', { method: 'POST', body: { password }, auth: false });
      input.value = '';
      enterApp(true);
    } catch (err) {
      const ae = err instanceof ApiError ? err : null;
      if (ae?.status === 401) setError(T({ he: 'הסיסמה לא נכונה. נסה שוב.', en: 'That password isn’t right. Try again.' }));
      else if (ae?.status === 429) setError(T(C.tooMany));
      else if (ae?.status === 503 && ae.code === 'not_configured') {
        $('[data-login-notice]').hidden = false;
        setError('');
      } else if (ae?.status === 0) setError(T(C.network));
      else setError(T(C.error));
      input.select();
    } finally {
      setBusy(submit, false);
    }
  });
}

async function logout() {
  const busy = uploads.busy();
  if (busy) {
    toast(T({ he: 'יש העלאה פעילה — כדאי לחכות שתסתיים לפני היציאה.', en: 'An upload is still running — wait for it to finish before signing out.' }), { type: 'info' });
    return;
  }
  try {
    await api('/api/admin/logout', { method: 'POST', auth: false });
  } catch {
    /* the cookie is short-lived anyway */
  }
  authed = false;
  store.reset();
  current = null;
  showLogin();
  toast(T({ he: 'יצאת מהמערכת. להתראות!', en: 'You’re signed out. See you soon!' }), { type: 'info' });
}

/* ──────────────────────────────── navigation ──────────────────────────────── */

function initNav() {
  $$('[data-logout]').forEach((b) => b.addEventListener('click', () => void logout()));
  uploads.addEventListener('change', renderUploadIndicator);
  // Keep the language switch on the same screen.
  const syncLang = () => $$<HTMLAnchorElement>('[data-lang-switch]').forEach((a) => (a.href = `${a.dataset.base}${location.hash}`));
  window.addEventListener('hashchange', syncLang);
  syncLang();
}

function highlightNav(view: ViewName) {
  const section = view === 'gallery' ? 'galleries' : view;
  $$<HTMLAnchorElement>('[data-nav-link]').forEach((a) => {
    if (a.dataset.navLink === section) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

function renderUploadIndicator() {
  const s = uploads.stats();
  const busy = uploads.busy();
  $$('[data-upload-indicator]').forEach((el) => {
    el.hidden = !busy;
    if (!busy) return;
    const first = uploads.items.find((i) => i.status === 'uploading' || i.status === 'preparing' || i.status === 'queued');
    const link = $maybe<HTMLAnchorElement>('a', el);
    if (link && first) link.href = routes.gallery(first.gid);
    const text = $maybe('[data-upload-text]', el);
    if (text)
      text.textContent =
        uploads.state === 'paused'
          ? T({ he: 'ההעלאה מושהית', en: 'Upload paused' })
          : T({ he: 'מעלה תמונות · {done}/{total}', en: 'Uploading · {done}/{total}' }, { done: fmtNumber(s.done), total: fmtNumber(s.total) });
    const bar = $maybe<HTMLElement>('[data-upload-bar]', el);
    if (bar) bar.style.inlineSize = `${s.bytesTotal ? Math.round((s.bytesDone / s.bytesTotal) * 100) : 0}%`;
  });
}

/* ─────────────────────────────────── router ───────────────────────────────── */

async function onHashChange() {
  if (!authed || routing) return;
  const next = parseHash();
  const active = current ? views[current] : null;
  const warning = active?.leaveWarning?.(next);
  if (warning) {
    routing = true;
    const target = location.hash;
    replaceHash(currentHash);
    const ok = await confirmDialog({ ...warning, danger: true });
    routing = false;
    if (!ok) return;
    active?.discard?.();
    replaceHash(target);
  }
  route();
}

function route() {
  const r: Route = parseHash();
  currentHash = location.hash;
  const entered = current !== r.view;
  if (entered && current) views[current].unmount?.();
  $$('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== r.view));
  highlightNav(r.view);
  current = r.view;
  document.title = `${T(TITLES[r.view])} · ${T(APP_NAME)}`;
  views[r.view].mount(r, entered);
  if (entered) {
    window.scrollTo({ top: 0 });
    const heading = $maybe<HTMLElement>(`[data-panel="${r.view}"] [data-focus-title]`);
    // Move focus for screen readers, but not on first load (keeps the page calm).
    if (heading && document.activeElement && document.activeElement !== document.body) heading.focus({ preventScroll: true });
  }
  if (!location.hash) replaceHash(routes.galleries());
}
