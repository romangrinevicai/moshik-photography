/** Upload area (drop zone, file & folder pickers, options) and the progress panel. */
import { $, $$, h, icon } from '../core/dom';
import { T, fmtBytes, fmtDuration, fmtNumber, plural } from '../core/i18n';
import { toast } from '../core/ui';
import { uploads, type UploadItem } from '../upload/queue';
import { focusNewSet } from './sets';
import { ed, on, thumbUrl } from './state';

type Forms = { he: [string, string]; en: [string, string] };

const S = {
  noSet: { he: 'בלי פרק (כל התמונות)', en: 'No chapter (all photos)' },
  newSet: { he: '+ פרק חדש…', en: '+ New chapter…' },
  dupes: {
    he: ['תמונה אחת כבר נמצאת בגלריה — דילגתי עליה', '{n} תמונות כבר נמצאות בגלריה — דילגתי עליהן'],
    en: ['1 photo is already in the gallery — skipped', '{n} photos are already in the gallery — skipped'],
  } as Forms,
  notImages: {
    he: ['קובץ אחד אינו תמונה — דילגתי עליו', '{n} קבצים אינם תמונות — דילגתי עליהם'],
    en: ['1 file isn’t a photo — skipped', '{n} files aren’t photos — skipped'],
  } as Forms,
  raw: {
    he: ['קובץ RAW לא נתמך — צריך לייצא אותו ל־JPG קודם', '{n} קובצי RAW לא נתמכים — צריך לייצא אותם ל־JPG קודם'],
    en: ['RAW files aren’t supported — export it as JPG first', '{n} RAW files aren’t supported — export them as JPG first'],
  } as Forms,
  nothing: { he: 'לא נמצאו תמונות בבחירה הזאת', en: 'No photos found in that selection' },
  dropHere: { he: 'אפשר לשחרר — מתחילים להעלות', en: 'Drop to start uploading' },
  title: {
    running: { he: 'מעלה תמונות…', en: 'Uploading photos…' },
    paused: { he: 'ההעלאה מושהית', en: 'Upload paused' },
    pausing: { he: 'משהה אחרי התמונות שבדרך…', en: 'Pausing after the photos in progress…' },
    done: { he: 'ההעלאה הסתיימה', en: 'Upload complete' },
    doneIssues: { he: 'ההעלאה הסתיימה — חלק מהתמונות לא עלו', en: 'Upload finished — some photos didn’t make it' },
  },
  stats: { he: 'הועלו {done} מתוך {total}', en: '{done} of {total} uploaded' },
  bytes: { he: '{a} מתוך {b}', en: '{a} of {b}' },
  eta: { he: 'נותרו כ־{t}', en: 'about {t} left' },
  keepOpen: { he: 'אפשר להמשיך לעבוד בניהול בזמן ההעלאה — רק לא לסגור את הלשונית.', en: 'You can keep working in the admin while this uploads — just don’t close the tab.' },
  more: { he: 'ממתינות עוד: {q} · הועלו: {d}', en: 'Waiting: {q} · uploaded: {d}' },
  moreDone: { he: 'הועלו עוד: {d}', en: '{d} more uploaded' },
  skippedLine: { he: 'דולגו (כבר בגלריה): {n}', en: 'skipped (already in the gallery): {n}' },
  doneCount: { he: ['תמונה אחת הועלתה', '{n} תמונות הועלו'], en: ['1 photo uploaded', '{n} photos uploaded'] } as Forms,
  failedLine: { he: 'לא הצליחו לעלות: {n}', en: 'failed: {n}' },
  pause: { he: 'השהיה', en: 'Pause' },
  resume: { he: 'המשך', en: 'Resume' },
  cancel: { he: 'ביטול ההעלאה', en: 'Cancel upload' },
  retry: { he: 'ניסיון חוזר לתמונות שנכשלו', en: 'Retry failed photos' },
  clear: { he: 'ניקוי הרשימה', en: 'Clear list' },
  cancelled: { he: 'ההעלאה בוטלה. מה שכבר עלה נשאר בגלריה.', en: 'Upload cancelled. Photos already uploaded stay in the gallery.' },
  status: {
    queued: { he: 'ממתינה', en: 'Waiting' },
    preparing: { he: 'מכינה (הקטנה ובדיקה)…', en: 'Preparing (resizing)…' },
    uploading: { he: 'מעלה {p}%', en: 'Uploading {p}%' },
    retrying: { he: 'ניסיון {n}', en: 'retry {n}' },
    done: { he: 'הועלתה', en: 'Uploaded' },
    origSkipped: { he: 'הועלתה (המקור גדול מ־100MB ולא נשמר)', en: 'Uploaded (original over 100 MB, not kept)' },
    cancelled: { he: 'בוטלה', en: 'Cancelled' },
    duplicate: { he: 'כבר בגלריה — דילגתי', en: 'Already in the gallery — skipped' },
    heic: { he: 'קובץ HEIC שהדפדפן לא פותח — צריך להמיר ל־JPG (או להעלות מ־Safari)', en: 'HEIC this browser can’t open — convert to JPG (or upload from Safari)' },
    raw: { he: 'קובץ RAW — צריך לייצא ל־JPG', en: 'RAW file — export it as JPG' },
    decode: { he: 'לא הצלחתי לקרוא את התמונה', en: 'Couldn’t read this image' },
    'too-large': { he: 'הקובץ גדול מדי לשרת', en: 'Too large for the server' },
    network: { he: 'בעיית חיבור — אפשר לנסות שוב', en: 'Connection problem — try again' },
    server: { he: 'שגיאת שרת — אפשר לנסות שוב', en: 'Server error — try again' },
    auth: { he: 'נותקת — צריך להתחבר ולנסות שוב', en: 'Signed out — sign in and try again' },
    unknown: { he: 'משהו השתבש', en: 'Something went wrong' },
  },
};

