/** Availability calendar: mark dates booked / limited; the public site reads it for the date checker. */
import type { Availability } from '~/shared/gallery-types';
import { api, ApiError, errorText } from '../core/api';
import { $, h, icon } from '../core/dom';
import { C, T, fmtDay, fmtNumber, hebrewDate, hebrewDay, isRtl, locale, parseDay, toYmd, todayYmd } from '../core/i18n';
import { errorState, holdUnload, setBusy, toast, toastError } from '../core/ui';
import type { View } from '../core/view';

type Status = 'available' | 'booked' | 'limited';
const NEXT: Record<Status, Status> = { available: 'booked', booked: 'limited', limited: 'available' };

const S = {
  status: {
    available: { he: 'פנוי', en: 'Available' },
    booked: { he: 'תפוס', en: 'Booked' },
    limited: { he: 'מקום אחרון', en: 'One spot left' },
  },
  past: { he: 'עבר', en: 'Past' },
  saved: { he: 'נשמר — האתר מציג עכשיו את התאריכים המעודכנים', en: 'Saved — the website now shows the updated dates' },
  discarded: { he: 'השינויים בוטלו', en: 'Changes discarded' },
  changes: { he: '{n} שינויים שלא נשמרו', en: '{n} unsaved changes' },
  changesOne: { he: 'שינוי אחד שלא נשמר', en: '1 unsaved change' },
  upcomingEmpty: { he: 'אין תאריכים מסומנים בהמשך. כל התאריכים פנויים.', en: 'No marked dates ahead. Everything is available.' },
  monthStats: { he: 'החודש: תפוסים {b} · מקום אחרון {l}', en: 'This month: {b} booked · {l} with one spot left' },
  pickHint: { he: 'בחר תאריך בלוח כדי לראות ולשנות אותו.', en: 'Pick a date on the calendar to see and change it.' },
  pastHint: { he: 'התאריך כבר עבר.', en: 'This date has passed.' },
  setTo: { he: 'סימון התאריך', en: 'Mark this date' },
  dayLabel: { he: '{d}, {heb} — {s}', en: '{d}, {heb} — {s}' },
  prev: { he: 'החודש הקודם', en: 'Previous month' },
  next: { he: 'החודש הבא', en: 'Next month' },
};

let saved: { booked: Set<string>; limited: Set<string> } = { booked: new Set(), limited: new Set() };
let booked = new Set<string>();
let limited = new Set<string>();
let month = firstOfMonth(parseDay(todayYmd()));
let focusDate = todayYmd();
let loaded = false;
let loadError: unknown = null;
let wired = false;

function firstOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 12);
}

const statusOf = (ymd: string): Status => (booked.has(ymd) ? 'booked' : limited.has(ymd) ? 'limited' : 'available');

function setStatus(ymd: string, s: Status) {
  booked.delete(ymd);
  limited.delete(ymd);
  if (s === 'booked') booked.add(ymd);
  if (s === 'limited') limited.add(ymd);
}

function changeCount(): number {
  let n = 0;
  const all = new Set([...booked, ...limited, ...saved.booked, ...saved.limited]);
  for (const d of all) {
    const before = saved.booked.has(d) ? 'booked' : saved.limited.has(d) ? 'limited' : 'available';
    if (before !== statusOf(d)) n++;
  }
  return n;
}

/* ─────────────────────────────── render ─────────────────────────────── */

function weekdayNames(): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: isRtl ? 'narrow' : 'short' });
  // 2026-10-11 is a Sunday
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2026, 9, 11 + i, 12)));
}

