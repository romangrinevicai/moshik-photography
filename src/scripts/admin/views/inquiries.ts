/** Inquiries (booking leads): list with filters, detail drawer, quick replies, notes & status. */
import type { Lead, LeadStatus } from '~/shared/gallery-types';
import { api, ApiError, errorText } from '../core/api';
import { label } from '../core/config';
import { $, $$, h, icon, nextId } from '../core/dom';
import { T, TL, daysUntil, fmtDateTime, fmtDay, fmtNumber, hebrewDate, isYmd, iso, leadStatusLabel, plural, relTime, type Lang } from '../core/i18n';
import { go, replaceHash, routes } from '../core/router';
import { confirmDialog, copyWithToast, emptyState, errorState, openDialog, setBusy, skeletons, toast, toastError } from '../core/ui';
import type { View } from '../core/view';
import { displayPhone, telHref, waLink } from '../lib/phone';

type Filter = 'all' | LeadStatus;
const STATUSES: LeadStatus[] = ['new', 'contacted', 'booked', 'lost'];

const S = {
  emptyTitle: { he: 'עוד אין פניות', en: 'No inquiries yet' },
  emptyText: {
    he: 'כשמישהו ימלא את טופס בדיקת התאריך באתר, הפנייה תגיע לכאן — עם כל הפרטים וכפתור לתשובה מהירה בוואטסאפ.',
    en: 'When someone fills in the booking form on the site, the inquiry lands here — with every detail and a one-tap WhatsApp reply.',
  },
  noMatch: { he: 'אין פניות שמתאימות לסינון', en: 'No inquiries match this filter' },
  showAll: { he: 'הצגת כל הפניות', en: 'Show all inquiries' },
  more: { he: 'טעינת פניות נוספות', en: 'Load more inquiries' },
  summaryAll: { he: ['פנייה אחת', '{n} פניות'], en: ['1 inquiry', '{n} inquiries'] } as { he: [string, string]; en: [string, string] },
  summaryNew: { he: ['אחת חדשה', '{n} חדשות'], en: ['1 new', '{n} new'] } as { he: [string, string]; en: [string, string] },
  flexible: { he: 'תאריך גמיש', en: 'Flexible date' },
  noDate: { he: 'בלי תאריך', en: 'No date yet' },
  inDays: { he: 'בעוד {n} ימים', en: 'in {n} days' },
  tomorrow: { he: 'מחר', en: 'tomorrow' },
  today: { he: 'היום!', en: 'today!' },
  passed: { he: 'עבר', en: 'passed' },
  received: { he: 'התקבלה {t}', en: 'Received {t}' },
  open: { he: 'פתיחת הפנייה של {n}', en: 'Open inquiry from {n}' },
  whatsapp: { he: 'תשובה בוואטסאפ', en: 'Reply on WhatsApp' },
  call: { he: 'חיוג', en: 'Call' },
  email: { he: 'אימייל', en: 'Email' },
  sEvent: { he: 'האירוע', en: 'The event' },
  sContact: { he: 'פרטי קשר', en: 'Contact' },
  sMessage: { he: 'ההודעה שלהם', en: 'Their message' },
  sSummary: { he: 'הסיכום המלא (כפי שנשלח)', en: 'Full summary (as sent)' },
  sTech: { he: 'מאיפה הגיעו', en: 'Where they came from' },
  sNotes: { he: 'הערות שלך', en: 'Your notes' },
  notesPh: { he: 'למשל: דיברנו ביום ראשון, שולח הצעת מחיר עד חמישי…', en: 'e.g. Spoke on Sunday, sending a quote by Thursday…' },
  notesHint: { he: 'רק אתה רואה את זה.', en: 'Only you can see this.' },
  saveNotes: { he: 'שמירת ההערות', en: 'Save notes' },
  notesSaved: { he: 'ההערות נשמרו', en: 'Notes saved' },
  status: { he: 'סטטוס', en: 'Status' },
  statusSaved: { he: 'הסטטוס עודכן: {s}', en: 'Status updated: {s}' },
  markContacted: { he: 'לסמן "נוצר קשר"?', en: 'Mark as contacted?' },
  markYes: { he: 'כן, לסמן', en: 'Yes, mark it' },
  copySummary: { he: 'העתקת הסיכום', en: 'Copy summary' },
  del: { he: 'מחיקת הפנייה', en: 'Delete inquiry' },
  delTitle: { he: 'למחוק את הפנייה של {n}?', en: 'Delete the inquiry from {n}?' },
  delText: { he: 'הפרטים יימחקו לצמיתות.', en: 'The details will be permanently deleted.' },
  deleted: { he: 'הפנייה נמחקה', en: 'Inquiry deleted' },
  notFound: { he: 'הפנייה לא נמצאה', en: 'Inquiry not found' },
  close: { he: 'סגירה', en: 'Close' },
  f: {
    event: { he: 'סוג אירוע', en: 'Event type' },
    date: { he: 'תאריך', en: 'Date' },
    venue: { he: 'מקום', en: 'Venue' },
    guests: { he: 'אורחים', en: 'Guests' },
    package: { he: 'חבילה', en: 'Package' },
    addons: { he: 'תוספות', en: 'Add-ons' },
    budget: { he: 'תקציב', en: 'Budget' },
    phone: { he: 'טלפון', en: 'Phone' },
    email: { he: 'אימייל', en: 'Email' },
    pref: { he: 'מעדיפים', en: 'Prefers' },
    source: { he: 'הגיעו דרך', en: 'Heard via' },
    lang: { he: 'שפה', en: 'Language' },
    page: { he: 'עמוד', en: 'Page' },
    referrer: { he: 'הפניה', en: 'Referrer' },
    utm: { he: 'קמפיין', en: 'Campaign' },
    country: { he: 'מדינה', en: 'Country' },
  },
  langName: { he: { he: 'עברית', en: 'Hebrew' }, en: { he: 'אנגלית', en: 'English' } },
  greeting: {
    he: 'היי {first}, כאן מושיק הצלם 📸\nתודה על הפנייה לגבי {phrase}{date}!\nאשמח לספר עוד ולשמוע מה אתם מתכננים — מתי נוח לדבר?',
    en: 'Hi {first}, it’s Moshik the photographer 📸\nThank you for reaching out about {phrase}{date}!\nI’d love to hear more about your plans — when is a good time to talk?',
  },
  mailSubject: { he: 'בהמשך לפנייה שלך — מושיק צילום', en: 'Following up on your inquiry — Moshik Photography' },
};

