/**
 * Admin API client. Every request is same-origin with the session cookie;
 * mutating requests carry the CSRF header the Worker requires. A 401 from
 * any authenticated call sends the app back to the login screen.
 */
import { C, T } from './i18n';

export const CSRF_HEADER = { 'X-Requested-With': 'moshik-admin' } as const;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const UNAUTHORIZED_EVENT = 'adm:unauthorized';
const unauthorized = () => window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));

export const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

interface Options {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** Set false for login/session calls, where 401 is an expected answer. */
  auth?: boolean;
}

export async function api<T = { ok: true }>(path: string, opts: Options = {}): Promise<T> {
  const method = opts.method ?? (opts.body !== undefined ? 'POST' : 'GET');
  const headers: Record<string, string> = { accept: 'application/json' };
  if (method !== 'GET') Object.assign(headers, CSRF_HEADER);
  let body: BodyInit | undefined;
  if (opts.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  let res: Response;
  try {
    res = await fetch(path, { method, headers, body, credentials: 'same-origin', cache: 'no-store', signal: opts.signal });
  } catch (e) {
    if (isAbort(e)) throw e;
    throw new ApiError(0, 'network', 'network');
  }
  let data: unknown = null;
  if ((res.headers.get('content-type') ?? '').includes('json')) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  }
  const obj = (data ?? {}) as { ok?: boolean; error?: string; code?: string };
  if (res.status === 401 && opts.auth !== false) unauthorized();
  if (!res.ok || obj.ok === false) throw new ApiError(res.status, obj.error || res.statusText || 'error', obj.code, data);
  return data as T;
}

/** Friendly message for any thrown error. */
export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return T(C.network);
    if (e.status === 404) return T(C.notFound);
    if (e.status === 413) return T(C.tooLarge);
    if (e.status === 429) return T(C.tooMany);
    if (e.status >= 500) return T(C.server);
    return T(C.error);
  }
  return T(C.error);
}

/* ─────────────────────────── uploads (XHR for progress) ─────────────────────────── */

export interface PutOptions {
  contentType: string;
  headers?: Record<string, string>;
  onProgress?: (loaded: number) => void;
  signal?: AbortSignal;
  /** Abort when no bytes move for this long (flaky Wi-Fi). */
  stallMs?: number;
}

export function putBlob(url: string, body: Blob, opts: PutOptions): Promise<{ ok: true; size?: number }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let stallTimer = 0;
    let stalled = false;
    const clearStall = () => window.clearTimeout(stallTimer);
    const armStall = () => {
      clearStall();
      if (!opts.stallMs) return;
      stallTimer = window.setTimeout(() => {
        stalled = true;
        xhr.abort();
      }, opts.stallMs);
    };
    const onAbortSignal = () => xhr.abort();
    const cleanup = () => {
      clearStall();
      opts.signal?.removeEventListener('abort', onAbortSignal);
    };

    xhr.open('PUT', url, true);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', opts.contentType);
    xhr.setRequestHeader('X-Requested-With', CSRF_HEADER['X-Requested-With']);
    for (const [k, v] of Object.entries(opts.headers ?? {})) xhr.setRequestHeader(k, v);
    xhr.responseType = 'text';

    xhr.upload.onprogress = (e) => {
      armStall();
      opts.onProgress?.(e.loaded);
    };
    xhr.onload = () => {
      cleanup();
      let data: { ok?: boolean; error?: string; code?: string; size?: number } = {};
      try {
        data = JSON.parse(xhr.responseText || '{}');
      } catch {
        /* not JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300 && data.ok !== false) {
        resolve({ ok: true, size: data.size });
        return;
      }
      if (xhr.status === 401) unauthorized();
      const err = new ApiError(xhr.status, data.error || xhr.statusText || 'error', data.code, data);
      (err as ApiError & { retryAfter?: number }).retryAfter = Number(xhr.getResponseHeader('Retry-After')) || undefined;
      reject(err);
    };
    xhr.onerror = () => {
      cleanup();
      reject(new ApiError(0, 'network', 'network'));
    };
    xhr.onabort = () => {
      cleanup();
      if (stalled) reject(new ApiError(0, 'stalled', 'stalled'));
      else reject(new DOMException('Aborted', 'AbortError'));
    };
    if (opts.signal) {
      if (opts.signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      opts.signal.addEventListener('abort', onAbortSignal, { once: true });
    }
    armStall();
    xhr.send(body);
  });
}

/** Encode metadata for the X-Photo-Meta header (headers can't carry raw Hebrew). */
export const encodeMeta = (meta: Record<string, unknown>) => encodeURIComponent(JSON.stringify(meta));
