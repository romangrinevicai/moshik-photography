/** Faces tab: run on-device face analysis, show results and the people found. */
import type { GalleryManifest, Person } from '~/shared/gallery-types';
import { api, errorText, isAbort } from '../core/api';
import { $, h, icon, setChildren } from '../core/dom';
import { T, fmtNumber, lang, plural } from '../core/i18n';
import { confirmDialog, holdUnload, keepAwake, setBusy, toast, toastError } from '../core/ui';
import { uploads } from '../upload/queue';
import { ed, emit, enc, galleryApi, on, patchGallery, syncNow } from './state';

const S = {
  notYet: { he: 'עוד לא נסרקו פנים בגלריה הזאת.', en: 'Faces haven’t been analysed in this gallery yet.' },
  result: { he: 'פנים שזוהו: {f} · אנשים שמופיעים ביותר מתמונה אחת: {p}', en: '{f} found · {p} appearing in more than one photo' },
  faces: { he: ['פנים אחד', '{n} פנים'], en: ['1 face', '{n} faces'] } as { he: [string, string]; en: [string, string] },
  people: { he: ['אדם אחד', '{n} אנשים'], en: ['1 person', '{n} people'] } as { he: [string, string]; en: [string, string] },
  stale: { he: 'נוספו תמונות מאז הסריקה האחרונה — כדאי לסרוק שוב כדי שגם הן יימצאו.', en: 'Photos were added since the last scan — scan again so they can be found too.' },
  run: { he: 'סריקת פנים', en: 'Analyse faces' },
  rerun: { he: 'סריקה מחדש', en: 'Analyse again' },
  noPhotos: { he: 'קודם מעלים תמונות, ואז סורקים.', en: 'Upload photos first, then analyse.' },
  waitUploads: { he: 'אפשר לסרוק כשההעלאה תסתיים.', en: 'You can analyse once the upload finishes.' },
  stage: {
    models: { he: 'טוען את מודל זיהוי הפנים…', en: 'Loading the face recognition model…' },
    detect: { he: 'מחפש פנים בתמונות', en: 'Finding faces in the photos' },
    cluster: { he: 'מקבץ יחד תמונות של אותו אדם…', en: 'Grouping photos of the same person…' },
    upload: { he: 'שומר את התוצאות…', en: 'Saving the results…' },
    publish: { he: 'מעדכן את הגלריה…', en: 'Updating the gallery…' },
  },
  count: { he: '{d} מתוך {t}', en: '{d} of {t}' },
  keepOpen: { he: 'זה יכול לקחת כמה דקות. אפשר לעבוד בלשונית אחרת — רק לא לסגור את זו.', en: 'This can take a few minutes. Feel free to use another tab — just keep this one open.' },
  done: {
    he: ['הסריקה הסתיימה: זוהה אדם אחד', 'הסריקה הסתיימה: זוהו {n} אנשים'],
    en: ['Done: 1 person recognised', 'Done: {n} people recognised'],
  } as { he: [string, string]; en: [string, string] },
  stopped: { he: 'הסריקה נעצרה. אפשר להמשיך מאותה נקודה בפעם הבאה.', en: 'Analysis stopped. Next time it picks up where it left off.' },
  failTitle: { he: 'הסריקה לא הצליחה להתחיל', en: 'The analysis couldn’t run' },
  failText: {
    he: 'משהו בזיהוי הפנים לא עבד בדפדפן הזה. כדאי לנסות שוב, או להשתמש ב־Chrome / Edge עדכני במחשב.',
    en: 'Something in face recognition didn’t work in this browser. Try again, or use an up-to-date Chrome or Edge on a computer.',
  },
  details: { he: 'פרטים טכניים', en: 'Technical details' },
  turnedOn: { he: 'חיפוש לפי סלפי הופעל', en: 'Selfie search is on' },
  clearTitle: { he: 'למחוק את נתוני הפנים?', en: 'Delete the face data?' },
  clearText: { he: 'האורחים לא יוכלו למצוא את עצמם עם סלפי עד שתסרוק שוב. התמונות עצמן לא נפגעות.', en: 'Guests won’t be able to find themselves with a selfie until you analyse again. The photos themselves are untouched.' },
  clearOk: { he: 'מחיקת נתוני הפנים', en: 'Delete face data' },
  cleared: { he: 'נתוני הפנים נמחקו', en: 'Face data deleted' },
  personAlt: { he: 'אדם {i}', en: 'Person {i}' },
  inPhotos: { he: ['בתמונה אחת', 'ב־{n} תמונות'], en: ['in 1 photo', 'in {n} photos'] } as { he: [string, string]; en: [string, string] },
  peopleEmpty: { he: 'לא נמצאו אנשים שמופיעים ביותר מתמונה אחת.', en: 'No one appears in more than one photo.' },
  peopleError: { he: 'לא הצלחתי לטעון את רשימת האנשים.', en: 'Couldn’t load the people list.' },
  morePeople: { he: 'ועוד {n}', en: '+{n} more' },
};

