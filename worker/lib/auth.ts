import type { Env } from '../env';

const enc = new TextEncoder();
export const SESSION_COOKIE = 'mp_admin';
const SESSION_DAYS = 14;

const b64url = (bytes: ArrayBuffer | Uint8Array) => {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  const subtle = crypto.subtle as SubtleCrypto & { timingSafeEqual?: (a: ArrayBufferView, b: ArrayBufferView) => boolean };
  if (ab.length !== bb.length) {
    // still spend comparable time
    if (subtle.timingSafeEqual) subtle.timingSafeEqual(ab, ab);
    return false;
  }
  if (subtle.timingSafeEqual) return subtle.timingSafeEqual(ab, bb);
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i]! ^ bb[i]!;
  return diff === 0;
}

const secretOf = (env: Env) => env.SESSION_SECRET || (env.ADMIN_PASSWORD ? `pw:${env.ADMIN_PASSWORD}` : '');

export async function createSession(env: Env, now = Date.now()): Promise<{ token: string; maxAge: number }> {
  const secret = secretOf(env);
  if (!secret) throw new Error('No session secret configured');
  const maxAge = SESSION_DAYS * 24 * 3600;
  const exp = Math.floor(now / 1000) + maxAge;
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(12)));
  const payload = `v1.${exp}.${nonce}`;
  return { token: `${payload}.${await hmac(secret, payload)}`, maxAge };
}

export async function verifySession(env: Env, token: string | null | undefined, now = Date.now()): Promise<boolean> {
  const secret = secretOf(env);
  if (!secret || !token) return false;
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp * 1000 < now) return false;
  const expected = await hmac(secret, parts.slice(0, 3).join('.'));
  return safeEqual(expected, parts[3]!);
}

export function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(/;\s*/)) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return null;
}

export function sessionCookie(token: string, maxAge: number, secure: boolean): string {
  return [`${SESSION_COOKIE}=${encodeURIComponent(token)}`, 'Path=/', `Max-Age=${maxAge}`, 'HttpOnly', 'SameSite=Strict', secure ? 'Secure' : ''].filter(Boolean).join('; ');
}

export const clearCookie = (secure: boolean) => sessionCookie('', 0, secure);

export const isAdmin = (request: Request, env: Env) => verifySession(env, getCookie(request, SESSION_COOKIE));

/**
 * Mutating admin requests must carry a custom header. Browsers can't send it
 * cross-site without a CORS preflight (which we never allow), so together
 * with the SameSite=Strict cookie this blocks CSRF.
 */
export const hasCsrfHeader = (request: Request) => request.headers.get('x-requested-with') === 'moshik-admin';
