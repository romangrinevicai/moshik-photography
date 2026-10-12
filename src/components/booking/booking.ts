import { loadAvailability, statusFor, formatLongDate, type Availability } from '~/scripts/availability';
import { whatsappLinkClient } from '~/scripts/wa';
import { track } from '~/scripts/core';
import { site } from '~/config/site';
import { STATIC_SITE } from '~/config/base';

interface Config {
  lang: 'he' | 'en';
  tiers: Record<string, { id: string; label: string }[]>;
  addons: Record<string, string[]>;
  addonLabels: Record<string, string>;
  eventLabels: Record<string, string>;
  strings: Record<string, string> & { avail: Record<string, string> };
  fallback: Availability;
  thankYou: string;
  turnstile: string;
}

const LABELS = {
  he: {
    intro: 'פנייה חדשה מהאתר 📸',
    event: 'אירוע', date: 'תאריך', flexible: 'גמיש / טרם נקבע', venue: 'מקום', guests: 'אורחים', package: 'חבילה',
    addons: 'תוספות', budget: 'תקציב', name: 'שם', phone: 'טלפון', email: 'אימייל', prefer: 'העדפת קשר', source: 'הגיעו דרך', message: 'הודעה',
    subject: 'פנייה חדשה מהאתר',
  },
  en: {
    intro: 'New inquiry from the website 📸',
    event: 'Event', date: 'Date', flexible: 'Flexible / not set', venue: 'Venue', guests: 'Guests', package: 'Package',
    addons: 'Add-ons', budget: 'Budget', name: 'Name', phone: 'Phone', email: 'Email', prefer: 'Prefers', source: 'Heard via', message: 'Message',
    subject: 'New inquiry from the website',
  },
};

export const isValidPhone = (v: string) => {
  const digits = v.replace(/[\s\-().]/g, '');
  return /^\+?\d{9,15}$/.test(digits);
};
export const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

export function initBookingForm() {
  document.querySelectorAll<HTMLElement>('[data-booking]').forEach(setup);
}