/** Event noun used inside the reply message ("about your wedding"). */
const PHRASE: Record<string, { he: string; en: string }> = {
  weddings: { he: 'החתונה', en: 'your wedding' },
  'bar-bat-mitzvah': { he: 'בר/בת המצווה', en: 'the bar/bat mitzvah' },
  events: { he: 'האירוע', en: 'your celebration' },
  couples: { he: 'צילומי הזוגיות', en: 'your couple session' },
  portraits: { he: 'צילומי המשפחה', en: 'your family session' },
  corporate: { he: 'האירוע העסקי', en: 'your corporate event' },
};

let leads: Lead[] = [];
let cursor: string | undefined;
let filter: Filter = 'all';
let query = '';
let loading = false;
let loaded = false;
let loadError: unknown = null;
let wired = false;
let openLead: Lead | null = null;
let notesDirty = false;

/* ─────────────────────────────── helpers ─────────────────────────────── */

const leadLang = (l: Lead): Lang => (l.lang === 'en' ? 'en' : 'he');
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';

export function replyText(l: Lead): string {
  const ll = leadLang(l);
  const phrase = PHRASE[l.eventType] ? PHRASE[l.eventType]![ll] : ll === 'he' ? 'האירוע' : 'your event';
  const date = l.date && isYmd(l.date) ? (ll === 'he' ? ` ב־${fmtDay(l.date, { day: 'numeric', month: 'long' }, 'he')}` : ` on ${fmtDay(l.date, { day: 'numeric', month: 'long' }, 'en')}`) : '';
  return TL(S.greeting, ll, { first: firstName(l.name), phrase, date });
}

function statusChip(s: LeadStatus) {
  return h('span', { class: `adm-lstatus adm-lstatus--${s}` }, h('span', { class: 'adm-lstatus__dot', 'aria-hidden': 'true' }), T(leadStatusLabel[s]));
}

function dateLine(l: Lead): string {
  if (!l.date || !isYmd(l.date)) return l.dateFlexible ? T(S.flexible) : T(S.noDate);
  const d = daysUntil(l.date);
  const rel = d < 0 ? T(S.passed) : d === 0 ? T(S.today) : d === 1 ? T(S.tomorrow) : T(S.inDays, { n: fmtNumber(d) });
  return `${fmtDay(l.date, { day: 'numeric', month: 'short', year: 'numeric' })} · ${rel}`;
}