let wired = false;
let keepTouched = false;
let lastSet = new Map<string, string>();
const rows = new Map<string, HTMLLIElement>();

/* ─────────────────────────────── adding files ─────────────────────────────── */

function addFiles(files: File[], paths?: Map<File, string>) {
  const st = ed.state;
  if (!st || !files.length) return;
  const set = $<HTMLSelectElement>('[data-up-set]').value;
  const keepOriginals = $<HTMLInputElement>('[data-up-originals]').checked;
  const res = uploads.add(st.gid, files, {
    set: set && set !== '__new__' ? set : undefined,
    keepOriginals,
    existing: st.photos,
    pathOf: paths ? (f) => paths.get(f) ?? f.name : undefined,
  });
  // One calm message for everything that was left out.
  const skipped = [
    res.duplicates ? plural(res.duplicates, S.dupes) : '',
    res.raw ? plural(res.raw, S.raw) : '',
    res.notImages && (res.added || res.duplicates || res.raw) ? plural(res.notImages, S.notImages) : '',
  ].filter(Boolean);
  if (skipped.length) toast(skipped.join('\n'), { type: res.raw ? 'error' : 'info' });
  else if (!res.added) toast(T(S.nothing), { type: 'info' });
  if (res.added) requestAnimationFrame(() => $('[data-queue]').scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
}

/** Files (including whole folders) from a drop. Entries must be read synchronously. */
async function filesFromDrop(dt: DataTransfer): Promise<{ files: File[]; paths: Map<File, string> }> {
  const paths = new Map<File, string>();
  const entries = [...dt.items]
    .filter((i) => i.kind === 'file')
    .map((i) => (typeof i.webkitGetAsEntry === 'function' ? i.webkitGetAsEntry() : null))
    .filter((e): e is FileSystemEntry => !!e);
  if (!entries.length) return { files: [...dt.files], paths };
  const files: File[] = [];
  const walk = async (entry: FileSystemEntry, prefix: string): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej)).catch(() => null);
      if (file) {
        files.push(file);
        paths.set(file, prefix + file.name);
      }
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej)).catch(() => [] as FileSystemEntry[]);
        if (!batch.length) break;
        for (const child of batch) await walk(child, `${prefix}${entry.name}/`);
      }
    }
  };
  for (const e of entries) await walk(e, '');
  return { files, paths };
}

/* ─────────────────────────────── options ─────────────────────────────── */

function renderSetSelect() {
  const st = ed.state;
  const select = $<HTMLSelectElement>('[data-up-set]');
  if (!st) return;
  const remembered = lastSet.get(st.gid) ?? select.value;
  const opts = [h('option', { value: '' }, T(S.noSet)), ...st.gallery.sets.map((s) => h('option', { value: s.id }, s.name)), h('option', { value: '__new__' }, T(S.newSet))];
  select.replaceChildren(...opts);
  select.value = st.gallery.sets.some((s) => s.id === remembered) ? remembered : '';
}

function syncOriginalsDefault() {
  const st = ed.state;
  if (!st || keepTouched) return;
  $<HTMLInputElement>('[data-up-originals]').checked = !!st.gallery.allowOriginals;
}

/* ──────────────────────────────── queue panel ──────────────────────────────── */

function itemStatus(i: UploadItem): string {
  if (i.status === 'uploading') {
    const p = i.total ? Math.min(99, Math.round((i.loaded / i.total) * 100)) : 0;
    return T(S.status.uploading, { p }) + (i.attempts ? ` · ${T(S.status.retrying, { n: i.attempts })}` : '');
  }
  if (i.status === 'done') return T(i.originalSkipped ? S.status.origSkipped : S.status.done);
  if (i.status === 'skipped') return T(S.status.duplicate);
  if (i.status === 'failed') return T(S.status[i.reason && i.reason !== 'duplicate' ? i.reason : 'unknown']);
  return T(S.status[i.status]);
}

