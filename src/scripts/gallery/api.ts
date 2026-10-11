/** Client for the public gallery API (see docs/ARCHITECTURE.md → API). */
import type { FaceSearchMatch, GalleryManifest, PhotoVariant } from '~/shared/gallery-types';

/**
 * `http`    — the API answered with an error status (see `status` / `code`)
 * `network` — no connection / the request never completed
 * `offline` — something answered, but not our API (galleries not deployed yet)
 */
export type ApiErrorKind = 'http' | 'network' | 'offline';

export class ApiError extends Error {
  constructor(
    public kind: ApiErrorKind,
    public status = 0,
    public code?: string,
    message?: string,
  ) {
    super(message ?? `${kind}${status ? ` ${status}` : ''}${code ? ` ${code}` : ''}`);
  }
}

async function request<T>(path: string, init: RequestInit & { json?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const { json, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(path, {
      ...rest,
      method: rest.method ?? (json !== undefined ? 'POST' : 'GET'),
      credentials: 'same-origin',
      headers: { accept: 'application/json', ...(json !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: json !== undefined ? JSON.stringify(json) : undefined,
      cache: 'no-store',
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ApiError('network');
  }
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) {
    // A static host (or a 404 page) answered instead of the Worker.
    throw new ApiError(res.status >= 500 && res.status !== 501 ? 'http' : 'offline', res.status);
  }
  let data: ({ ok?: boolean; error?: string; code?: string } & Record<string, unknown>) | null = null;
  try {
    data = await res.json();
  } catch {
    throw new ApiError('offline', res.status);
  }
  if (!res.ok || !data || data.ok === false) {
    throw new ApiError('http', res.status, data?.code, data?.error);
  }
  return data as T;
}

const enc = encodeURIComponent;

export const api = {
  access: (code: string) => request<{ ok: true; id: string; title: string }>('/api/gallery/access', { json: { code } }),
  gallery: (gid: string, signal?: AbortSignal) => request<{ ok: true; gallery: GalleryManifest }>(`/api/gallery/${enc(gid)}`, { signal }).then((r) => r.gallery),
  searchFaces: (gid: string, descriptor: number[]) =>
    request<{ ok: true; matches: FaceSearchMatch[] }>(`/api/gallery/${enc(gid)}/faces/search`, { json: { descriptor } }).then((r) => r.matches ?? []),
  sendSelection: (gid: string, body: { name: string; email?: string; phone?: string; note?: string; photoIds: string[] }) =>
    request<{ ok: true; id: string }>(`/api/gallery/${enc(gid)}/selections`, { json: body }),
};

export const media = {
  photo: (gid: string, pid: string, variant: PhotoVariant, download = false) => `/media/${enc(gid)}/${enc(pid)}/${variant}${download ? '?dl=1' : ''}`,
  person: (gid: string, personId: string) => `/media/${enc(gid)}/people/${enc(personId)}`,
  zipPart: (gid: string, variant: 'web' | 'original', part: number) => `/api/gallery/${enc(gid)}/zip?variant=${variant}&part=${part}`,
  zipIds: (gid: string, variant: 'web' | 'original', ids: string[]) => `/api/gallery/${enc(gid)}/zip?variant=${variant}&ids=${ids.map(enc).join(',')}`,
};
