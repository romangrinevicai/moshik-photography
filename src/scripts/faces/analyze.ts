/**
 * Admin helper: analyse every photo of a gallery, cluster people and upload
 * the face index, descriptors, face crops and people via the admin API.
 */
import { encodeDescriptors } from '../../shared/face-codec';
import type { FaceIndex, Person } from '../../shared/gallery-types';
import { readGalleryCache, writePhotoCache } from './cache';
import { clusterSteps, type ClusterItem } from './cluster';
import { FaceError, isAbortError, throwIfAborted } from './errors';
import { closeSource, cropFaceJpeg, decodeBlob } from './image';
import type { DetectedFace, FaceSource, PersonCluster, ProgressFn } from './types';
import { sleep, yieldToUI } from './util';

export interface AnalyzeOptions {
  galleryId: string;
  photos: { id: string; w: number; h: number }[];
  onProgress?: ProgressFn;
  signal?: AbortSignal;
  useCache?: boolean;
}

export interface AnalyzeDeps {
  ready: (onProgress?: ProgressFn) => Promise<unknown>;
  detect: (source: FaceSource, opts: { thorough: boolean }) => Promise<DetectedFace[]>;
}

const ADMIN_HEADERS = { 'X-Requested-With': 'moshik-admin' };
const enc = encodeURIComponent;

async function errorText(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string; code?: string };
    return body.error || body.code || res.statusText;
  } catch {
    return res.statusText;
  }
}

/**
 * fetch with retries on network errors / 5xx. 401 and 403 throw a FaceError
 * with code `auth`; `allow404` returns null instead of throwing.
 */
async function request(url: string, init: RequestInit, what: string, allow404 = false): Promise<Response | null> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { credentials: 'same-origin', ...init });
    } catch (err) {
      if (isAbortError(err)) throw err;
      if (attempt < 2) {
        await sleep(700 * (attempt + 1));
        continue;
      }
      throw new FaceError('network', `Network error while ${what} — check the connection and try again`, { cause: err });
    }
    if (res.ok) return res;
    if (res.status === 404 && allow404) return null;
    if (res.status === 401 || res.status === 403) {
      throw new FaceError('auth', `Not authorised while ${what} — please log in to the admin again (HTTP ${res.status})`, { status: res.status });
    }
    if (res.status >= 500 && attempt < 2) {
      await sleep(1000 * (attempt + 1));
      continue;
    }
    throw new FaceError('server', `Server error while ${what}: ${await errorText(res)} (HTTP ${res.status})`, { status: res.status });
  }
}

async function adminPut(url: string, body: BodyInit, contentType: string, what: string, signal?: AbortSignal) {
  await request(url, { method: 'PUT', body, headers: { ...ADMIN_HEADERS, 'Content-Type': contentType }, signal }, what);
}

/** Fetches and decodes a photo's web variant; null when it no longer exists or cannot be decoded. */
async function loadPhoto(galleryId: string, photoId: string, signal?: AbortSignal): Promise<FaceSource | null> {
  const res = await request(`/media/${enc(galleryId)}/${enc(photoId)}/web`, { signal }, 'downloading photos', true);
  if (!res) return null;
  const blob = await res.blob();
  try {
    return await decodeBlob(blob);
  } catch {
    return null;
  }
}

/** Async driver for the clustering generator: yields to the UI every ~40 ms. */
export async function clusterAsync(
  items: ClusterItem[],
  onFraction?: (f: number) => void,
  signal?: AbortSignal,
  opts?: { threshold?: number; minPhotos?: number },
): Promise<PersonCluster[]> {
  const steps = clusterSteps(items, opts);
  let last = performance.now();
  for (;;) {
    const r = steps.next();
    if (r.done) return r.value;
    if (performance.now() - last > 40) {
      onFraction?.(r.value);
      await yieldToUI();
      throwIfAborted(signal);
      last = performance.now();
    }
  }
}