function updateBadge() {
  const n = leads.filter((l) => l.status === 'new').length;
  $$('[data-leads-badge]').forEach((b) => {
    b.hidden = n === 0;
    b.textContent = n > 9 ? '9+' : String(n);
    b.setAttribute('aria-label', T({ he: '{n} פניות חדשות', en: '{n} new inquiries' }, { n }));
  });
}

function matches(l: Lead) {
  if (filter !== 'all' && l.status !== filter) return false;
  if (!query) return true;
  const q = query.toLowerCase();
  return [l.name, l.phone, l.email, l.venue, l.message, l.notes, label('event', l.eventType)].some((v) => (v ?? '').toLowerCase().includes(q));
}

/* ──────────────────────────────── list ──────────────────────────────── */

function row(l: Lead) {
  const event = label('event', l.eventType);
  const pref = l.contactPref === 'phone' ? 'phone' : l.contactPref === 'email' ? 'mail' : 'whatsapp';
  return h(
    'li',
    null,
    h(
      'button',
      { type: 'button', class: `adm-lead${l.status === 'new' ? ' is-new' : ''}`, 'data-lead': l.id, 'aria-label': T(S.open, { n: l.name }) },
      statusChip(l.status),
      h(
        'span',
        { class: 'adm-lead__main' },
        h('span', { class: 'adm-lead__name', dir: 'auto' }, l.name || '—'),
        h('span', { class: 'adm-lead__event' }, [event, dateLine(l), l.venue].filter(Boolean).join(' · ')),
      ),
      h(
        'span',
        { class: 'adm-lead__side' },
        h('span', { class: 'adm-lead__time', title: fmtDateTime(l.createdAt) }, relTime(l.createdAt)),
        h('span', { class: 'adm-lead__pref', title: label('contact', l.contactPref) }, icon(pref, 15)),
      ),
    ),
  );
}

function render() {
  const list = $('[data-leads-list]');
  const more = $<HTMLButtonElement>('[data-leads-more]');
  list.setAttribute('aria-busy', String(loading && !loaded));
  if (!loaded) {
    more.hidden = true;
    if (loadError) list.replaceChildren(errorState(errorText(loadError), () => void load(true)));
    else list.replaceChildren(...skeletons(5, 'adm-skel--row'));
    return;
  }
  const counts: Record<Filter, number> = { all: leads.length, new: 0, contacted: 0, booked: 0, lost: 0 };
  for (const l of leads) counts[l.status] = (counts[l.status] ?? 0) + 1;
  $$<HTMLButtonElement>('[data-lead-filter] [data-filter]').forEach((b) => {
    const f = b.dataset.filter as Filter;
    b.setAttribute('aria-pressed', String(f === filter));
    const c = b.querySelector('[data-chip-count]');
    if (c) c.textContent = fmtNumber(counts[f]);
  });
  $('[data-leads-summary]').textContent = leads.length
    ? [plural(leads.length, S.summaryAll), counts.new ? plural(counts.new, S.summaryNew) : ''].filter(Boolean).join(' · ')
    : '';
  $('[data-leads-toolbar]').hidden = !leads.length;
  more.hidden = !cursor;
  if (!leads.length) {
    list.replaceChildren(emptyState({ icon: 'inbox', title: T(S.emptyTitle), text: T(S.emptyText) }));
    return;
  }
  const shown = leads.filter(matches);
  if (!shown.length) {
    list.replaceChildren(
      emptyState({
        icon: 'search',
        title: T(S.noMatch),
        action: h(
          'button',
          {
            type: 'button',
            class: 'btn btn--sm',
            onclick: () => {
              filter = 'all';
              query = '';
              $<HTMLInputElement>('[data-lead-search]').value = '';
              render();
            },
          },
          T(S.showAll),
        ),
      }),
    );
    return;
  }
  list.replaceChildren(h('ul', { class: 'adm-leads', role: 'list' }, ...shown.map(row)));
}

let inflight: Promise<void> | null = null;

function load(reset = false): Promise<void> {
  inflight ??= fetchLeads(reset).finally(() => (inflight = null));
  return inflight;
}

