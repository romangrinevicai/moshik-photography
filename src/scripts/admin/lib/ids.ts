/** Random identifiers and access-code suggestions (browser side). */
const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomFrom(alphabet: string, length: number): string {
  const out: string[] = [];
  // Rejection sampling keeps every character equally likely.
  const max = Math.floor(256 / alphabet.length) * alphabet.length;
  while (out.length < length) {
    for (const b of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (b < max && out.length < length) out.push(alphabet[b % alphabet.length]!);
    }
  }
  return out.join('');
}

/** 16 random base62 characters (matches ID_RE). */
export const photoId = () => randomFrom(BASE62, 16);
export const shortId = (n = 8) => randomFrom(BASE62, n);

/** Same shape as the Worker's codes: "NOA-DANIEL-K7QM" or "M-K7QM-3XPA". */
export function suggestCode(...sources: (string | undefined)[]): string {
  for (const src of sources) {
    const words = (src ?? '')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .match(/[A-Z]{2,}/g);
    const name = (words ?? [])
      .filter((w) => !['AND', 'THE', 'OF', 'WEDDING', 'BAR', 'BAT', 'MITZVAH'].includes(w))
      .slice(0, 2)
      .join('-')
      .slice(0, 14);
    if (name) return `${name}-${randomFrom(CODE_ALPHABET, 4)}`;
  }
  return `M-${randomFrom(CODE_ALPHABET, 4)}-${randomFrom(CODE_ALPHABET, 4)}`;
}

/** Codes may use letters, digits and dashes. */
export const cleanCode = (s: string) =>
  s
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 40);