function dayAria(ymd: string, past: boolean) {
  const heb = hebrewDate(ymd);
  return T(S.dayLabel, {
    d: fmtDay(ymd, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    heb,
    s: past ? T(S.past) : T(S.status[statusOf(ymd)]),
  });
}

function renderGrid(focus = false) {
  const grid = $('[data-cal-grid]');
  const today = todayYmd();
  const y = month.getFullYear();
  const m = month.getMonth();
  const days = new Date(y, m + 1, 0).getDate();
  const lead = new Date(y, m, 1).getDay();
  $('[data-cal-title]').textContent = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(month);

  // keep the focused date inside the visible month
  const fd = parseDay(focusDate);
  if (fd.getFullYear() !== y || fd.getMonth() !== m) focusDate = toYmd(new Date(y, m, Math.min(fd.getDate(), days), 12));

  const head = h('div', { role: 'row', class: 'adm-cal__row adm-cal__row--head' }, ...weekdayNames().map((n) => h('span', { role: 'columnheader', class: 'adm-cal__wd' }, n)));
  const rows: HTMLElement[] = [head];
  let cells: HTMLElement[] = [];
  for (let i = 0; i < lead; i++) cells.push(h('span', { role: 'gridcell', class: 'adm-cal__blank', 'aria-hidden': 'true' }));
  let bookedN = 0;
  let limitedN = 0;
  for (let d = 1; d <= days; d++) {
    const ymd = toYmd(new Date(y, m, d, 12));
    const past = ymd < today;
    const st = statusOf(ymd);
    if (st === 'booked') bookedN++;
    if (st === 'limited') limitedN++;
    const heb = hebrewDay(ymd);
    const btn = h(
      'button',
      {
        type: 'button',
        class: `adm-cal__day is-${st}${past ? ' is-past' : ''}${ymd === today ? ' is-today' : ''}${ymd === focusDate ? ' is-focus' : ''}`,
        'data-date': ymd,
        tabindex: ymd === focusDate ? '0' : '-1',
        'aria-label': dayAria(ymd, past),
        'aria-disabled': past ? 'true' : undefined,
        'aria-current': ymd === today ? 'date' : undefined,
      },
      h('span', { class: 'adm-cal__num' }, String(d)),
      h('span', { class: 'adm-cal__heb', lang: 'he', 'aria-hidden': 'true' }, heb.first ? `${heb.day} ${heb.month}` : heb.day),
      st !== 'available' && !past ? h('span', { class: 'adm-cal__tag', 'aria-hidden': 'true' }, T(S.status[st])) : null,
    );
    cells.push(h('span', { role: 'gridcell', class: 'adm-cal__cell' }, btn));
    if (cells.length === 7) {
      rows.push(h('div', { role: 'row', class: 'adm-cal__row' }, ...cells));
      cells = [];
    }
  }
  if (cells.length) {
    while (cells.length < 7) cells.push(h('span', { role: 'gridcell', class: 'adm-cal__blank', 'aria-hidden': 'true' }));
    rows.push(h('div', { role: 'row', class: 'adm-cal__row' }, ...cells));
  }
  grid.replaceChildren(...rows);
  $('[data-cal-stats]').textContent = T(S.monthStats, { b: fmtNumber(bookedN), l: fmtNumber(limitedN) });
  if (focus) grid.querySelector<HTMLButtonElement>(`[data-date="${focusDate}"]`)?.focus();
}

function renderDay() {
  const box = $('[data-day]');
  const ymd = focusDate;
  const past = ymd < todayYmd();
  const st = statusOf(ymd);
  box.replaceChildren(
    h('p', { class: 'adm-day__weekday' }, fmtDay(ymd, { weekday: 'long' })),
    h('h2', { class: 'adm-day__date' }, fmtDay(ymd, { day: 'numeric', month: 'long', year: 'numeric' })),
    h('p', { class: 'adm-day__heb', lang: 'he', dir: 'rtl' }, hebrewDate(ymd)),
    past
      ? h('p', { class: 'adm-muted' }, T(S.pastHint))
      : h(
          'div',
          { class: 'adm-day__set', role: 'group', 'aria-label': T(S.setTo) },
          ...(['available', 'booked', 'limited'] as Status[]).map((s) =>
            h(
              'button',
              {
                type: 'button',
                class: `adm-day__opt adm-day__opt--${s}`,
                'aria-pressed': String(st === s),
                onclick: () => {
                  setStatus(ymd, s);
                  update();
                },
              },
              h('span', { class: 'adm-day__swatch', 'aria-hidden': 'true' }),
              T(S.status[s]),
            ),
          ),
        ),
  );
}

function renderUpcoming() {
  const list = $('[data-upcoming]');
  const today = todayYmd();
  const marked = [...booked, ...limited].filter((d) => d >= today).sort().slice(0, 10);
  if (!marked.length) {
    list.replaceChildren(h('li', { class: 'adm-upcoming__empty' }, T(S.upcomingEmpty)));
    return;
  }
  list.replaceChildren(
    ...marked.map((d) => {
      const st = statusOf(d);
      return h(
        'li',
        null,
        h(
          'button',
          {
            type: 'button',
            class: 'adm-upcoming__item',
            onclick: () => {
              focusDate = d;
              month = firstOfMonth(parseDay(d));
              update(true);
            },
          },
          h('span', { class: `adm-upcoming__dot is-${st}`, 'aria-hidden': 'true' }),
          h('span', { class: 'adm-upcoming__date' }, fmtDay(d, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })),
          h('span', { class: 'adm-upcoming__status' }, T(S.status[st])),
        ),
      );
    }),
  );
}