function rowFor(i: UploadItem): HTMLLIElement {
  let li = rows.get(i.key);
  if (!li) {
    li = h(
      'li',
      { class: 'adm-qrow' },
      h('span', { class: 'adm-qrow__thumb' }),
      h('span', { class: 'adm-qrow__text' }, h('span', { class: 'adm-qrow__name', dir: 'ltr' }), h('span', { class: 'adm-qrow__status' })),
      h('span', { class: 'adm-qrow__bar', 'aria-hidden': 'true' }, h('span')),
    );
    rows.set(i.key, li);
  }
  li.dataset.status = i.status;
  const thumb = li.querySelector<HTMLElement>('.adm-qrow__thumb')!;
  // Once an image is showing keep it (the local preview stays visible after its URL is revoked).
  if (!thumb.querySelector('img')) {
    const src = i.preview ?? (i.photo ? thumbUrl(i.gid, i.photo.id) : '');
    const glyph = i.status === 'failed' ? 'circle-alert' : 'image';
    if (src) thumb.replaceChildren(h('img', { src, alt: '', decoding: 'async' }));
    else if (thumb.dataset.glyph !== glyph) {
      thumb.dataset.glyph = glyph;
      thumb.replaceChildren(icon(glyph, 18));
    }
  }
  li.querySelector('.adm-qrow__name')!.textContent = i.name;
  li.querySelector('.adm-qrow__status')!.textContent = itemStatus(i);
  const bar = li.querySelector<HTMLElement>('.adm-qrow__bar > span')!;
  bar.style.inlineSize = `${i.status === 'done' ? 100 : i.total ? Math.round((i.loaded / i.total) * 100) : 0}%`;
  return li;
}

function renderQueue() {
  const st = ed.state;
  const panel = $('[data-queue]');
  if (!st) {
    panel.hidden = true;
    return;
  }
  const items = uploads.forGallery(st.gid);
  if (!items.length) {
    panel.hidden = true;
    rows.clear();
    return;
  }
  panel.hidden = false;
  const s = uploads.stats(st.gid);
  const busy = uploads.busy(st.gid);
  const paused = uploads.state === 'paused';
  const pausing = paused && s.active > 0;

  const title = busy ? (pausing ? S.title.pausing : paused ? S.title.paused : S.title.running) : s.failed ? S.title.doneIssues : S.title.done;
  $('[data-q-title]').textContent = T(title);
  panel.dataset.state = busy ? (paused ? 'paused' : 'running') : s.failed ? 'issues' : 'done';

  const pct = s.bytesTotal ? Math.round((s.bytesDone / s.bytesTotal) * 100) : busy ? 0 : 100;
  const bar = $('[data-q-bar]');
  bar.setAttribute('aria-valuenow', String(pct));
  bar.setAttribute('aria-valuetext', `${pct}%`);
  bar.querySelector<HTMLElement>('span')!.style.inlineSize = `${pct}%`;

  const parts: string[] = [];
  if (busy) {
    parts.push(T(S.stats, { done: fmtNumber(s.done), total: fmtNumber(s.total) }));
    if (s.bytesTotal) parts.push(T(S.bytes, { a: fmtBytes(s.bytesDone), b: fmtBytes(s.bytesTotal) }));
    if (!paused && Number.isFinite(s.eta) && s.eta > 0) parts.push(T(S.eta, { t: fmtDuration(s.eta) }));
  } else {
    parts.push(`${plural(s.done, S.doneCount)}${s.bytesDone ? ` (${fmtBytes(s.bytesDone)})` : ''}`);
    if (s.failed) parts.push(T(S.failedLine, { n: fmtNumber(s.failed) }));
  }
  if (s.skipped) parts.push(T(S.skippedLine, { n: fmtNumber(s.skipped) }));
  $('[data-q-stats]').textContent = parts.join(' · ');
  $('[data-q-keep]').hidden = !busy;

  const pauseBtn = $<HTMLButtonElement>('[data-q-pause]');
  pauseBtn.hidden = !busy;
  pauseBtn.replaceChildren(icon(paused ? 'play' : 'pause', 16), T(paused ? S.resume : S.pause));
  $('[data-q-cancel]').hidden = !busy;
  $('[data-q-retry]').hidden = !s.failed || items.every((i) => i.status !== 'failed' || ['heic', 'raw', 'decode'].includes(i.reason ?? ''));
  $('[data-q-clear]').hidden = busy;

  // Rows: what's happening now, what needs attention, and the latest finished.
  const active = items.filter((i) => i.status === 'preparing' || i.status === 'uploading');
  const failed = items.filter((i) => i.status === 'failed');
  const done = items.filter((i) => i.status === 'done' || i.status === 'skipped' || i.status === 'cancelled');
  const recent = done.slice(-Math.max(3, 8 - active.length - failed.length));
  const nextUp = items.filter((i) => i.status === 'queued').slice(0, Math.max(0, 3 - active.length));
  const shown = [...failed, ...active, ...nextUp, ...recent.reverse()];
  const list = $('[data-q-rows]');
  const els = shown.map(rowFor);
  // keep DOM stable: only touch it when the order changes
  const same = els.length === list.children.length && els.every((e, k) => list.children[k] === e);
  if (!same) list.replaceChildren(...els);
  const visible = new Set(shown.map((i) => i.key));
  for (const key of [...rows.keys()]) if (!visible.has(key)) rows.delete(key);

  const queuedLeft = items.filter((i) => i.status === 'queued').length - nextUp.length;
  const doneLeft = done.length - recent.length;
  const more = $('[data-q-more]');
  more.textContent = queuedLeft > 0 ? T(S.more, { q: fmtNumber(queuedLeft), d: fmtNumber(s.done) }) : doneLeft > 0 ? T(S.moreDone, { d: fmtNumber(doneLeft) }) : '';
  more.hidden = !more.textContent;
}

