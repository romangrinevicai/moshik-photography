/**
 * Gallery editor state shared by its sections, plus manifest syncing.
 *
 * Changes (uploads, deletes, cover, details, sets, faces) are pushed to the
 * public manifest automatically with POST …/publish (no status = keep the
 * current status), so "View as client" and live events always show the
 * latest version. The header's Publish button only changes the status.
 */
import type { GalleryRecord, GalleryStatus, PhotoMeta } from '~/shared/gallery-types';
import { api, ApiError } from '../core/api';
import { store } from '../core/store';
import { uploads } from '../upload/queue';

export interface EditorState {
  gid: string;
  gallery: GalleryRecord;
  photos: PhotoMeta[];
  faces: { faces: number; people: number } | null;
  manifestVersion: number | null;
}

export type EdEvent = 'gallery' | 'photos' | 'faces' | 'sync';

export const ed = {
  state: null as EditorState | null,
  events: new EventTarget(),
  /** Manifest sync status for the current gallery. */
  sync: 'idle' as 'idle' | 'pending' | 'saving' | 'error',
};

export const emit = (type: EdEvent) => ed.events.dispatchEvent(new Event(type));
export const on = (type: EdEvent, fn: () => void) => ed.events.addEventListener(type, fn);

export const enc = encodeURIComponent;
export const galleryApi = (gid: string, rest = '') => `/api/admin/galleries/${enc(gid)}${rest}`;
export const thumbUrl = (gid: string, pid: string) => `/media/${enc(gid)}/${enc(pid)}/thumb`;
export const webUrl = (gid: string, pid: string) => `/media/${enc(gid)}/${enc(pid)}/web`;

export function setGallery(g: GalleryRecord) {
  if (!ed.state || ed.state.gid !== g.id) return;
  ed.state.gallery = { ...ed.state.gallery, ...g };
  store.upsertGallery({ ...ed.state.gallery, photoCount: ed.state.photos.length });
  emit('gallery');
}

/** PATCH the gallery record, then refresh the public manifest. */
export async function patchGallery(partial: Partial<GalleryRecord>): Promise<GalleryRecord> {
  const st = ed.state;
  if (!st) throw new Error('no gallery');
  const res = await api<{ ok: true; gallery: GalleryRecord }>(galleryApi(st.gid), { method: 'PATCH', body: partial });
  setGallery(res.gallery);
  scheduleSync();
  return res.gallery;
}

/* ───────────────────────────── manifest sync ───────────────────────────── */

let timer = 0;
let running: Promise<void> | null = null;
let again = false;

/** Refresh the public manifest soon (debounced). Waits while photos are still uploading. */
export function scheduleSync(delay = 1200) {
  const st = ed.state;
  if (!st) return;
  window.clearTimeout(timer);
  ed.sync = 'pending';
  emit('sync');
  const gid = st.gid;
  timer = window.setTimeout(() => {
    if (uploads.busy(gid)) return; // the upload's own completion triggers a sync
    void syncNow(gid);
  }, delay);
}

/** POST …/publish (optionally changing the status). */
export async function syncNow(gid: string, status?: GalleryStatus): Promise<void> {
  if (running && !status) {
    again = true;
    return running.catch(() => undefined);
  }
  window.clearTimeout(timer);
  const isCurrent = () => ed.state?.gid === gid;
  if (isCurrent()) {
    ed.sync = 'saving';
    emit('sync');
  }
  const job = (async () => {
    try {
      const res = await api<{ ok: true; manifest: { version?: number } }>(galleryApi(gid, '/publish'), {
        method: 'POST',
        body: status ? { status } : {},
      });
      if (isCurrent() && ed.state) {
        ed.state.manifestVersion = res.manifest?.version ?? ed.state.manifestVersion;
        const now = new Date().toISOString();
        const patch: Partial<GalleryRecord> = status ? { status, publishedAt: status === 'published' ? now : ed.state.gallery.publishedAt } : {};
        ed.state.gallery = { ...ed.state.gallery, ...patch, updatedAt: ed.state.gallery.updatedAt };
        store.upsertGallery({ ...ed.state.gallery, photoCount: ed.state.photos.length });
        ed.sync = 'idle';
        emit('gallery');
        emit('sync');
      } else if (status) {
        const g = store.galleries?.find((x) => x.id === gid);
        if (g) store.upsertGallery({ ...g, status });
      }
    } catch (e) {
      if (isCurrent()) {
        ed.sync = 'error';
        emit('sync');
      }
      if (status) throw e;
      if (e instanceof ApiError && e.status === 401) return;
    }
  })();
  running = job;
  try {
    await job;
  } finally {
    running = null;
    if (again) {
      again = false;
      if (isCurrent()) void syncNow(gid);
    }
  }
}

export function resetSync() {
  window.clearTimeout(timer);
  ed.sync = 'idle';
  again = false;
}
