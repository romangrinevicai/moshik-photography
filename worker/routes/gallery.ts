import type { Env } from '../env';
import type { Selection } from '../../src/shared/gallery-types';
import { ZIP_PART_SIZE } from '../../src/shared/gallery-types';
import { isAdmin } from '../lib/auth';
import { assertId, assertVisible, getManifest, getRecord, safeName } from '../lib/galleries';
import { isValidDescriptor, loadFaces, searchFaces } from '../lib/faces';
import { HttpError, allow, clientIp, clip, errorResponse, json, readJson, sleep } from '../lib/http';
import { normalizeCode, randomId } from '../lib/ids';
import { emailTemplate, sendEmail, sendTelegram } from '../lib/notify';
import { createZipStream, type ZipEntry } from '../lib/zip';
import { getJson, keys, putJson } from '../lib/storage';

function bucketOf(env: Env): R2Bucket {
  if (!env.BUCKET) throw new HttpError(503, 'Client galleries are not configured', 'unavailable');
  return env.BUCKET;
}

/** POST /api/gallery/access { code } */
export async function accessGallery(request: Request, env: Env): Promise<Response> {
  const bucket = bucketOf(env);
  const ip = clientIp(request);
  if (!(await allow(env.ACCESS_LIMITER, `code:${ip}`, { limit: 12, windowMs: 60_000 }))) return errorResponse(429, 'Too many attempts', 'rate_limited');
  const { code } = await readJson<{ code?: string }>(request, 2048);
  const normalized = normalizeCode(code ?? '');
  if (normalized.length < 4) return errorResponse(400, 'Please enter a code', 'invalid');
  const mapping = await getJson<{ galleryId: string }>(bucket, keys.code(normalized));
  if (!mapping) {
    await sleep(250 + Math.random() * 250);
    return errorResponse(404, 'Gallery not found', 'not_found');
  }
  const admin = await isAdmin(request, env);
  const record = assertVisible(await getRecord(bucket, mapping.galleryId, true), admin);
  return json({ ok: true, id: record.id, title: record.title });
}

/** GET /api/gallery/{gid} */
export async function getGallery(request: Request, env: Env, gid: string): Promise<Response> {
  const bucket = bucketOf(env);
  assertId(gid, 'gallery');
  const admin = await isAdmin(request, env);
  assertVisible(await getRecord(bucket, gid), admin);
  const manifest = await getManifest(bucket, gid);
  if (!manifest) throw new HttpError(403, 'This gallery is not published yet', 'draft');
  return json({ ok: true, gallery: manifest }, { cache: 'private, max-age=20' });
}

/** POST /api/gallery/{gid}/faces/search { descriptor } */
export async function faceSearch(request: Request, env: Env, gid: string): Promise<Response> {
  const bucket = bucketOf(env);
  assertId(gid, 'gallery');
  const ip = clientIp(request);
  if (!(await allow(env.ACCESS_LIMITER, `face:${ip}`, { limit: 30, windowMs: 60_000 }))) return errorResponse(429, 'Too many searches', 'rate_limited');
  const admin = await isAdmin(request, env);
  const record = assertVisible(await getRecord(bucket, gid), admin);
  if (!record.faceSearch) throw new HttpError(404, 'Face search is off for this gallery', 'no_faces');
  const { descriptor } = await readJson<{ descriptor?: unknown }>(request, 16 * 1024);
  if (!isValidDescriptor(descriptor)) return errorResponse(400, 'Invalid descriptor', 'invalid');
  const manifest = await getManifest(bucket, gid);
  const faces = await loadFaces(bucket, gid);
  if (!faces || !manifest) throw new HttpError(404, 'No face data for this gallery', 'no_faces');
  const matches = searchFaces(descriptor, faces, undefined, new Set(manifest.photos.map((p) => p.id)));
  return json({ ok: true, matches });
}

