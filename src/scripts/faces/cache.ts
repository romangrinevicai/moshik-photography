/**
 * IndexedDB cache of per-photo detections (admin only), so re-analysing a
 * gallery after adding photos only processes the new ones.
 * DB `moshik-faces`, store `detections`, key `${galleryId}/${photoId}`;
 * descriptors are stored as one binary Float32 buffer per photo.
 * Every failure (private mode, quota…) degrades silently to "no cache".
 */
import { MIN_CONFIDENCE, MIN_FACE_PX, PIPELINE_VERSION, TILE_TARGET } from './config';
import type { Box, DetectedFace } from './types';

const DB_NAME = 'moshik-faces';
const STORE = 'detections';
const DIMS = 128;
/** Changes whenever cached results would differ. */
const SIGNATURE = `${PIPELINE_VERSION}:${TILE_TARGET}:${MIN_FACE_PX}:${MIN_CONFIDENCE}`;

interface CachedPhoto {
  sig: string;
  faces: { b: Box; s: number; q?: number }[];
  /** faces.length × 128 float32 values. */
  d: ArrayBuffer;
  at: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  dbPromise ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

const galleryRange = (galleryId: string) => IDBKeyRange.bound(`${galleryId}/`, `${galleryId}/￿`);

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** All valid cached detections of a gallery, by photo id. */
export async function readGalleryCache(galleryId: string): Promise<Map<string, DetectedFace[]>> {
  const out = new Map<string, DetectedFace[]>();
  const db = await openDb();
  if (!db) return out;
  try {
    const store = db.transaction(STORE, 'readonly').objectStore(STORE);
    const range = galleryRange(galleryId);
    const [keys, values] = await Promise.all([request(store.getAllKeys(range)), request(store.getAll(range))]);
    keys.forEach((key, i) => {
      const rec = values[i] as CachedPhoto | undefined;
      if (!rec || rec.sig !== SIGNATURE || !(rec.d instanceof ArrayBuffer) || rec.d.byteLength !== rec.faces.length * DIMS * 4) return;
      const all = new Float32Array(rec.d);
      out.set(
        String(key).slice(galleryId.length + 1),
        rec.faces.map((f, j) => ({
          box: f.b,
          score: f.s,
          descriptor: all.slice(j * DIMS, (j + 1) * DIMS),
          ...(f.q === undefined ? {} : { quality: f.q }),
        })),
      );
    });
  } catch {
    /* unreadable cache = empty cache */
  }
  return out;
}

export async function writePhotoCache(galleryId: string, photoId: string, faces: DetectedFace[]): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const d = new Float32Array(faces.length * DIMS);
  faces.forEach((f, i) => d.set(f.descriptor, i * DIMS));
  const rec: CachedPhoto = {
    sig: SIGNATURE,
    faces: faces.map((f) => (f.quality === undefined ? { b: f.box, s: f.score } : { b: f.box, s: f.score, q: f.quality })),
    d: d.buffer,
    at: Date.now(),
  };
  try {
    await request(db.transaction(STORE, 'readwrite').objectStore(STORE).put(rec, `${galleryId}/${photoId}`));
  } catch {
    /* quota exceeded etc. — caching is best effort */
  }
}

/** Removes cached detections of one gallery, or of all galleries. */
export async function clearCache(galleryId?: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
    await request(galleryId ? store.delete(galleryRange(galleryId)) : store.clear());
  } catch {
    /* ignore */
  }
}
