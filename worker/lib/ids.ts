const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomFrom(alphabet: string, length: number): string {
  const out: string[] = [];
  const max = Math.floor(256 / alphabet.length) * alphabet.length;
  while (out.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
    for (const b of bytes) {
      if (b < max && out.length < length) out.push(alphabet[b % alphabet.length]!);
    }
  }
  return out.join('');
}

/** Unguessable identifier (≈ 93 bits for 16 chars). */
export const randomId = (length = 16) => randomFrom(ID_ALPHABET, length);

/** Human-friendly access code, e.g. "NOA-DANIEL-K7QM" or "M-K7QM-3XPA". */
export function accessCode(title = ''): string {
  const words = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .match(/[A-Z]{2,}/g);
  const name = (words ?? []).filter((w) => !['AND', 'THE', 'OF'].includes(w)).slice(0, 2).join('-').slice(0, 14);
  return name ? `${name}-${randomFrom(CODE_ALPHABET, 4)}` : `M-${randomFrom(CODE_ALPHABET, 4)}-${randomFrom(CODE_ALPHABET, 4)}`;
}

/** Codes are matched case-insensitively and ignoring dashes/spaces. */
export const normalizeCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 40);

/** Leads sort newest-first in R2 listings thanks to an inverted timestamp. */
export const leadId = (now = Date.now()) => `${String(9_999_999_999_999 - now).padStart(13, '0')}-${randomFrom(ID_ALPHABET, 6)}`;