export async function analyzeGalleryImpl(opts: AnalyzeOptions, deps: AnalyzeDeps): Promise<{ faces: number; people: number }> {
  const { galleryId, photos, onProgress, signal } = opts;
  const useCache = opts.useCache ?? true;
  const report: ProgressFn = (info) => {
    try {
      onProgress?.(info);
    } catch {
      /* UI errors must not abort the analysis */
    }
  };
  const base = `/api/admin/galleries/${enc(galleryId)}`;
  throwIfAborted(signal);

  // 1. Models.
  await deps.ready(onProgress);
  throwIfAborted(signal);

  // 2. Detection (cached photos are skipped; the next photo downloads while the current one is analysed).
  const total = photos.length;
  const results = useCache ? await readGalleryCache(galleryId) : new Map<string, DetectedFace[]>();
  const wanted = new Set(photos.map((p) => p.id));
  for (const key of [...results.keys()]) if (!wanted.has(key)) results.delete(key);
  const todo = photos.filter((p) => !results.has(p.id));
  let done = total - todo.length;
  report({ stage: 'detect', done, total, message: done ? `${done} cached` : undefined });

  let next: Promise<FaceSource | null> | null = todo.length ? loadPhoto(galleryId, todo[0]!.id, signal) : null;
  let failures = 0;
  let missing = 0;
  try {
    for (let i = 0; i < todo.length; i++) {
      throwIfAborted(signal);
      const photo = todo[i]!;
      const image = await next!;
      next = i + 1 < todo.length ? loadPhoto(galleryId, todo[i + 1]!.id, signal) : null;
      if (image) {
        try {
          const faces = await deps.detect(image, { thorough: true });
          results.set(photo.id, faces);
          failures = 0;
          if (useCache) await writePhotoCache(galleryId, photo.id, faces);
        } catch (err) {
          if (isAbortError(err) || err instanceof FaceError) throw err;
          // A GPU hiccup on one photo is skipped; repeated failures mean the engine is broken.
          if (++failures >= 3) throw new FaceError('unsupported', 'Face detection keeps failing in this browser', { cause: err });
        } finally {
          closeSource(image);
        }
      } else {
        missing++;
      }
      report({ stage: 'detect', done: ++done, total, message: image ? undefined : `missing ${photo.id}` });
      await yieldToUI();
    }
  } finally {
    // Don't leak a prefetched bitmap or an unhandled rejection when stopping early.
    next?.then(closeSource, () => {});
  }
  throwIfAborted(signal);
  if (photos.length && missing === photos.length) {
    // Never replace existing face data because of a broken media route.
    throw new FaceError('server', 'None of the photos could be downloaded for analysis');
  }

  // 3. Clustering. Items (and therefore the index / descriptors) follow the photo order.
  const items: ClusterItem[] = [];
  for (const p of photos) for (const face of results.get(p.id) ?? []) items.push({ photoId: p.id, face });
  report({ stage: 'cluster', done: 0, total: 100 });
  const clusters = await clusterAsync(items, (f) => report({ stage: 'cluster', done: Math.round(f * 100), total: 100 }), signal);
  report({ stage: 'cluster', done: 100, total: 100, message: `${clusters.length} people` });
  throwIfAborted(signal);

  // 4. Upload.
  if (!items.length) {
    report({ stage: 'upload', done: 0, total: 1 });
    await request(`${base}/faces`, { method: 'DELETE', headers: ADMIN_HEADERS, signal }, 'clearing face data');
    report({ stage: 'upload', done: 1, total: 1 });
    return { faces: 0, people: 0 };
  }
  const steps = 3 + clusters.length;
  let uploaded = 0;
  const tick = (message: string) => report({ stage: 'upload', done: ++uploaded, total: steps, message });
  report({ stage: 'upload', done: 0, total: steps });

  const index: FaceIndex = {
    version: Date.now(),
    dims: 128,
    faces: items.map(({ photoId, face }) => ({ p: photoId, b: face.box, s: Math.round(face.score * 1000) / 1000 })),
  };
  await adminPut(`${base}/faces/index`, JSON.stringify(index), 'application/json', 'uploading the face index', signal);
  tick('index');
  const bytes = encodeDescriptors(items.map((it) => it.face.descriptor));
  await adminPut(`${base}/faces/descriptors`, bytes as Uint8Array<ArrayBuffer>, 'application/octet-stream', 'uploading face descriptors', signal);
  tick('descriptors');

  // One crop per person, downloading each source photo once.
  const hasCrop = new Set<string>();
  const byPhoto = new Map<string, PersonCluster[]>();
  for (const c of clusters) {
    const pid = items[c.representative]!.photoId;
    byPhoto.set(pid, [...(byPhoto.get(pid) ?? []), c]);
  }
  for (const [pid, people] of byPhoto) {
    throwIfAborted(signal);
    const image = await loadPhoto(galleryId, pid, signal);
    try {
      for (const person of people) {
        if (image) {
          try {
            const jpeg = await cropFaceJpeg(image, items[person.representative]!.face.box, 192);
            await adminPut(`${base}/people/${enc(person.id)}`, jpeg, 'image/jpeg', 'uploading face thumbnails', signal);
            hasCrop.add(person.id);
          } catch (err) {
            // A missing thumbnail is not fatal (hasCrop stays false); a lost session or abort is.
            if (isAbortError(err) || (err instanceof FaceError && err.code === 'auth')) throw err;
          }
        }
        tick('crops');
      }
    } finally {
      closeSource(image);
    }
  }

  const people: Person[] = clusters.map((c) => ({ id: c.id, count: c.photoIds.length, photoIds: c.photoIds, hasCrop: hasCrop.has(c.id) }));
  await adminPut(`${base}/faces/people`, JSON.stringify({ people }), 'application/json', 'uploading people', signal);
  tick('people');
  return { faces: items.length, people: clusters.length };
}
