/** Danger zone: delete the whole gallery (confirmed by typing its name). */
import { api, errorText } from '../core/api';
import { $ } from '../core/dom';
import { T, fmtNumber, iso } from '../core/i18n';
import { go, routes } from '../core/router';
import { store } from '../core/store';
import { confirmDialog, holdUnload, setBusy, toast, toastError } from '../core/ui';
import { uploads } from '../upload/queue';
import { ed, galleryApi, resetSync } from './state';

const S = {
  title: { he: 'למחוק את הגלריה "{t}"?', en: 'Delete the gallery “{t}”?' },
  text: {
    he: 'כל התמונות, הקבצים המקוריים, נתוני הפנים והבחירות יימחקו לצמיתות, והקישור והקוד יפסיקו לעבוד. אי אפשר לשחזר.',
    en: 'All photos, originals, face data and selections will be permanently deleted, and the link and code will stop working. This can’t be undone.',
  },
  typeLabel: { he: 'כדי לאשר, הקלד את שם הגלריה:', en: 'To confirm, type the gallery name:' },
  ok: { he: 'מחיקת הגלריה לצמיתות', en: 'Delete gallery forever' },
  done: { he: 'הגלריה נמחקה ({n} קבצים)', en: 'Gallery deleted ({n} files)' },
};

let wired = false;

export const danger = {
  init() {
    if (wired) return;
    wired = true;
    $('[data-delete-gallery]').addEventListener('click', async (e) => {
      const st = ed.state;
      if (!st) return;
      const btn = e.currentTarget as HTMLButtonElement;
      const ok = await confirmDialog({
        title: T(S.title, { t: iso(st.gallery.title) }),
        message: T(S.text),
        confirm: T(S.ok),
        danger: true,
        typeToConfirm: st.gallery.title,
        typeLabel: T(S.typeLabel),
      });
      if (!ok || ed.state !== st) return;
      uploads.cancel(st.gid);
      setBusy(btn, true);
      try {
        const res = await api<{ ok: true; deleted?: number }>(galleryApi(st.gid), { method: 'DELETE' });
        store.removeGallery(st.gid);
        holdUnload('details', false);
        resetSync();
        ed.state = null;
        toast(T(S.done, { n: fmtNumber(res.deleted ?? 0) }));
        go(routes.galleries());
      } catch (err) {
        toastError(errorText(err));
      } finally {
        setBusy(btn, false);
      }
    });
  },
  load() {},
};
