/**
 * Error thrown by the face module. `code` is stable so the UI can show a
 * localised message; `message` is an English explanation for logs.
 *
 * - `unsupported` the browser cannot run the models (no canvas / WebGL / WASM)
 * - `models`      the model files could not be downloaded
 * - `decode`      an image could not be decoded
 * - `network`     a request failed (offline, DNS, CORS…)
 * - `auth`        the admin session is missing or expired (HTTP 401/403)
 * - `server`      the API answered with an error (other HTTP status)
 */
export type FaceErrorCode = 'unsupported' | 'models' | 'decode' | 'network' | 'auth' | 'server';

export class FaceError extends Error {
  readonly code: FaceErrorCode;
  /** HTTP status, when the error comes from a response. */
  readonly status?: number;

  constructor(code: FaceErrorCode, message: string, options: { status?: number; cause?: unknown } = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'FaceError';
    this.code = code;
    if (options.status !== undefined) this.status = options.status;
  }
}

/** Throws the signal's AbortError when it has been aborted. */
export function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  if (typeof signal.throwIfAborted === 'function') signal.throwIfAborted();
  throw new DOMException('The operation was aborted.', 'AbortError');
}

export const isAbortError = (err: unknown): boolean =>
  err instanceof DOMException ? err.name === 'AbortError' : (err as { name?: string } | null)?.name === 'AbortError';
