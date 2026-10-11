/** QR codes for gallery links (uqr), rendered as crisp SVG or a PNG for download. */
import { encode } from 'uqr';

export interface QrMatrix {
  size: number;
  data: boolean[][];
}

export function qrMatrix(text: string): QrMatrix {
  // Q-level error correction survives smudges on printed table cards.
  const qr = encode(text, { ecc: 'Q', border: 0 });
  return { size: qr.size, data: qr.data };
}

/** One <path> with a horizontal run per row segment — small and razor sharp. */
export function qrPath(m: QrMatrix, offset = 0): string {
  let d = '';
  for (let y = 0; y < m.size; y++) {
    const row = m.data[y]!;
    let x = 0;
    while (x < m.size) {
      if (!row[x]) {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < m.size && row[x + run]) run++;
      d += `M${x + offset} ${y + offset}h${run}v1h-${run}z`;
      x += run;
    }
  }
  return d;
}

export function qrSvg(text: string, opts: { margin?: number; fg?: string; bg?: string; title?: string } = {}): string {
  const m = qrMatrix(text);
  const margin = opts.margin ?? 4;
  const total = m.size + margin * 2;
  const fg = opts.fg ?? '#161311';
  const bg = opts.bg ?? '#ffffff';
  const title = opts.title ? `<title>${opts.title.replace(/[<&>]/g, '')}</title>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges" role="img">${title}<rect width="${total}" height="${total}" fill="${bg}"/><path fill="${fg}" d="${qrPath(m, margin)}"/></svg>`;
}

export function qrPng(text: string, opts: { px?: number; margin?: number; fg?: string; bg?: string } = {}): Promise<Blob> {
  const m = qrMatrix(text);
  const margin = opts.margin ?? 4;
  const total = m.size + margin * 2;
  const target = opts.px ?? 1200;
  const scale = Math.max(1, Math.floor(target / total));
  const px = total * scale;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = px;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = opts.bg ?? '#ffffff';
  ctx.fillRect(0, 0, px, px);
  ctx.fillStyle = opts.fg ?? '#161311';
  for (let y = 0; y < m.size; y++) {
    for (let x = 0; x < m.size; x++) {
      if (m.data[y]![x]) ctx.fillRect((x + margin) * scale, (y + margin) * scale, scale, scale);
    }
  }
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'));
}