async function fetchLeads(reset: boolean) {
  loading = true;
  if (reset) {
    loadError = null;
    if (!loaded) render();
  }
  const btn = $<HTMLButtonElement>('[data-leads-more]');
  if (!reset) setBusy(btn, true);
  try {
    const url = reset || !cursor ? '/api/admin/leads' : `/api/admin/leads?cursor=${encodeURIComponent(cursor)}`;
    const res = await api<{ ok: true; leads: Lead[]; cursor?: string }>(url);
    const incoming = res.leads ?? [];
    if (reset) leads = incoming;
    else {
      const seen = new Set(leads.map((l) => l.id));
      leads = [...leads, ...incoming.filter((l) => !seen.has(l.id))];
    }
    cursor = res.cursor || undefined;
    loaded = true;
    loadError = null;
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 401)) {
      if (!loaded) loadError = e;
      else toastError(errorText(e));
    }
  } finally {
    loading = false;
    setBusy(btn, false);
    updateBadge();
    render();
  }
}

export function refreshLeadBadge() {
  return load(true);
}

/* ─────────────────────────────── drawer ─────────────────────────────── */

async function patchLead(l: Lead, body: { status?: LeadStatus; notes?: string }) {
  const res = await api<{ ok: true; lead: Lead }>(`/api/admin/leads/${encodeURIComponent(l.id)}`, { method: 'PATCH', body });
  const updated = { ...l, ...body, ...(res.lead ?? {}) };
  leads = leads.map((x) => (x.id === l.id ? updated : x));
  if (openLead?.id === l.id) openLead = updated;
  updateBadge();
  render();
  return updated;
}

function field(name: string, value: string | HTMLElement | null | undefined, opts: { ltr?: boolean } = {}) {
  if (!value) return null;
  return h('div', { class: 'adm-dl__row' }, h('dt', null, name), h('dd', { dir: opts.ltr ? 'ltr' : 'auto', class: opts.ltr ? 'adm-dl__ltr' : undefined }, value));
}

function section(title: string, ...children: (HTMLElement | null)[]) {
  const content = children.filter(Boolean) as HTMLElement[];
  if (!content.length) return null;
  return h('section', { class: 'adm-drawer__section' }, h('h3', { class: 'adm-drawer__h' }, title), ...content);
}

