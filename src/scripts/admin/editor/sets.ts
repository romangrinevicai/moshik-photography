/** Chapters ("sets"): add, rename, reorder, delete — stored on the gallery record. */
import type { GallerySet } from '~/shared/gallery-types';
import { errorText } from '../core/api';
import { $, $maybe, h, icon } from '../core/dom';
import { T, fmtNumber, iso } from '../core/i18n';
import { confirmDialog, toastError } from '../core/ui';
import { shortId } from '../lib/ids';
import { ed, on, patchGallery } from './state';

const S = {
  empty: { he: 'אין פרקים — כל התמונות יוצגו יחד. זה בסדר גמור.', en: 'No chapters — all photos show together. That’s perfectly fine.' },
  rename: { he: 'שם הפרק', en: 'Chapter name' },
  up: { he: 'הזזה למעלה', en: 'Move up' },
  down: { he: 'הזזה למטה', en: 'Move down' },
  remove: { he: 'מחיקת הפרק {n}', en: 'Delete chapter {n}' },
  count: { he: '{n} תמ׳', en: '{n} ph.' },
  deleteTitle: { he: 'למחוק את הפרק "{n}"?', en: 'Delete the chapter “{n}”?' },
  deleteText: { he: 'התמונות לא יימחקו — הן פשוט יוצגו בלי פרק.', en: 'The photos won’t be deleted — they’ll just show without a chapter.' },
  deleteOk: { he: 'מחיקת הפרק', en: 'Delete chapter' },
  nameRequired: { he: 'נא לכתוב שם לפרק', en: 'Please name the chapter' },
  exists: { he: 'כבר יש פרק בשם הזה', en: 'There’s already a chapter with that name' },
};

let wired = false;

const current = (): GallerySet[] => ed.state?.gallery.sets ?? [];

async function save(next: GallerySet[], rollback: GallerySet[]) {
  const st = ed.state;
  if (!st) return false;
  st.gallery.sets = next;
  render();
  try {
    await patchGallery({ sets: next });
    return true;
  } catch (e) {
    if (ed.state === st) {
      st.gallery.sets = rollback;
      render();
    }
    toastError(errorText(e));
    return false;
  }
}

function countFor(id: string) {
  return ed.state?.photos.filter((p) => p.set === id).length ?? 0;
}

function row(set: GallerySet, i: number, all: GallerySet[]) {
  const input = h('input', {
    class: 'adm-sets__name',
    type: 'text',
    value: set.name,
    maxlength: '60',
    'aria-label': T(S.rename),
    dir: 'auto',
  });
  const commit = () => {
    const name = input.value.trim();
    if (!name) {
      input.value = set.name;
      return;
    }
    if (name === set.name) return;
    const before = current();
    void save(
      before.map((s) => (s.id === set.id ? { ...s, name } : s)),
      before,
    );
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    }
    if (e.key === 'Escape') {
      input.value = set.name;
      input.blur();
    }
  });
  input.addEventListener('blur', commit);
  const move = (dir: -1 | 1) => {
    const before = current();
    const j = i + dir;
    if (j < 0 || j >= before.length) return;
    const next = before.slice();
    [next[i], next[j]] = [next[j]!, next[i]!];
    void save(next, before).then(() => {
      // keep keyboard focus on the moved row
      requestAnimationFrame(() => $maybe<HTMLButtonElement>(`[data-set-row="${CSS.escape(set.id)}"] [data-move="${dir}"]:not([disabled])`)?.focus());
    });
  };
  const n = countFor(set.id);
  return h(
    'li',
    { class: 'adm-sets__row', 'data-set-row': set.id },
    h('span', { class: 'adm-sets__num', 'aria-hidden': 'true' }, String(i + 1).padStart(2, '0')),
    input,
    h('span', { class: 'adm-sets__count', title: String(n) }, T(S.count, { n: fmtNumber(n) })),
    h(
      'span',
      { class: 'adm-sets__tools' },
      h('button', { type: 'button', class: 'adm-iconbtn adm-iconbtn--sm', 'aria-label': T(S.up), disabled: i === 0, 'data-move': '-1', onclick: () => move(-1) }, icon('arrow-up', 16)),
      h('button', { type: 'button', class: 'adm-iconbtn adm-iconbtn--sm', 'aria-label': T(S.down), disabled: i === all.length - 1, 'data-move': '1', onclick: () => move(1) }, icon('arrow-down', 16)),
      h(
        'button',
        {
          type: 'button',
          class: 'adm-iconbtn adm-iconbtn--sm adm-iconbtn--danger',
          'aria-label': T(S.remove, { n: set.name }),
          onclick: async () => {
            if (n > 0) {
              const ok = await confirmDialog({ title: T(S.deleteTitle, { n: iso(set.name) }), message: T(S.deleteText), confirm: T(S.deleteOk), danger: true });
              if (!ok) return;
            }
            const before = current();
            void save(
              before.filter((s) => s.id !== set.id),
              before,
            );
          },
        },
        icon('trash2', 16),
      ),
    ),
  );
}

let lastSig = '';

function render() {
  const list = $('[data-sets-list]');
  const all = current();
  const sig = JSON.stringify(all.map((s) => [s.id, s.name]));
  if (sig === lastSig && list.children.length) {
    // Same chapters: only refresh the photo counts (keeps any name being edited intact).
    for (const s of all) {
      const c = $maybe(`[data-set-row="${CSS.escape(s.id)}"] .adm-sets__count`, list);
      if (c) c.textContent = T(S.count, { n: fmtNumber(countFor(s.id)) });
    }
    return;
  }
  lastSig = sig;
  const focusedRow = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-set-row]')?.dataset.setRow;
  if (!all.length) {
    list.replaceChildren(h('li', { class: 'adm-sets__empty' }, T(S.empty)));
    return;
  }
  list.replaceChildren(...all.map((s, i, arr) => row(s, i, arr)));
  if (focusedRow) $maybe<HTMLInputElement>(`[data-set-row="${CSS.escape(focusedRow)}"] input`, list)?.focus();
}

export const sets = {
  init() {
    if (wired) return;
    wired = true;
    const form = $<HTMLFormElement>('[data-sets-add]');
    const input = form.querySelector<HTMLInputElement>('input')!;
    const err = $('[data-sets-error]');
    input.addEventListener('input', () => (err.textContent = ''));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = input.value.trim();
      if (!name) {
        err.textContent = T(S.nameRequired);
        input.focus();
        return;
      }
      const before = current();
      if (before.some((s) => s.name.trim().toLowerCase() === name.toLowerCase())) {
        err.textContent = T(S.exists);
        return;
      }
      input.value = '';
      await save([...before, { id: shortId(8), name }], before);
      input.focus();
    });
    on('gallery', render);
    on('photos', render);
  },
  load() {
    render();
    $('[data-sets-error]').textContent = '';
  },
};

/** Used by the uploader's "new chapter" shortcut. */
export function focusNewSet() {
  const input = $<HTMLInputElement>('[data-sets-add] input');
  input.scrollIntoView({ behavior: 'smooth', block: 'center' });
  input.focus();
}
