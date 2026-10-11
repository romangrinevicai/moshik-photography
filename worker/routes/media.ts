import type { Env } from '../env';
import { isAdmin } from '../lib/auth';
import { assertId, getRecord, isExpired, safeName } from '../lib/galleries';
import { HttpError } from '../lib/http';
import { keys } from '../lib/storage';

const VARIANTS = new Set(['thumb', 'web', 'original']);

/**
 * GET /media/{gid}/{pid}/{thumb|web|original}[?dl=1]
 * GET /media/{gid}/people/{personId}
 */
export async function handleMedia(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') throw new HttpError(405, 'Method not allowed');
  const bucket = env.BUCKET;
  if (!bucket) throw new HttpError(503, 'Media storage is not configured', 'unavailable');
  const [, , gidRaw, second, third] = url.pathname.split('/');
  const gid = assertId(gidRaw, 'gallery');
  const record = await getRecord(bucket, gid);
  if (!record) throw new HttpError(404, 'Not found', 'not_found');

  const publicOk = record.status === 'published' && !isExpired(record);
  const admin = publicOk ? false : await isAdmin(request, env);
  if (!publicOk && !admin) throw new HttpError(404, 'Not found', 'not_found');

  let key: string;
  let variant = 'web';
  let pid = '';
  if (second === 'people') {
    key = keys.personCrop(gid, assertId(third, 'person'));
  } else {
    pid = assertId(second, 'photo');
    variant = third ?? '';
    if (!VARIANTS.has(variant)) throw new HttpError(400, 'Unknown variant', 'invalid');
    key = keys.photo(gid, pid, variant);
  }

  const download = url.searchParams.has('dl');
  if (!admin) {
    if (variant === 'original' && !record.allowOriginals) throw new HttpError(403, 'Original files are not available', 'forbidden');
    if (download && !record.allowDownload) throw new HttpError(403, 'Downloads are disabled', 'forbidden');
  }

  const obj = await bucket.get(key, { onlyIf: request.headers });
  if (!obj) throw new HttpError(404, 'Not found', 'not_found');
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  if (!headers.has('content-type')) headers.set('content-type', 'image/jpeg');
  headers.set('etag', obj.httpEtag);
  headers.set('x-content-type-options', 'nosniff');
  // Photo ids are immutable, so published media can be cached for a year.
  headers.set('cache-control', publicOk ? 'public, max-age=31536000, immutable' : 'private, max-age=300');
  if (download) {
    const ext = variant === 'original' ? (obj.customMetadata?.origExt || headers.get('content-type')?.split('/')[1] || 'jpg') : 'jpg';
    const name = `${safeName(record.title)} - ${obj.customMetadata?.name?.replace(/\.[a-z0-9]+$/i, '') || pid}.${ext}`;
    headers.set('content-disposition', `attachment; filename="${name.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`);
  }
  // `onlyIf` precondition failed → R2 returns metadata without a body.
  if (!('body' in obj)) return new Response(null, { status: 304, headers });
  return new Response(request.method === 'HEAD' ? null : (obj as R2ObjectBody).body, { headers });
}