/* ─────────────────────────────── wiring ─────────────────────────────── */

export const uploader = {
  init() {
    if (wired) return;
    wired = true;
    const fileInput = $<HTMLInputElement>('[data-file-input]');
    const folderInput = $<HTMLInputElement>('[data-folder-input]');
    folderInput.webkitdirectory = true;
    $('[data-pick-files]').addEventListener('click', () => fileInput.click());
    $('[data-pick-folder]').addEventListener('click', () => folderInput.click());
    for (const input of [fileInput, folderInput]) {
      input.addEventListener('change', () => {
        addFiles([...(input.files ?? [])]);
        input.value = '';
      });
    }

    const zone = $('[data-drop]');
    const target = $('[data-ed-panel="photos"]');
    let depth = 0;
    const hasFiles = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])].includes('Files');
    target.addEventListener('dragenter', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      zone.classList.add('is-over');
      zone.querySelector('[data-drop-title]')!.textContent = T(S.dropHere);
    });
    target.addEventListener('dragover', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    });
    const leave = () => {
      depth = 0;
      zone.classList.remove('is-over');
      const t = zone.querySelector<HTMLElement>('[data-drop-title]')!;
      t.textContent = t.dataset.text ?? '';
    };
    target.addEventListener('dragleave', (e) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) leave();
    });
    target.addEventListener('drop', (e) => {
      if (!hasFiles(e) || !e.dataTransfer) return;
      e.preventDefault();
      leave();
      void filesFromDrop(e.dataTransfer).then(({ files, paths }) => addFiles(files, paths));
    });
    // Never let a stray drop navigate away from the admin.
    window.addEventListener('dragover', (e) => hasFiles(e) && e.preventDefault());
    window.addEventListener('drop', (e) => hasFiles(e) && e.preventDefault());

    const select = $<HTMLSelectElement>('[data-up-set]');
    select.addEventListener('change', () => {
      if (select.value === '__new__') {
        select.value = (ed.state && lastSet.get(ed.state.gid)) ?? '';
        focusNewSet();
        return;
      }
      if (ed.state) lastSet.set(ed.state.gid, select.value);
    });
    $<HTMLInputElement>('[data-up-originals]').addEventListener('change', () => (keepTouched = true));

    $('[data-q-pause]').addEventListener('click', () => (uploads.state === 'paused' ? uploads.resume() : uploads.pause()));
    $('[data-q-cancel]').addEventListener('click', () => {
      if (!ed.state) return;
      uploads.cancel(ed.state.gid);
      toast(T(S.cancelled), { type: 'info' });
    });
    $('[data-q-retry]').addEventListener('click', () => ed.state && uploads.retryFailed(ed.state.gid));
    $('[data-q-clear]').addEventListener('click', () => {
      if (!ed.state) return;
      uploads.clearFinished(ed.state.gid);
      rows.clear();
    });

    uploads.addEventListener('change', renderQueue);
    on('gallery', () => {
      renderSetSelect();
      syncOriginalsDefault();
    });
  },
  load() {
    keepTouched = false;
    rows.clear();
    renderSetSelect();
    syncOriginalsDefault();
    renderQueue();
    $$<HTMLElement>('[data-drop-title]').forEach((t) => (t.textContent = t.dataset.text ?? t.textContent));
  },
};
