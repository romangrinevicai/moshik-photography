import type { Env } from '../env';
import type { Availability, FaceIndex, GalleryRecord, GallerySet, Lead, LeadStatus, Person, Selection } from '../../src/shared/gallery-types';
import { DATE_RE, FACE_DIMS, ID_RE } from '../../src/shared/gallery-types';
import { bytesPerFace } from '../../src/shared/face-codec';
import { clearCookie, createSession, hasCsrfHeader, isAdmin, safeEqual, sessionCookie } from '../lib/auth';
import { forgetFaces } from '../lib/faces';
import { assertId, buildManifest, forgetRecord, getManifest, getRecord, listPhotos, saveRecord } from '../lib/galleries';
import { HttpError, allow, clientIp, clip, errorResponse, json, readJson, sleep } from '../lib/http';
import { accessCode, normalizeCode, randomId } from '../lib/ids';
import { deletePrefix, getJson, keys, listAll, putJson } from '../lib/storage';

const MAX_UPLOAD = 100 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif', 'image/tiff']);
const LEAD_STATUSES: LeadStatus[] = ['new', 'contacted', 'booked', 'lost'];

function bucketOf(env: Env): R2Bucket {
  if (!env.BUCKET) throw new HttpError(503, 'Storage (R2) is not configured', 'unavailable');
  return env.BUCKET;
}

/* ───────────────────────────── session ───────────────────────────── */

export async function login(request: Request, env: Env): Promise<Response> {
  if (!env.ADMIN_PASSWORD) return errorResponse(503, 'ADMIN_PASSWORD is not configured', 'not_configured');
  const ip = clientIp(request);
  if (!(await allow(env.LOGIN_LIMITER, `login:${ip}`, { limit: 6, windowMs: 60_000 }))) return errorResponse(429, 'Too many attempts — try again in a minute', 'rate_limited');
  const { password } = await readJson<{ password?: string }>(request, 2048);
  if (typeof password !== 'string' || !safeEqual(password, env.ADMIN_PASSWORD)) {
    await sleep(400 + Math.random() * 300);
    return errorResponse(401, 'Wrong password', 'bad_password');
  }
  const { token, maxAge } = await createSession(env);
  return json({ ok: true }, { headers: { 'set-cookie': sessionCookie(token, maxAge, new URL(request.url).protocol === 'https:') } });
}

export function logout(request: Request): Response {
  return json({ ok: true }, { headers: { 'set-cookie': clearCookie(new URL(request.url).protocol === 'https:') } });
}

/* ───────────────────────────── helpers ───────────────────────────── */

async function codeOwner(bucket: R2Bucket, normalized: string): Promise<string | null> {
  return (await getJson<{ galleryId: string }>(bucket, keys.code(normalized)))?.galleryId ?? null;
}

function sanitizeSets(value: unknown): GallerySet[] {
  if (!Array.isArray(value)) throw new HttpError(400, 'Invalid sets', 'invalid');
  const seen = new Set<string>();
  return value.slice(0, 40).map((s) => {
    const id = clip((s as GallerySet)?.id, 24).replace(/[^a-z0-9-]/gi, '') || randomId(8);
    const name = clip((s as GallerySet)?.name, 60);
    if (!name || seen.has(id)) throw new HttpError(400, 'Invalid set', 'invalid');
    seen.add(id);
    return { id, name };
  });
}

function optionalDate(value: unknown): string | undefined {
  const v = clip(value, 10);
  if (!v) return undefined;
  if (!DATE_RE.test(v)) throw new HttpError(400, 'Invalid date', 'invalid');
  return v;
}

function optionalUrl(value: unknown): string | undefined {
  const v = clip(value, 500);
  if (!v) return undefined;
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:') throw new Error();
    return u.href;
  } catch {
    throw new HttpError(400, 'External link must be an https:// URL', 'invalid');
  }
}

/* ───────────────────────────── galleries ───────────────────────────── */

