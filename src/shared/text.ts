const escapeMap: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => escapeMap[c]!);

/** "Moments worth *keeping*" → "Moments worth <em>keeping</em>" (input is escaped first). */
export function accent(s: string): string {
  return escapeHtml(s).replace(/\*(.+?)\*/g, '<em>$1</em>');
}

/** Strip accent markers for plain-text contexts (titles, meta tags). */
export const plain = (s: string) => s.replace(/\*/g, '');

/**
 * Wrap every word in spans for the line-reveal animation. Lines are split on
 * "|" so headlines control their own line breaks; *accent* spans may cover
 * several words.
 */
export function splitWords(s: string, baseDelay = 0, step = 70): string {
  let i = 0;
  return s
    .split('|')
    .map((line) => {
      let inAccent = false;
      const words = line
        .trim()
        .split(/\s+/)
        .map((raw) => {
          const m = raw.match(/^(\*?)(.*?)(\*?)([.,!?;:…"'״׳]*)$/) ?? ['', '', raw, '', ''];
          const [, open, word, close, punct] = m;
          if (open) inAccent = true;
          const span = `<span class="split-word" style="--word-delay:${baseDelay + i++ * step}">${escapeHtml(word ?? '')}${escapeHtml(punct ?? '')}</span>`;
          const out = inAccent ? `<em>${span}</em>` : span;
          if (close) inAccent = false;
          return out;
        });
      return `<span class="split-line">${words.join(' ')}</span>`;
    })
    .join('');
}