function renderDrawer(l: Lead) {
  const dlg = $<HTMLDialogElement>('[data-lead-drawer]');
  const titleId = nextId('lead');
  dlg.setAttribute('aria-labelledby', titleId);
  const reply = replyText(l);
  const wa = waLink(l.phone, reply);
  const tel = telHref(l.phone);
  const mail = l.email ? `mailto:${l.email}?subject=${encodeURIComponent(TL(S.mailSubject, leadLang(l)))}&body=${encodeURIComponent(reply)}` : '';
  const afterContact = () => {
    if (l.status !== 'new') return;
    window.setTimeout(
      () =>
        toast(T(S.markContacted), {
          type: 'info',
          duration: 9000,
          action: {
            label: T(S.markYes),
            run: () => {
              const cur = leads.find((x) => x.id === l.id);
              if (cur) void patchLead(cur, { status: 'contacted' }).then((u) => openLead?.id === u.id && renderDrawer(u));
            },
          },
        }),
      600,
    );
  };

  const statusGroup = h(
    'div',
    { class: 'adm-seg', role: 'group', 'aria-label': T(S.status) },
    ...STATUSES.map((s) =>
      h(
        'button',
        {
          type: 'button',
          class: `adm-seg__btn adm-seg__btn--${s}`,
          'aria-pressed': String(l.status === s),
          onclick: async (e: Event) => {
            if (l.status === s) return;
            const btn = e.currentTarget as HTMLButtonElement;
            setBusy(btn, true);
            try {
              const u = await patchLead(l, { status: s });
              renderDrawer(u);
              toast(T(S.statusSaved, { s: T(leadStatusLabel[s]) }), { duration: 2500 });
            } catch (err) {
              toastError(errorText(err));
              setBusy(btn, false);
            }
          },
        },
        T(leadStatusLabel[s]),
      ),
    ),
  );

  const notes = h('textarea', { class: 'textarea adm-notes', rows: '4', placeholder: T(S.notesPh), dir: 'auto', 'aria-label': T(S.sNotes) });
  notes.value = l.notes ?? '';
  notesDirty = false;
  const saveNotes = h('button', { type: 'button', class: 'btn btn--sm btn--solid', disabled: true }, T(S.saveNotes));
  notes.addEventListener('input', () => {
    notesDirty = notes.value !== (l.notes ?? '');
    saveNotes.disabled = !notesDirty;
  });
  const doSaveNotes = async () => {
    if (!notesDirty) return;
    setBusy(saveNotes, true);
    try {
      const u = await patchLead(l, { notes: notes.value.trim() });
      l = u;
      notesDirty = false;
      toast(T(S.notesSaved), { duration: 2500 });
    } catch (err) {
      toastError(errorText(err));
    } finally {
      setBusy(saveNotes, false);
      saveNotes.disabled = !notesDirty;
    }
  };
  saveNotes.addEventListener('click', () => void doSaveNotes());
  (dlg as HTMLDialogElement & { saveNotes?: () => Promise<void> }).saveNotes = doSaveNotes;

  const addons = (l.addons ?? []).map((a) => label('addon', a)).join(', ');
  const utm = l.utm && Object.keys(l.utm).length ? Object.entries(l.utm).map(([k, v]) => `${k.replace(/^utm_/, '')}: ${v}`).join(' · ') : '';
  const dateValue =
    l.date && isYmd(l.date)
      ? h(
          'span',
          { class: 'adm-dl__date' },
          h('span', null, fmtDay(l.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })),
          h('span', { class: 'adm-muted', lang: 'he', dir: 'rtl' }, hebrewDate(l.date)),
          h('span', { class: 'adm-muted' }, dateLine(l).split(' · ')[1] ?? ''),
          l.dateFlexible ? h('span', { class: 'adm-muted' }, T(S.flexible)) : null,
        )
      : l.dateFlexible
        ? T(S.flexible)
        : null;

  const box = h(
    'div',
    { class: 'adm-drawer__box' },
    h(
      'header',
      { class: 'adm-drawer__head' },
      h(
        'div',
        { class: 'adm-drawer__title-wrap' },
        statusChip(l.status),
        h('h2', { class: 'adm-drawer__title', id: titleId, dir: 'auto' }, l.name || '—'),
        h('p', { class: 'adm-drawer__meta', title: fmtDateTime(l.createdAt) }, T(S.received, { t: relTime(l.createdAt) }), ' · ', label('event', l.eventType)),
      ),
      h('button', { type: 'button', class: 'adm-iconbtn', 'aria-label': T(S.close), onclick: () => dlg.close() }, icon('x', 20)),
    ),
    h(
      'div',
      { class: 'adm-drawer__actions' },
      l.phone ? h('a', { class: 'btn btn--sm btn--solid adm-wa', href: wa, target: '_blank', rel: 'noopener', onclick: afterContact }, icon('whatsapp', 18), T(S.whatsapp)) : null,
      tel ? h('a', { class: 'btn btn--sm', href: tel, onclick: afterContact }, icon('phone', 16), T(S.call)) : null,
      mail ? h('a', { class: 'btn btn--sm', href: mail, onclick: afterContact }, icon('mail', 16), T(S.email)) : null,
    ),
    h('div', { class: 'adm-drawer__status' }, statusGroup),
    h(
      'div',
      { class: 'adm-drawer__body', 'data-lenis-prevent': '' },
      section(
        T(S.sEvent),
        h(
          'dl',
          { class: 'adm-dl' },
          field(T(S.f.event), label('event', l.eventType)),
          field(T(S.f.date), dateValue),
          field(T(S.f.venue), l.venue),
          field(T(S.f.guests), label('guests', l.guests)),
          field(T(S.f.package), label('package', l.package)),
          field(T(S.f.addons), addons),
          field(T(S.f.budget), label('budget', l.budget)),
        ),
      ),
      section(
        T(S.sContact),
        h(
          'dl',
          { class: 'adm-dl' },
          field(T(S.f.phone), l.phone ? h('a', { href: tel || '#', class: 'adm-link' }, displayPhone(l.phone)) : null, { ltr: true }),
          field(T(S.f.email), l.email ? h('a', { href: `mailto:${l.email}`, class: 'adm-link' }, l.email) : null, { ltr: true }),
          field(T(S.f.pref), label('contact', l.contactPref)),
          field(T(S.f.lang), T(S.langName[leadLang(l)])),
          field(T(S.f.source), label('source', l.source)),
        ),
      ),
      l.message ? section(T(S.sMessage), h('blockquote', { class: 'adm-quote', dir: 'auto' }, l.message)) : null,
      section(
        T(S.sNotes),
        notes,
        h('div', { class: 'adm-drawer__notes-foot' }, h('span', { class: 'adm-muted' }, T(S.notesHint)), saveNotes),
      ),
      l.summary
        ? h(
            'details',
            { class: 'adm-drawer__details' },
            h('summary', null, T(S.sSummary)),
            h('pre', { class: 'adm-pre', dir: 'auto' }, l.summary),
            h('button', { type: 'button', class: 'btn btn--sm', onclick: () => void copyWithToast(l.summary ?? '') }, icon('copy', 16), T(S.copySummary)),
          )
        : null,
      l.page || l.referrer || utm || l.country
        ? h(
            'details',
            { class: 'adm-drawer__details' },
            h('summary', null, T(S.sTech)),
            h(
              'dl',
              { class: 'adm-dl adm-dl--small' },
              field(T(S.f.page), l.page, { ltr: true }),
              field(T(S.f.referrer), l.referrer, { ltr: true }),
              field(T(S.f.utm), utm, { ltr: true }),
              field(T(S.f.country), l.country, { ltr: true }),
            ),
          )
        : null,
    ),
    h(
      'footer',
      { class: 'adm-drawer__foot' },
      h(
        'button',
        {
          type: 'button',
          class: 'adm-linkbtn adm-linkbtn--danger',
          onclick: async () => {
            const ok = await confirmDialog({ title: T(S.delTitle, { n: iso(l.name) }), message: T(S.delText), confirm: T(S.del), danger: true });
            if (!ok) return;
            try {
              await api(`/api/admin/leads/${encodeURIComponent(l.id)}`, { method: 'DELETE' });
              leads = leads.filter((x) => x.id !== l.id);
              notesDirty = false;
              dlg.close();
              updateBadge();
              render();
              toast(T(S.deleted));
            } catch (err) {
              toastError(errorText(err));
            }
          },
        },
        icon('trash2', 16),
        T(S.del),
      ),
    ),
  );
  dlg.replaceChildren(box);
}