export async function listGalleries(env: Env): Promise<Response> {
  const bucket = bucketOf(env);
  const { prefixes } = await listAll(bucket, 'galleries/', { delimiter: '/' });
  const ids = prefixes.map((p) => p.split('/')[1]!).filter((id) => ID_RE.test(id));
  const records: GalleryRecord[] = [];
  for (let i = 0; i < ids.length; i += 20) {
    const batch = await Promise.all(ids.slice(i, i + 20).map((id) => getRecord(bucket, id, true)));
    records.push(...batch.filter((r): r is GalleryRecord => Boolean(r)));
  }
  records.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || b.createdAt.localeCompare(a.createdAt));
  return json({ ok: true, galleries: records });
}

export async function createGallery(request: Request, env: Env): Promise<Response> {
  const bucket = bucketOf(env);
  const body = await readJson<Record<string, unknown>>(request);
  const title = clip(body.title, 120);
  if (!title) return errorResponse(400, 'Title is required', 'invalid');
  let code = clip(body.code, 40);
  let normalized = normalizeCode(code);
  if (code) {
    if (normalized.length < 4) return errorResponse(400, 'Code is too short', 'invalid');
    if (await codeOwner(bucket, normalized)) return errorResponse(409, 'This code is already used by another gallery', 'code_taken');
  } else {
    for (let i = 0; i < 6; i++) {
      code = accessCode(title);
      normalized = normalizeCode(code);
      if (!(await codeOwner(bucket, normalized))) break;
    }
  }
  const now = new Date().toISOString();
  const record: GalleryRecord = {
    id: randomId(16),
    code,
    title,
    subtitle: clip(body.subtitle, 160) || undefined,
    date: optionalDate(body.date),
    lang: body.lang === 'en' ? 'en' : 'he',
    status: 'draft',
    allowDownload: true,
    allowOriginals: false,
    faceSearch: true,
    sets: [],
    createdAt: now,
    updatedAt: now,
    photoCount: 0,
  };
  await putJson(bucket, keys.code(normalized), { galleryId: record.id });
  await saveRecord(bucket, record);
  return json({ ok: true, gallery: record });
}

export async function getGalleryAdmin(env: Env, gid: string): Promise<Response> {
  const bucket = bucketOf(env);
  const record = await getRecord(bucket, assertId(gid), true);
  if (!record) throw new HttpError(404, 'Gallery not found', 'not_found');
  const [photos, manifest, index, people] = await Promise.all([
    listPhotos(bucket, record),
    getManifest(bucket, gid),
    getJson<FaceIndex>(bucket, keys.facesIndex(gid)),
    getJson<{ people: Person[] }>(bucket, keys.people(gid)),
  ]);
  return json({
    ok: true,
    gallery: record,
    photos,
    manifestVersion: manifest?.version ?? null,
    faces: index ? { faces: index.faces.length, people: people?.people.length ?? 0 } : null,
  });
}

export async function updateGallery(request: Request, env: Env, gid: string): Promise<Response> {
  const bucket = bucketOf(env);
  const record = await getRecord(bucket, assertId(gid), true);
  if (!record) throw new HttpError(404, 'Gallery not found', 'not_found');
  const body = await readJson<Record<string, unknown>>(request);
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);

  if (has('title')) {
    const title = clip(body.title, 120);
    if (!title) return errorResponse(400, 'Title is required', 'invalid');
    record.title = title;
  }
  if (has('subtitle')) record.subtitle = clip(body.subtitle, 160) || undefined;
  if (has('date')) record.date = optionalDate(body.date);
  if (has('lang')) record.lang = body.lang === 'en' ? 'en' : 'he';
  if (has('message')) record.message = clip(body.message, 2000) || undefined;
  if (has('status')) {
    if (!['draft', 'published', 'archived'].includes(String(body.status))) return errorResponse(400, 'Invalid status', 'invalid');
    record.status = body.status as GalleryRecord['status'];
  }
  if (has('coverPhotoId')) {
    const cover = clip(body.coverPhotoId, 32);
    if (cover && !ID_RE.test(cover)) return errorResponse(400, 'Invalid cover', 'invalid');
    record.coverPhotoId = cover || undefined;
  }
  for (const flag of ['allowDownload', 'allowOriginals', 'faceSearch', 'live'] as const) {
    if (has(flag)) record[flag] = body[flag] === true;
  }
  if (has('expiresAt')) record.expiresAt = optionalDate(body.expiresAt);
  if (has('externalUrl')) record.externalUrl = optionalUrl(body.externalUrl);
  if (has('sets')) record.sets = sanitizeSets(body.sets);
  if (has('code')) {
    const code = clip(body.code, 40);
    const normalized = normalizeCode(code);
    if (normalized.length < 4) return errorResponse(400, 'Code is too short', 'invalid');
    const oldNormalized = normalizeCode(record.code);
    if (normalized !== oldNormalized) {
      const owner = await codeOwner(bucket, normalized);
      if (owner && owner !== record.id) return errorResponse(409, 'This code is already used by another gallery', 'code_taken');
      await putJson(bucket, keys.code(normalized), { galleryId: record.id });
      if ((await codeOwner(bucket, oldNormalized)) === record.id) await bucket.delete(keys.code(oldNormalized));
    }
    record.code = code;
  }
  await saveRecord(bucket, record);
  // Keep the public manifest in sync with settings changes once it exists.
  if (await bucket.head(keys.manifest(gid))) await buildManifest(bucket, record);
  return json({ ok: true, gallery: record });
}