function setup(root: HTMLElement) {
  const cfg = JSON.parse(root.dataset.config!) as Config;
  const S = cfg.strings;
  const L = LABELS[cfg.lang];
  const form = root.querySelector<HTMLFormElement>('[data-form]')!;
  const steps = [...form.querySelectorAll<HTMLFieldSetElement>('[data-step]')];
  const dots = [...root.querySelectorAll<HTMLElement>('[data-dot]')];
  const bar = root.querySelector<HTMLElement>('[data-bar]')!;
  const announce = root.querySelector<HTMLElement>('[data-step-announce]')!;
  const btnNext = form.querySelector<HTMLButtonElement>('[data-next]')!;
  const btnBack = form.querySelector<HTMLButtonElement>('[data-back]')!;
  const btnSubmit = form.querySelector<HTMLButtonElement>('[data-submit]')!;
  const pkgSelect = form.querySelector<HTMLSelectElement>('[data-package-select]')!;
  const addonsBox = form.querySelector<HTMLElement>('[data-addons]')!;
  const availEl = form.querySelector<HTMLElement>('[data-avail]')!;
  const dateInput = form.elements.namedItem('date') as HTMLInputElement;
  let current = 0;

  (form.elements.namedItem('startedAt') as HTMLInputElement).value = String(Date.now());
  dateInput.min = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());

  const value = (name: string) => {
    const el = form.elements.namedItem(name);
    if (!el) return '';
    if (el instanceof RadioNodeList) return el.value;
    if (el instanceof HTMLInputElement && el.type === 'checkbox') return el.checked ? el.value : '';
    return (el as HTMLInputElement).value.trim();
  };

  const setError = (name: string, msg: string) => {
    const p = form.querySelector<HTMLElement>(`[data-error-for="${name}"]`);
    if (p) p.textContent = msg;
    const field = p?.closest('.field');
    field?.classList.toggle('field--invalid', !!msg);
    const input = form.elements.namedItem(name);
    if (input instanceof HTMLElement) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };

  /* ── package & add-on options follow the chosen event type ── */
  const renderOptions = (preselectTier?: string, preselectAddons: string[] = []) => {
    const cat = value('eventType');
    const tiers = cfg.tiers[cat] ?? [];
    pkgSelect.innerHTML = '';
    const none = new Option(S.notSure!, '');
    pkgSelect.add(none);
    tiers.forEach((tr) => pkgSelect.add(new Option(tr.label, `${cat}:${tr.id}`)));
    if (preselectTier) pkgSelect.value = `${cat}:${preselectTier}`;
    addonsBox.innerHTML = '';
    (cfg.addons[cat] ?? []).forEach((id) => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = 'addons';
      input.value = id;
      input.checked = preselectAddons.includes(id);
      const span = document.createElement('span');
      span.textContent = cfg.addonLabels[id] ?? id;
      label.append(input, span);
      addonsBox.append(label);
    });
    addonsBox.closest('.field')!.toggleAttribute('hidden', !(cfg.addons[cat] ?? []).length);
  };

  /* ── prefill from the URL (?type, ?date, ?package=cat:tier, ?addons=a,b) ── */
  const params = new URLSearchParams(location.search);
  const [pkgCat, pkgTier] = (params.get('package') ?? '').split(':');
  const type = params.get('type') ?? pkgCat;
  if (type) {
    const radio = form.querySelector<HTMLInputElement>(`input[name="eventType"][value="${CSS.escape(type)}"]`);
    if (radio) radio.checked = true;
  }
  if (params.get('date')) dateInput.value = params.get('date')!;
  renderOptions(pkgTier, (params.get('addons') ?? '').split(',').filter(Boolean));

  form.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    if (target.name === 'eventType') {
      renderOptions();
      setError('eventType', '');
      // Small delight: picking an event type moves you forward.
      setTimeout(() => current === 0 && go(1), 250);
    }
    if (target.name === 'dateFlexible' && target.checked) setError('date', '');
  });

  /* ── live availability for the chosen date ── */
  const checkDate = async () => {
    const v = dateInput.value;
    if (!v) {
      availEl.textContent = '';
      return;
    }
    const a = await loadAvailability(cfg.fallback);
    const st = statusFor(v, a);
    availEl.dataset.state = st;
    availEl.textContent = S.avail[st] ?? '';
    setError('date', '');
  };
  dateInput.addEventListener('change', checkDate);
  if (dateInput.value) checkDate();

  /* ── steps ── */
  const validate = (i: number): boolean => {
    let ok = true;
    if (i === 0 && !value('eventType')) {
      setError('eventType', S.pick!);
      ok = false;
    }
    if (i === 1 && !value('date') && !value('dateFlexible')) {
      setError('date', S.dateErr!);
      ok = false;
    }
    if (i === 3) {
      const name = value('name');
      const phone = value('phone');
      const email = value('email');
      setError('name', name.length >= 2 ? '' : S.required!);
      setError('phone', !phone ? S.required! : isValidPhone(phone) ? '' : S.phoneErr!);
      setError('email', !email || isValidEmail(email) ? '' : S.emailErr!);
      setError('consent', value('consent') ? '' : S.consentErr!);
      ok = name.length >= 2 && isValidPhone(phone) && (!email || isValidEmail(email)) && !!value('consent');
    }
    if (!ok) form.querySelector<HTMLElement>('.field--invalid input, .field--invalid select, [aria-invalid="true"]')?.focus();
    return ok;
  };

  const go = (i: number, initial = false) => {
    current = Math.max(0, Math.min(steps.length - 1, i));
    steps.forEach((s, k) => {
      s.hidden = k !== current;
      s.classList.toggle('is-active', k === current);
    });
    dots.forEach((d, k) => {
      d.classList.toggle('is-active', k === current);
      d.classList.toggle('is-done', k < current);
    });
    bar.style.inlineSize = `${((current + 1) / steps.length) * 100}%`;
    btnBack.hidden = current === 0;
    btnNext.hidden = current === steps.length - 1;
    btnSubmit.hidden = current !== steps.length - 1;
    if (initial) return;
    announce.textContent = S.stepOf!.replace('{n}', String(current + 1));
    const top = root.getBoundingClientRect().top;
    if (top < 0) root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    steps[current]?.querySelector<HTMLElement>('input:not([type="hidden"]), select, textarea')?.focus({ preventScroll: true });
    track('booking_step', { step: current + 1 });
  };

  btnNext.addEventListener('click', () => validate(current) && go(current + 1));
  btnBack.addEventListener('click', () => go(current - 1));
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA' && current < steps.length - 1) {
      e.preventDefault();
      if (validate(current)) go(current + 1);
    }
  });

  /* ── summary text, used for the WhatsApp / email fallback and thank-you page ── */
  const summary = () => {
    const addons = [...form.querySelectorAll<HTMLInputElement>('input[name="addons"]:checked')].map((a) => cfg.addonLabels[a.value] ?? a.value);
    const pkgLabel = pkgSelect.selectedOptions[0]?.textContent ?? '';
    const lines: [string, string][] = [
      [L.event, cfg.eventLabels[value('eventType')] ?? value('eventType')],
      [L.date, value('date') ? formatLongDate(value('date'), cfg.lang) + (value('dateFlexible') ? ` (${L.flexible})` : '') : L.flexible],
      [L.venue, value('venue')],
      [L.guests, (form.elements.namedItem('guests') as HTMLSelectElement).selectedOptions[0]?.textContent?.replace('—', '') ?? ''],
      [L.package, value('package') ? pkgLabel : ''],
      [L.addons, addons.join(', ')],
      [L.budget, value('budget') ? ((form.elements.namedItem('budget') as HTMLSelectElement).selectedOptions[0]?.textContent ?? '') : ''],
      [L.name, value('name')],
      [L.phone, value('phone')],
      [L.email, value('email')],
      [L.message, value('message')],
    ];
    return [L.intro, ...lines.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`)].join('\n');
  };

  /* ── submit ── */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate(3)) return;
    btnSubmit.disabled = true;
    const label = btnSubmit.querySelector('[data-submit-label]')!;
    label.textContent = S.sending!;
    const payload = {
      lang: cfg.lang,
      eventType: value('eventType'),
      date: value('date'),
      dateFlexible: !!value('dateFlexible'),
      venue: value('venue'),
      guests: value('guests'),
      package: value('package'),
      addons: [...form.querySelectorAll<HTMLInputElement>('input[name="addons"]:checked')].map((a) => a.value),
      budget: value('budget'),
      name: value('name'),
      phone: value('phone'),
      email: value('email'),
      contactPref: value('contactPref'),
      source: value('source'),
      message: value('message'),
      company: value('company'),
      startedAt: Number(value('startedAt')),
      page: location.pathname,
      referrer: document.referrer.slice(0, 300),
      utm: Object.fromEntries([...params].filter(([k]) => k.startsWith('utm_'))),
      turnstileToken: (form.querySelector<HTMLInputElement>('[name="cf-turnstile-response"]')?.value ?? ''),
      summary: summary(),
    };
    try {
      if (STATIC_SITE) throw new Error('no backend');
      const res = await fetch('/api/inquiry', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(String(res.status));
      track('generate_lead', { event_type: payload.eventType });
      try {
        sessionStorage.setItem('moshik-inquiry', JSON.stringify({ name: payload.name, summary: payload.summary }));
      } catch {
        /* ignore */
      }
      location.href = cfg.thankYou;
    } catch {
      const fail = root.querySelector<HTMLElement>('[data-fail]')!;
      fail.hidden = false;
      fail.querySelector<HTMLAnchorElement>('[data-fail-wa]')!.href = whatsappLinkClient(payload.summary);
      fail.querySelector<HTMLAnchorElement>('[data-fail-mail]')!.href = `mailto:${site.contact.email}?subject=${encodeURIComponent(L.subject)}&body=${encodeURIComponent(payload.summary)}`;
      fail.scrollIntoView({ behavior: 'smooth', block: 'center' });
      btnSubmit.disabled = false;
      label.textContent = S.submit!;
      track('booking_fallback');
    }
  });

  go(type ? (params.get('date') ? 2 : 1) : 0, true);
}