let wired = false;
let controller: AbortController | null = null;
let running = false;
let peopleFor = '';
/** Photo count at the time of the last analysis in this session (to hint a re-scan). */
const analysedCount = new Map<string, number>();

function render() {
  const st = ed.state;
  if (!st) return;
  const enabled = !!st.gallery.faceSearch;
  $('[data-fx-off]').hidden = enabled;
  $('[data-fx-on]').hidden = !enabled;
  if (!enabled) {
    $('[data-fx-people]').hidden = true;
    return;
  }
  const f = st.faces;
  const summary = $('[data-fx-summary]');
  if (f) {
    summary.dataset.state = 'done';
    summary.replaceChildren(icon('badge-check', 20), h('span', null, T(S.result, lang === 'he' ? { f: fmtNumber(f.faces), p: fmtNumber(f.people) } : { f: plural(f.faces, S.faces), p: plural(f.people, S.people) })));
  } else {
    summary.dataset.state = 'none';
    summary.replaceChildren(icon('scan-face', 20), h('span', null, T(S.notYet)));
  }
  const prevCount = analysedCount.get(st.gid);
  const stale = $('[data-fx-stale]');
  stale.hidden = !(f && prevCount !== undefined && st.photos.length > prevCount);
  stale.textContent = stale.hidden ? '' : T(S.stale);

  const btn = $<HTMLButtonElement>('[data-fx-run]');
  const busyUploads = uploads.busy(st.gid);
  btn.disabled = running || !st.photos.length || busyUploads;
  $('[data-fx-run-label]').textContent = T(f ? S.rerun : S.run);
  const why = $('[data-fx-why]');
  why.textContent = !st.photos.length ? T(S.noPhotos) : busyUploads ? T(S.waitUploads) : '';
  why.hidden = !why.textContent || running;
  $('[data-fx-clear]').hidden = !f || running;
  $('[data-fx-people]').hidden = !f;
}

function progress(info: { stage: string; done: number; total: number; message?: string }) {
  const box = $('[data-fx-progress]');
  const stage = (S.stage as Record<string, { he: string; en: string }>)[info.stage];
  $('[data-fx-stage]', box).textContent = stage ? T(stage) : info.message ?? '';
  const pct = info.total > 0 ? Math.round((info.done / info.total) * 100) : 0;
  const bar = $('[data-fx-bar]', box);
  bar.classList.toggle('is-indeterminate', !(info.total > 0));
  bar.setAttribute('aria-valuenow', String(pct));
  bar.querySelector<HTMLElement>('span')!.style.inlineSize = info.total > 0 ? `${pct}%` : '';
  $('[data-fx-count]', box).textContent = info.total > 0 ? T(S.count, { d: fmtNumber(info.done), t: fmtNumber(info.total) }) : '';
}

async function run() {
  const st = ed.state;
  if (!st || running) return;
  const gid = st.gid;
  running = true;
  controller = new AbortController();
  holdUnload('faces', true);
  void keepAwake('faces', true);
  $('[data-fx-error]').hidden = true;
  $('[data-fx-progress]').hidden = false;
  progress({ stage: 'models', done: 0, total: 0 });
  render();
  try {
    const mod = await import('~/scripts/faces');
    const result = await mod.analyzeGallery({
      galleryId: gid,
      photos: st.photos.map((p) => ({ id: p.id, w: p.w, h: p.h })),
      onProgress: progress,
      signal: controller.signal,
      useCache: true,
    });
    if (ed.state?.gid === gid) {
      ed.state.faces = { faces: result.faces, people: result.people };
      analysedCount.set(gid, ed.state.photos.length);
      emit('faces');
    }
    progress({ stage: 'publish', done: 0, total: 0 });
    await syncNow(gid);
    toast(plural(result.people, S.done));
    peopleFor = '';
    if (ed.state?.gid === gid) await loadPeople();
  } catch (e) {
    if (isAbort(e) || controller?.signal.aborted) toast(T(S.stopped), { type: 'info' });
    else if (ed.state?.gid === gid) showError(e);
  } finally {
    running = false;
    controller = null;
    holdUnload('faces', false);
    void keepAwake('faces', false);
    $('[data-fx-progress]').hidden = true;
    render();
  }
}

