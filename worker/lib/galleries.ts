import type { GalleryManifest, GalleryRecord, PhotoMeta, Person } from '../../src/shared/gallery-types';
import { ID_RE } from '../../src/shared/gallery-types';
import { HttpError } from './http';
import { getJson, keys, listAll, putJson } from './storage';

/** Short-lived per-isolate cache of gallery records (status checks for media requests). */
const recordCache = new Map<string, { record: GalleryRecord | null; at: number }>();
const RECORD_TTL = 30_000;

export function assertId(id: string | undefined, what = 'id'): string {
  if (!id || !ID_RE.test(id)) throw new HttpError(400, `Invalid ${what}`, 'invalid');
  return id;
}

export async function getRecord(bucket: R2Bucket, gid: string, fresh = false): Promise<GalleryRecord | null> {
  const hit = recordCache.get(gid);
  if (!fresh && hit && Date.now() - hit.at < RECORD_TTL) return hit.record;
  const record = await getJson<GalleryRecord>(bucket, keys.gallery(gid));
  recordCache.set(gid, { record, at: Date.now() });
  if (recordCache.size > 500) recordCache.delete(recordCache.keys().next().value!);
  return record;
}

export async function saveRecord(bucket: R2Bucket, record: GalleryRecord): Promise<void> {
  record.updatedAt = new Date().toISOString();
  await putJson(bucket, keys.gallery(record.id), record);
  recordCache.set(record.id, { record, at: Date.now() });
}

export const forgetRecord = (gid: string) => recordCache.delete(gid);

export function isExpired(record: Pick<GalleryRecord, 'expiresAt'>, now = new Date()): boolean {
  if (!record.expiresAt) return false;
  const end = new Date(record.expiresAt.length === 10 ? `${record.expiresAt}T23:59:59+03:00` : record.expiresAt);
  return Number.isFinite(end.getTime()) && end < now;
}

/** Throws the right HTTP error when a visitor (non-admin) may not see this gallery. */
export function assertVisible(record: GalleryRecord | null, admin: boolean): GalleryRecord {
  if (!record) throw new HttpError(404, 'Gallery not found', 'not_found');
  if (admin) return record;
  if (record.status !== 'published') throw new HttpError(403, 'This gallery is not published yet', 'draft');
  if (isExpired(record)) throw new HttpError(410, 'This gallery has expired', 'expired');
  return record;
}

const num = (v: string | undefined) => (v === undefined || v === '' ? undefined : Number(v));

export function metaFromObject(id: string, meta: Record<string, string> | undefined): PhotoMeta {
  const m = meta ?? {};
  return {
    id,
    w: Number(m.w) || 0,
    h: Number(m.h) || 0,
    set: m.set || undefined,
    name: m.name || undefined,
    order: num(m.order),
    takenAt: m.takenAt || undefined,
    webSize: num(m.webSize),
    webCrc: num(m.webCrc),
    origSize: num(m.origSize),
    origCrc: num(m.origCrc),
    origExt: m.origExt || undefined,
    uploadedAt: m.uploadedAt || undefined,
  };
}

/** Lists every stored photo of a gallery (a photo exists once its `web` variant exists). */
export async function listPhotos(bucket: R2Bucket, record: GalleryRecord): Promise<PhotoMeta[]> {
  const prefix = keys.photosPrefix(record.id);
  const { objects } = await listAll(bucket, prefix, { include: ['customMetadata'] });
  const originals = new Map<string, number>();
  for (const o of objects) if (o.key.endsWith('/original')) originals.set(o.key.slice(prefix.length).split('/')[0]!, o.size);
  const photos = objects
    .filter((o) => o.key.endsWith('/web'))
    .map((o) => {
      const pid = o.key.slice(prefix.length).split('/')[0]!;
      const meta = metaFromObject(pid, o.customMetadata);
      // Trust the stored sizes over client-declared ones; drop CRCs that can't match.
      if (meta.webSize !== o.size) {
        meta.webSize = o.size;
        meta.webCrc = undefined;
      }
      const origSize = originals.get(pid);
      if (origSize === undefined) {
        meta.origSize = undefined;
        meta.origCrc = undefined;
      } else if (meta.origSize !== origSize) {
        meta.origSize = origSize;
        meta.origCrc = undefined;
      }
      return meta;
    });
  const setOrder = new Map(record.sets.map((s, i) => [s.id, i]));
  photos.sort(
    (a, b) =>
      (setOrder.get(a.set ?? '') ?? 999) - (setOrder.get(b.set ?? '') ?? 999) ||
      (a.order ?? Infinity) - (b.order ?? Infinity) ||
      (a.takenAt ?? '').localeCompare(b.takenAt ?? '') ||
      (a.name ?? '').localeCompare(b.name ?? '', 'en', { numeric: true }) ||
      a.id.localeCompare(b.id),
  );
  return photos;
}

export async function buildManifest(bucket: R2Bucket, record: GalleryRecord): Promise<GalleryManifest> {
  const [photos, peopleDoc, facesHead] = await Promise.all([
    listPhotos(bucket, record),
    getJson<{ people: Person[] }>(bucket, keys.people(record.id)),
    bucket.head(keys.facesIndex(record.id)),
  ]);
  const ids = new Set(photos.map((p) => p.id));
  const people = (peopleDoc?.people ?? [])
    .map((p) => ({ ...p, photoIds: p.photoIds.filter((id) => ids.has(id)) }))
    .map((p) => ({ ...p, count: p.photoIds.length }))
    .filter((p) => p.count >= 2)
    .sort((a, b) => b.count - a.count);
  const manifest: GalleryManifest = {
    id: record.id,
    title: record.title,
    subtitle: record.subtitle,
    date: record.date,
    lang: record.lang,
    message: record.message,
    coverPhotoId: record.coverPhotoId && ids.has(record.coverPhotoId) ? record.coverPhotoId : photos[0]?.id,
    allowDownload: record.allowDownload,
    allowOriginals: record.allowOriginals,
    faceSearch: record.faceSearch,
    live: record.live,
    externalUrl: record.externalUrl,
    sets: record.sets.filter((s) => photos.some((p) => p.set === s.id)),
    photos,
    people: record.faceSearch ? people : [],
    hasFaces: record.faceSearch && Boolean(facesHead),
    version: Date.now(),
    updatedAt: new Date().toISOString(),
  };
  await putJson(bucket, keys.manifest(record.id), manifest);
  return manifest;
}

export const getManifest = (bucket: R2Bucket, gid: string) => getJson<GalleryManifest>(bucket, keys.manifest(gid));

/** File-system friendly, keeps Hebrew letters. */
export function safeName(s: string, fallback = 'gallery'): string {
  const cleaned = s
    .normalize('NFC')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return cleaned || fallback;
}