/** POST /api/gallery/{gid}/selections */
export async function createSelection(request: Request, env: Env, ctx: ExecutionContext, gid: string): Promise<Response> {
  const bucket = bucketOf(env);
  assertId(gid, 'gallery');
  const ip = clientIp(request);
  if (!(await allow(env.INQUIRY_LIMITER, `sel:${ip}`, { limit: 6, windowMs: 60_000 }))) return errorResponse(429, 'Too many requests', 'rate_limited');
  const admin = await isAdmin(request, env);
  const record = assertVisible(await getRecord(bucket, gid), admin);
  const body = await readJson<Record<string, unknown>>(request, 128 * 1024);
  const manifest = await getManifest(bucket, gid);
  const valid = new Set(manifest?.photos.map((p) => p.id) ?? []);
  const photoIds = Array.isArray(body.photoIds) ? [...new Set(body.photoIds.filter((x): x is string => typeof x === 'string' && valid.has(x)))].slice(0, 3000) : [];
  const name = clip(body.name, 100);
  if (name.length < 2 || photoIds.length === 0) return errorResponse(400, 'Please add your name and pick some photos', 'invalid');
  const selection: Selection = {
    id: `${Date.now()}-${randomId(6)}`,
    name,
    email: clip(body.email, 160) || undefined,
    phone: clip(body.phone, 40) || undefined,
    note: clip(body.note, 2000) || undefined,
    photoIds,
    createdAt: new Date().toISOString(),
  };
  await putJson(bucket, keys.selection(gid, selection.id), selection);
  const site = (env.SITE_URL || '').replace(/\/$/, '');
  const subject = `💛 ${name} בחר/ה ${photoIds.length} תמונות — ${record.title}`;
  const rows: [string, string][] = [
    ['גלריה', record.title],
    ['שם', name],
    ['טלפון', selection.phone ?? ''],
    ['אימייל', selection.email ?? ''],
    ['מספר תמונות', String(photoIds.length)],
    ['הערה', selection.note ?? ''],
  ];
  ctx.waitUntil(
    Promise.allSettled([
      sendEmail(env, {
        subject,
        html: emailTemplate({
          title: 'בחירת תמונות חדשה לאלבום',
          rows,
          actions: site ? [{ label: 'צפייה בממשק הניהול', href: `${site}/admin/#/galleries/${gid}` }] : [],
          rtl: true,
        }),
        text: [subject, ...rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`)].join('\n'),
        replyTo: selection.email,
      }),
      sendTelegram(env, [subject, ...rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`)].join('\n')),
    ]),
  );
  return json({ ok: true, id: selection.id });
}

/** GET /api/gallery/{gid}/zip?variant=web|original&part=N | &ids=a,b */
export async function downloadZip(request: Request, env: Env, gid: string, url: URL): Promise<Response> {
  const bucket = bucketOf(env);
  assertId(gid, 'gallery');
  const admin = await isAdmin(request, env);
  const record = assertVisible(await getRecord(bucket, gid), admin);
  if (!record.allowDownload && !admin) throw new HttpError(403, 'Downloads are disabled for this gallery', 'forbidden');
  const variant = url.searchParams.get('variant') === 'original' ? 'original' : 'web';
  if (variant === 'original' && !record.allowOriginals && !admin) throw new HttpError(403, 'Original files are not available', 'forbidden');
  const manifest = await getManifest(bucket, gid);
  if (!manifest) throw new HttpError(404, 'Gallery not published', 'draft');

  const indexed = manifest.photos.map((p, i) => ({ p, n: i + 1 }));
  let chosen = indexed;
  let suffix = '';
  const ids = url.searchParams.get('ids');
  if (ids) {
    const wanted = new Set(ids.split(',').slice(0, ZIP_PART_SIZE));
    chosen = indexed.filter(({ p }) => wanted.has(p.id));
    suffix = ' - favourites';
  } else {
    const parts = Math.max(1, Math.ceil(indexed.length / ZIP_PART_SIZE));
    const part = Math.min(parts, Math.max(1, Number(url.searchParams.get('part')) || 1));
    chosen = indexed.slice((part - 1) * ZIP_PART_SIZE, part * ZIP_PART_SIZE);
    if (parts > 1) suffix = ` - part ${part} of ${parts}`;
  }
  const folder = safeName(record.title);
  const entries: ZipEntry[] = [];
  for (const { p, n } of chosen) {
    const size = variant === 'original' ? p.origSize : p.webSize;
    const crc = variant === 'original' ? p.origCrc : p.webCrc;
    if (size === undefined || crc === undefined) continue; // can't stream without a checksum
    const ext = variant === 'original' ? (p.origExt || 'jpg').toLowerCase() : 'jpg';
    const base = p.name ? safeName(p.name.replace(/\.[a-z0-9]+$/i, ''), p.id) : p.id;
    entries.push({
      name: `${folder}/${String(n).padStart(4, '0')} - ${base}.${ext}`,
      size,
      crc,
      date: p.takenAt ? new Date(p.takenAt) : undefined,
      open: async () => (await bucket.get(keys.photo(gid, p.id, variant)))?.body ?? null,
    });
  }
  if (!entries.length) throw new HttpError(404, 'No downloadable photos', 'empty');
  const { stream, size } = createZipStream(entries);
  const filename = `${folder}${suffix}.zip`;
  // FixedLengthStream lets the runtime send a real Content-Length, so browsers show progress.
  let body: ReadableStream<Uint8Array> = stream;
  if (typeof FixedLengthStream !== 'undefined') {
    const fixed = new FixedLengthStream(size);
    stream.pipeTo(fixed.writable).catch((err) => console.error('zip stream failed', err));
    body = fixed.readable;
  }
  return new Response(body, {
    headers: {
      'content-type': 'application/zip',
      'content-length': String(size),
      'content-disposition': `attachment; filename="${filename.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'cache-control': 'private, no-store',
    },
  });
}