function renderSavebar() {
  const n = changeCount();
  const bar = $('[data-av-savebar]');
  bar.hidden = n === 0;
  $('[data-av-changes]').textContent = n === 1 ? T(S.changesOne) : T(S.changes, { n: fmtNumber(n) });
  holdUnload('availability', n > 0);
}

function update(focus = false) {
  renderGrid(focus);
  renderDay();
  renderUpcoming();
  renderSavebar();
}

function render() {
  const body = $('[data-av-body]');
  const err = $('[data-av-error]');
  if (loadError) {
    body.hidden = true;
    err.hidden = false;
    err.replaceChildren(errorState(errorText(loadError), () => void load()));
    return;
  }
  err.hidden = true;
  body.hidden = false;
  body.setAttribute('aria-busy', String(!loaded));
  update();
}

/* ─────────────────────────────── data ─────────────────────────────── */

async function load() {
  loadError = null;
  try {
    const res = await api<Availability>('/api/admin/availability');
    saved = { booked: new Set(res.booked ?? []), limited: new Set(res.limited ?? []) };
    booked = new Set(saved.booked);
    limited = new Set(saved.limited);
    loaded = true;
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 401)) loadError = e;
  }
  render();
}

async function save() {
  const btn = $<HTMLButtonElement>('[data-av-save]');
  setBusy(btn, true);
  const body = { booked: [...booked].sort(), limited: [...limited].sort() };
  try {
    await api('/api/admin/availability', { method: 'PUT', body });
    saved = { booked: new Set(body.booked), limited: new Set(body.limited) };
    toast(T(S.saved));
    update();
  } catch (e) {
    toastError(errorText(e));
  } finally {
    setBusy(btn, false);
  }
}

function discard() {
  booked = new Set(saved.booked);
  limited = new Set(saved.limited);
  update();
}

function moveFocus(days: number) {
  const d = parseDay(focusDate);
  d.setDate(d.getDate() + days);
  focusDate = toYmd(d);
  const fm = firstOfMonth(d);
  const changedMonth = fm.getTime() !== month.getTime();
  month = fm;
  if (changedMonth) update(true);
  else {
    renderGrid(true);
    renderDay();
  }
}

function wire() {
  if (wired) return;
  wired = true;
  const grid = $('[data-cal-grid]');
  grid.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-date]');
    if (!b) return;
    const ymd = b.dataset.date!;
    focusDate = ymd;
    if (ymd >= todayYmd()) setStatus(ymd, NEXT[statusOf(ymd)]);
    update(true);
  });
  grid.addEventListener('keydown', (e) => {
    const keys: Record<string, number> = {
      ArrowRight: isRtl ? -1 : 1,
      ArrowLeft: isRtl ? 1 : -1,
      ArrowDown: 7,
      ArrowUp: -7,
    };
    if (e.key in keys) {
      e.preventDefault();
      moveFocus(keys[e.key]!);
    } else if (e.key === 'PageDown' || e.key === 'PageUp') {
      e.preventDefault();
      const d = parseDay(focusDate);
      d.setMonth(d.getMonth() + (e.key === 'PageDown' ? 1 : -1));
      focusDate = toYmd(d);
      month = firstOfMonth(d);
      update(true);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      const d = parseDay(focusDate);
      moveFocus(e.key === 'Home' ? -d.getDay() : 6 - d.getDay());
    }
  });
  const step = (n: number) => {
    month = new Date(month.getFullYear(), month.getMonth() + n, 1, 12);
    update();
  };
  $('[data-cal-prev]').addEventListener('click', () => step(-1));
  $('[data-cal-next]').addEventListener('click', () => step(1));
  $('[data-cal-today]').addEventListener('click', () => {
    focusDate = todayYmd();
    month = firstOfMonth(parseDay(focusDate));
    update(true);
  });
  $('[data-av-save]').addEventListener('click', () => void save());
  $('[data-av-discard]').addEventListener('click', () => {
    discard();
    toast(T(S.discarded), { type: 'info', duration: 2000 });
  });
  $$prevNextLabels();
}

function $$prevNextLabels() {
  $('[data-cal-prev]').setAttribute('aria-label', T(S.prev));
  $('[data-cal-next]').setAttribute('aria-label', T(S.next));
  $('[data-cal-prev]').replaceChildren(icon(isRtl ? 'chevron-right' : 'chevron-left', 20));
  $('[data-cal-next]').replaceChildren(icon(isRtl ? 'chevron-left' : 'chevron-right', 20));
}

export const availabilityView: View = {
  mount(_route, entered) {
    wire();
    if (entered && !changeCount()) void load();
    else render();
  },
  leaveWarning() {
    return changeCount() ? { title: T(C.discardTitle), message: T(C.discardText), confirm: T(C.discardOk) } : null;
  },
  discard,
};