export async function deleteGallery(env: Env, gid: string): Promise<Response> {
  const bucket = bucketOf(env);
  const record = await getRecord(bucket, assertId(gid), true);
  if (!record) throw new HttpError(404, 'Gallery not found', 'not_found');
  const deleted = await deletePrefix(bucket, keys.galleryPrefix(gid));
  const normalized = normalizeCode(record.code);
  if ((await codeOwner(bucket, normalized)) === gid) await bucket.delete(keys.code(normalized));
  forgetRecord(gid);
  forgetFaces(gid);
  return json({ ok: true, deleted });
}

export async function publishGallery(request: Request, env: Env, gid: string): Promise<Response> {
  const bucket = bucketOf(env);
  const record = await getRecord(bucket, assertId(gid), true);
  if (!record) throw new HttpError(404, 'Gallery not found', 'not_found');
  let status: unknown;
  if (request.headers.get('content-type')?.includes('application/json')) ({ status } = await readJson<{ status?: string }>(request));
  if (status === 'published' || status === 'draft') record.status = status;
  const manifest = await buildManifest(bucket, record);
  record.photoCount = manifest.photos.length;
  if (record.status === 'published') record.publishedAt = record.publishedAt ?? new Date().toISOString();
  await saveRecord(bucket, record);
  forgetFaces(gid);
  return json({ ok: true, manifest });
}

/* ───────────────────────────── photos ───────────────────────────── */

const intOrUndef = (v: unknown, max = Number.MAX_SAFE_INTEGER) =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max ? String(v) : undefined;

function photoMetaHeader(request: Request, required: boolean): Record<string, string> {
  const raw = request.headers.get('x-photo-meta');
  if (!raw) {
    if (required) throw new HttpError(400, 'Missing X-Photo-Meta header', 'invalid');
    return {};
  }
  let m: Record<string, unknown>;
  try {
    m = JSON.parse(raw.length > 4000 ? '{}' : decodeURIComponent(raw));
  } catch {
    try {
      m = JSON.parse(raw);
    } catch {
      throw new HttpError(400, 'Invalid X-Photo-Meta', 'invalid');
    }
  }
  const out: Record<string, string | undefined> = {
    w: intOrUndef(m.w, 30000),
    h: intOrUndef(m.h, 30000),
    set: clip(m.set, 24).replace(/[^a-z0-9-]/gi, '') || undefined,
    name: clip(m.name, 120) || undefined,
    order: intOrUndef(m.order),
    takenAt: clip(m.takenAt, 40) || undefined,
    webSize: intOrUndef(m.webSize),
    webCrc: intOrUndef(m.webCrc, 0xffffffff),
    origSize: intOrUndef(m.origSize),
    origCrc: intOrUndef(m.origCrc, 0xffffffff),
    origExt: clip(m.origExt, 8).replace(/[^a-z0-9]/gi, '').toLowerCase() || undefined,
    uploadedAt: new Date().toISOString(),
  };
  if (required && (!out.w || !out.h)) throw new HttpError(400, 'X-Photo-Meta needs w and h', 'invalid');
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)) as Record<string, string>;
}

