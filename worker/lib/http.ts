import type { RateLimiter } from '../env';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export function json(data: unknown, init: { status?: number; cache?: string; headers?: Record<string, string> } = {}): Response {
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': init.cache ?? 'no-store',
      'x-content-type-options': 'nosniff',
      ...init.headers,
    },
  });
}

export const errorResponse = (status: number, message: string, code?: string) => json({ ok: false, error: message, code }, { status });

export async function readJson<T>(request: Request, maxBytes = 64 * 1024): Promise<T> {
  const type = request.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) throw new HttpError(415, 'Expected application/json');
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > maxBytes) throw new HttpError(413, 'Request too large');
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, 'Request too large');
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}

export const clientIp = (request: Request) => request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';

/** Fallback limiter for local development or when no binding is configured. */
const memory = new Map<string, { count: number; reset: number }>();
function memoryLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || entry.reset < now) {
    memory.set(key, { count: 1, reset: now + windowMs });
    if (memory.size > 5000) for (const [k, v] of memory) if (v.reset < now) memory.delete(k);
    return true;
  }
  entry.count++;
  return entry.count <= limit;
}

export async function allow(limiter: RateLimiter | undefined, key: string, fallback: { limit: number; windowMs: number }): Promise<boolean> {
  if (limiter) {
    try {
      return (await limiter.limit({ key })).success;
    } catch {
      /* fall through to the in-memory limiter */
    }
  }
  return memoryLimit(key, fallback.limit, fallback.windowMs);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function clip(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  // strip control characters except newlines/tabs
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}