function showError(e: unknown) {
  const box = $('[data-fx-error]');
  const detail = e instanceof Error ? e.message : String(e);
  box.replaceChildren(
    h('span', { class: 'adm-alert__icon' }, icon('circle-alert', 20)),
    h(
      'div',
      { class: 'adm-alert__body' },
      h('strong', null, T(S.failTitle)),
      h('p', null, T(S.failText)),
      detail ? h('details', { class: 'adm-alert__details' }, h('summary', null, T(S.details)), h('code', { dir: 'ltr' }, detail)) : null,
    ),
  );
  box.hidden = false;
}

async function loadPeople() {
  const st = ed.state;
  if (!st || !st.faces) return;
  if (peopleFor === st.gid) return;
  peopleFor = st.gid;
  const gid = st.gid;
  const grid = $('[data-fx-people-grid]');
  grid.replaceChildren(...Array.from({ length: 8 }, () => h('div', { class: 'adm-skel adm-skel--person', 'aria-hidden': 'true' })));
  try {
    const res = await api<{ ok: true; gallery: GalleryManifest }>(`/api/gallery/${enc(gid)}`);
    if (ed.state?.gid !== gid) return;
    const people: Person[] = (res.gallery.people ?? []).slice().sort((a, b) => b.count - a.count);
    if (!people.length) {
      grid.replaceChildren(h('p', { class: 'adm-muted' }, T(S.peopleEmpty)));
      return;
    }
    const shown = people.slice(0, 48);
    setChildren(
      grid,
      ...shown.map((p, i) =>
        h(
          'figure',
          { class: 'adm-person' },
          p.hasCrop
            ? h('img', { src: `/media/${enc(gid)}/people/${enc(p.id)}`, alt: T(S.personAlt, { i: i + 1 }), loading: 'lazy', decoding: 'async' })
            : h('span', { class: 'adm-person__ph' }, icon('user-round', 26)),
          h('figcaption', null, plural(p.count, S.inPhotos)),
        ),
      ),
      people.length > shown.length ? h('p', { class: 'adm-person__more' }, T(S.morePeople, { n: fmtNumber(people.length - shown.length) })) : null,
    );
  } catch {
    peopleFor = '';
    grid.replaceChildren(h('p', { class: 'adm-muted' }, T(S.peopleError)));
  }
}

export const faces = {
  init() {
    if (wired) return;
    wired = true;
    $('[data-fx-run]').addEventListener('click', () => void run());
    $('[data-fx-cancel]').addEventListener('click', () => controller?.abort());
    $('[data-fx-enable]').addEventListener('click', async (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
      setBusy(btn, true);
      try {
        await patchGallery({ faceSearch: true });
        toast(T(S.turnedOn));
      } catch (err) {
        toastError(errorText(err));
      } finally {
        setBusy(btn, false);
      }
    });
    $('[data-fx-clear]').addEventListener('click', async () => {
      const st = ed.state;
      if (!st) return;
      const ok = await confirmDialog({ title: T(S.clearTitle), message: T(S.clearText), confirm: T(S.clearOk), danger: true });
      if (!ok) return;
      try {
        await api(galleryApi(st.gid, '/faces'), { method: 'DELETE' });
        st.faces = null;
        peopleFor = '';
        emit('faces');
        void syncNow(st.gid);
        toast(T(S.cleared));
      } catch (err) {
        toastError(errorText(err));
      }
    });
    on('gallery', render);
    on('faces', render);
    on('photos', render);
    uploads.addEventListener('change', () => ed.state && !$('[data-ed-panel="faces"]').hidden && render());
  },
  load() {
    if (running) controller?.abort();
    peopleFor = '';
    $('[data-fx-error]').hidden = true;
    $('[data-fx-progress]').hidden = true;
    $('[data-fx-people-grid]').replaceChildren();
    render();
  },
  show() {
    render();
    void loadPeople();
  },
  isRunning: () => running,
  stop() {
    controller?.abort();
  },
};