export async function uploadPhoto(request: Request, env: Env, gid: string, pid: string, variant: string): Promise<Response> {
  const bucket = bucketOf(env);
  assertId(gid);
  assertId(pid, 'photo');
  if (!['thumb', 'web', 'original'].includes(variant)) throw new HttpError(400, 'Unknown variant', 'invalid');
  const record = await getRecord(bucket, gid);
  if (!record) throw new HttpError(404, 'Gallery not found', 'not_found');
  const type = (request.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
  if (!IMAGE_TYPES.has(type) && !(variant === 'original' && type === 'application/octet-stream')) throw new HttpError(415, 'Unsupported image type', 'invalid');
  const length = Number(request.headers.get('content-length'));
  if (!Number.isFinite(length) || length <= 0) throw new HttpError(411, 'Content-Length required', 'invalid');
  if (length > MAX_UPLOAD) throw new HttpError(413, 'File too large (max 100 MB)', 'too_large');
  if (variant !== 'original' && type !== 'image/jpeg') throw new HttpError(415, 'Thumb and web variants must be JPEG', 'invalid');
  const customMetadata = photoMetaHeader(request, variant === 'web');
  if (!request.body) throw new HttpError(400, 'Empty body', 'invalid');
  const stored = await bucket.put(keys.photo(gid, pid, variant), request.body, {
    httpMetadata: { contentType: type || 'application/octet-stream' },
    customMetadata,
  });
  return json({ ok: true, size: stored?.size ?? length });
}

export async function deletePhoto(env: Env, gid: string, pid: string): Promise<Response> {
  const bucket = bucketOf(env);
  assertId(gid);
  assertId(pid, 'photo');
  await bucket.delete(['thumb', 'web', 'original'].map((v) => keys.photo(gid, pid, v)));
  return json({ ok: true });
}

/* ───────────────────────────── faces ───────────────────────────── */

export async function putFaceIndex(request: Request, env: Env, gid: string): Promise<Response> {
  const bucket = bucketOf(env);
  assertId(gid);
  const index = await readJson<FaceIndex>(request, 8 * 1024 * 1024);
  if (!index || !Array.isArray(index.faces) || (index.dims ?? FACE_DIMS) !== FACE_DIMS) return errorResponse(400, 'Invalid face index', 'invalid');
  const clean: FaceIndex = {
    version: Number(index.version) || Date.now(),
    dims: FACE_DIMS,
    faces: index.faces.slice(0, 100_000).map((f) => {
      if (!f || typeof f.p !== 'string' || !ID_RE.test(f.p) || !Array.isArray(f.b) || f.b.length !== 4) throw new HttpError(400, 'Invalid face entry', 'invalid');
      const b = f.b.map((n) => Math.min(1, Math.max(0, Number(n) || 0))) as [number, number, number, number];
      return { p: f.p, b, s: typeof f.s === 'number' ? Math.round(f.s * 1000) / 1000 : undefined };
    }),
  };
  await putJson(bucket, keys.facesIndex(gid), clean);
  forgetFaces(gid);
  return json({ ok: true, faces: clean.faces.length });
}

export async function putFaceDescriptors(request: Request, env: Env, gid: string): Promise<Response> {
  const bucket = bucketOf(env);
  assertId(gid);
  const buf = await request.arrayBuffer();
  if (buf.byteLength > 16 * 1024 * 1024 || buf.byteLength % bytesPerFace() !== 0) return errorResponse(400, 'Invalid descriptor data', 'invalid');
  const index = await getJson<FaceIndex>(bucket, keys.facesIndex(gid));
  if (index && index.faces.length !== buf.byteLength / bytesPerFace()) return errorResponse(400, 'Descriptor count does not match the face index', 'invalid');
  await bucket.put(keys.facesBin(gid), buf, { httpMetadata: { contentType: 'application/octet-stream' } });
  forgetFaces(gid);
  return json({ ok: true });
}

export async function putPeople(request: Request, env: Env, gid: string): Promise<Response> {
  const bucket = bucketOf(env);
  assertId(gid);
  const { people } = await readJson<{ people?: Person[] }>(request, 4 * 1024 * 1024);
  if (!Array.isArray(people)) return errorResponse(400, 'Invalid people list', 'invalid');
  const clean: Person[] = people.slice(0, 2000).map((p) => {
    if (!p || typeof p.id !== 'string' || !ID_RE.test(p.id) || !Array.isArray(p.photoIds)) throw new HttpError(400, 'Invalid person', 'invalid');
    const photoIds = [...new Set(p.photoIds.filter((x) => typeof x === 'string' && ID_RE.test(x)))];
    return { id: p.id, photoIds, count: photoIds.length, hasCrop: p.hasCrop === true };
  });
  await putJson(bucket, keys.people(gid), { people: clean });
  return json({ ok: true, people: clean.length });
}

export async function putPersonCrop(request: Request, env: Env, gid: string, personId: string): Promise<Response> {
  const bucket = bucketOf(env);
  assertId(gid);
  assertId(personId, 'person');
  const type = request.headers.get('content-type') ?? '';
  if (!type.startsWith('image/jpeg') && !type.startsWith('image/webp')) throw new HttpError(415, 'Crop must be JPEG or WebP', 'invalid');
  const buf = await request.arrayBuffer();
  if (buf.byteLength > 512 * 1024) throw new HttpError(413, 'Crop too large', 'too_large');
  await bucket.put(keys.personCrop(gid, personId), buf, { httpMetadata: { contentType: type.split(';')[0]! } });
  return json({ ok: true });
}

export async function deleteFaces(env: Env, gid: string): Promise<Response> {
  const bucket = bucketOf(env);
  assertId(gid);
  await deletePrefix(bucket, `galleries/${gid}/faces/`);
  await deletePrefix(bucket, `galleries/${gid}/people/`);
  forgetFaces(gid);
  return json({ ok: true });
}

export async function listSelections(env: Env, gid: string): Promise<Response> {
  const bucket = bucketOf(env);
  assertId(gid);
  const { objects } = await listAll(bucket, keys.selectionsPrefix(gid));
  const selections = (await Promise.all(objects.map((o) => getJson<Selection>(bucket, o.key)))).filter((s): s is Selection => Boolean(s));
  selections.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return json({ ok: true, selections });
}

/* ───────────────────────────── leads ───────────────────────────── */

export async function listLeads(env: Env, url: URL): Promise<Response> {
  const bucket = bucketOf(env);
  const page = await bucket.list({ prefix: keys.leadsPrefix, limit: 50, cursor: url.searchParams.get('cursor') || undefined });
  const leads = (await Promise.all(page.objects.map((o) => getJson<Lead>(bucket, o.key)))).filter((l): l is Lead => Boolean(l));
  return json({ ok: true, leads, cursor: page.truncated ? page.cursor : undefined });
}

const leadIdOk = (id: string) => /^\d{13}-[A-Za-z0-9]{6}$/.test(id);

export async function updateLead(request: Request, env: Env, id: string): Promise<Response> {
  const bucket = bucketOf(env);
  if (!leadIdOk(id)) throw new HttpError(400, 'Invalid id', 'invalid');
  const lead = await getJson<Lead>(bucket, keys.lead(id));
  if (!lead) throw new HttpError(404, 'Not found', 'not_found');
  const body = await readJson<{ status?: string; notes?: string }>(request);
  if (body.status !== undefined) {
    if (!LEAD_STATUSES.includes(body.status as LeadStatus)) return errorResponse(400, 'Invalid status', 'invalid');
    lead.status = body.status as LeadStatus;
  }
  if (body.notes !== undefined) lead.notes = clip(body.notes, 5000) || undefined;
  await putJson(bucket, keys.lead(id), lead);
  return json({ ok: true, lead });
}

export async function deleteLead(env: Env, id: string): Promise<Response> {
  const bucket = bucketOf(env);
  if (!leadIdOk(id)) throw new HttpError(400, 'Invalid id', 'invalid');
  await bucket.delete(keys.lead(id));
  return json({ ok: true });
}

/* ───────────────────────────── availability ───────────────────────────── */

export async function getAvailability(env: Env, admin = false): Promise<Response> {
  if (!env.BUCKET) return errorResponse(503, 'Not configured', 'unavailable');
  const data = (await getJson<Availability>(env.BUCKET, keys.availability)) ?? { booked: [], limited: [] };
  return json({ booked: data.booked ?? [], limited: data.limited ?? [], updatedAt: data.updatedAt }, { cache: admin ? 'no-store' : 'public, max-age=120' });
}

export async function putAvailability(request: Request, env: Env): Promise<Response> {
  const bucket = bucketOf(env);
  const body = await readJson<{ booked?: unknown; limited?: unknown }>(request);
  const clean = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((d): d is string => typeof d === 'string' && DATE_RE.test(d)))].sort().slice(0, 2000) : []);
  const booked = clean(body.booked);
  const limited = clean(body.limited).filter((d) => !booked.includes(d));
  await putJson(bucket, keys.availability, { booked, limited, updatedAt: new Date().toISOString() } satisfies Availability);
  return json({ ok: true });
}