function openDrawer(id: string) {
  const l = leads.find((x) => x.id === id);
  if (!l) {
    toast(T(S.notFound), { type: 'error' });
    replaceHash(routes.inquiries());
    return;
  }
  openLead = l;
  renderDrawer(l);
  const dlg = $<HTMLDialogElement>('[data-lead-drawer]');
  openDialog(dlg, dlg.querySelector<HTMLElement>('.adm-drawer__actions a, .adm-drawer__head button'));
}

function wire() {
  if (wired) return;
  wired = true;
  $('[data-leads-list]').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-lead]');
    if (b) go(routes.inquiries(b.dataset.lead));
  });
  $('[data-leads-more]').addEventListener('click', () => void load(false));
  $('[data-leads-refresh]').addEventListener('click', () => void load(true));
  $('[data-lead-filter]').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-filter]');
    if (!b) return;
    filter = b.dataset.filter as Filter;
    render();
  });
  const search = $<HTMLInputElement>('[data-lead-search]');
  search.addEventListener('input', () => {
    query = search.value.trim();
    render();
  });
  const dlg = $<HTMLDialogElement>('[data-lead-drawer]');
  dlg.addEventListener('close', () => {
    const save = (dlg as HTMLDialogElement & { saveNotes?: () => Promise<void> }).saveNotes;
    if (notesDirty && save) void save(); // never lose a note: save on close
    openLead = null;
    if (/^#\/inquiries\/.+/.test(location.hash)) replaceHash(routes.inquiries());
    // Return focus to the row that opened the drawer.
    const id = (dlg as HTMLDialogElement & { leadId?: string }).leadId;
    if (id) $$<HTMLButtonElement>(`[data-lead="${CSS.escape(id)}"]`)[0]?.focus();
  });
}

export const inquiriesView: View = {
  mount(route, entered) {
    wire();
    if (route.view !== 'inquiries') return;
    const show = () => {
      if (route.id) {
        (($('[data-lead-drawer]') as HTMLDialogElement & { leadId?: string }).leadId = route.id);
        openDrawer(route.id);
      } else {
        const dlg = $<HTMLDialogElement>('[data-lead-drawer]');
        if (dlg.open) dlg.close();
      }
    };
    if (entered || !loaded) void load(true).then(show);
    else show();
  },
  unmount() {
    const dlg = $<HTMLDialogElement>('[data-lead-drawer]');
    if (dlg.open) dlg.close();
  },
};
