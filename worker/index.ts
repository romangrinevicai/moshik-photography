/**
 * Moshik Photography — Cloudflare Worker.
 *
 * Static pages are served straight from ./dist by the assets binding;
 * only /api/* and /media/* reach this code (see run_worker_first in
 * wrangler.jsonc).
 */
import type { Env } from './env';
import { HttpError, errorResponse } from './lib/http';
import { handleInquiry } from './routes/inquiry';
import { accessGallery, createSelection, downloadZip, faceSearch, getGallery } from './routes/gallery';
import { getAvailability, handleAdmin } from './routes/admin';
import { handleMedia } from './routes/media';

async function handleApi(request: Request, env: Env, ctx: ExecutionContext, url: URL): Promise<Response> {
  const { pathname: path } = url;
  const method = request.method;

  if (path.startsWith('/api/admin/')) return handleAdmin(request, env, url);
  if (path === '/api/availability' && method === 'GET') return getAvailability(env);
  if (path === '/api/inquiry' && method === 'POST') return handleInquiry(request, env, ctx);
  if (path === '/api/gallery/access' && method === 'POST') return accessGallery(request, env);

  let m: RegExpMatchArray | null;
  if ((m = path.match(/^\/api\/gallery\/([^/]+)$/)) && method === 'GET') return getGallery(request, env, m[1]!);
  if ((m = path.match(/^\/api\/gallery\/([^/]+)\/faces\/search$/)) && method === 'POST') return faceSearch(request, env, m[1]!);
  if ((m = path.match(/^\/api\/gallery\/([^/]+)\/selections$/)) && method === 'POST') return createSelection(request, env, ctx, m[1]!);
  if ((m = path.match(/^\/api\/gallery\/([^/]+)\/zip$/)) && method === 'GET') return downloadZip(request, env, m[1]!, url);
  if (path === '/api/health') return Response.json({ ok: true, storage: Boolean(env.BUCKET), admin: Boolean(env.ADMIN_PASSWORD) });

  return errorResponse(404, 'Not found', 'not_found');
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/api/')) return await handleApi(request, env, ctx, url);
      if (url.pathname.startsWith('/media/')) return await handleMedia(request, env, url);
      return env.ASSETS.fetch(request);
    } catch (err) {
      if (err instanceof HttpError) return errorResponse(err.status, err.message, err.code);
      console.error('Unhandled error', err);
      return errorResponse(500, 'Something went wrong', 'internal');
    }
  },
} satisfies ExportedHandler<Env>;