/* ───────────────────────────── router ───────────────────────────── */

export async function handleAdmin(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname.replace(/^\/api\/admin/, '') || '/';
  const method = request.method;
  if (path === '/login' && method === 'POST') return login(request, env);
  if (path === '/logout' && method === 'POST') return logout(request);

  if (!(await isAdmin(request, env))) return errorResponse(401, 'Please sign in', 'unauthorized');
  if (method !== 'GET' && method !== 'HEAD' && !hasCsrfHeader(request)) return errorResponse(403, 'Missing X-Requested-With header', 'csrf');

  if (path === '/session') return json({ ok: true });
  if (path === '/galleries') {
    if (method === 'GET') return listGalleries(env);
    if (method === 'POST') return createGallery(request, env);
  }
  if (path === '/leads' && method === 'GET') return listLeads(env, url);
  if (path === '/availability') {
    if (method === 'GET') return getAvailability(env, true);
    if (method === 'PUT') return putAvailability(request, env);
  }

  let m: RegExpMatchArray | null;
  if ((m = path.match(/^\/leads\/([^/]+)$/))) {
    if (method === 'PATCH') return updateLead(request, env, m[1]!);
    if (method === 'DELETE') return deleteLead(env, m[1]!);
  }
  if ((m = path.match(/^\/galleries\/([^/]+)$/))) {
    if (method === 'GET') return getGalleryAdmin(env, m[1]!);
    if (method === 'PATCH') return updateGallery(request, env, m[1]!);
    if (method === 'DELETE') return deleteGallery(env, m[1]!);
  }
  if ((m = path.match(/^\/galleries\/([^/]+)\/publish$/)) && method === 'POST') return publishGallery(request, env, m[1]!);
  if ((m = path.match(/^\/galleries\/([^/]+)\/selections$/)) && method === 'GET') return listSelections(env, m[1]!);
  if ((m = path.match(/^\/galleries\/([^/]+)\/photos\/([^/]+)\/(thumb|web|original)$/)) && method === 'PUT') return uploadPhoto(request, env, m[1]!, m[2]!, m[3]!);
  if ((m = path.match(/^\/galleries\/([^/]+)\/photos\/([^/]+)$/)) && method === 'DELETE') return deletePhoto(env, m[1]!, m[2]!);
  if ((m = path.match(/^\/galleries\/([^/]+)\/faces\/index$/)) && method === 'PUT') return putFaceIndex(request, env, m[1]!);
  if ((m = path.match(/^\/galleries\/([^/]+)\/faces\/descriptors$/)) && method === 'PUT') return putFaceDescriptors(request, env, m[1]!);
  if ((m = path.match(/^\/galleries\/([^/]+)\/faces\/people$/)) && method === 'PUT') return putPeople(request, env, m[1]!);
  if ((m = path.match(/^\/galleries\/([^/]+)\/faces$/)) && method === 'DELETE') return deleteFaces(env, m[1]!);
  if ((m = path.match(/^\/galleries\/([^/]+)\/people\/([^/]+)$/)) && method === 'PUT') return putPersonCrop(request, env, m[1]!, m[2]!);

  return errorResponse(404, 'Unknown admin endpoint', 'not_found');
}
