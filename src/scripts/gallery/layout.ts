/**
 * Justified photo layout (Flickr / Google Photos style), computed from the
 * photos' real proportions so it scales to thousands of photos without
 * touching the DOM. Rows fill the width exactly; the last row of each
 * section keeps the target height and aligns to the start edge.
 */

export interface Sized {
  w: number;
  h: number;
}

export interface Tile {
  /** Index into the flat list of photos being laid out. */
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Row {
  y: number;
  h: number;
  /** First and last+1 index (into the flat list) of the photos in this row. */
  start: number;
  end: number;
}

export interface Heading {
  key: string;
  y: number;
  h: number;
}

export interface LayoutOptions {
  width: number;
  targetHeight: number;
  gap: number;
  /** Space taken by a section heading (0 = no headings). */
  headingHeight?: number;
  /** Extra space above every section heading except the first. */
  sectionGap?: number;
}

export interface Layout {
  tiles: Tile[];
  rows: Row[];
  headings: Heading[];
  height: number;
}

/** Aspect ratio with sane bounds, so a broken or extreme panorama can't wreck a row. */
export const ratioOf = (p: Sized) => {
  const r = p.w > 0 && p.h > 0 ? p.w / p.h : 1.5;
  return Math.min(4, Math.max(0.33, r));
};

/**
 * Lay out sections of photos. `sections[i].count` photos are taken in order
 * from the flat list `items`.
 */
export function justify(items: Sized[], sections: { key: string; count: number }[], opts: LayoutOptions): Layout {
  const { width, targetHeight, gap } = opts;
  const headingHeight = opts.headingHeight ?? 0;
  const sectionGap = opts.sectionGap ?? 0;
  const tiles: Tile[] = new Array(items.length);
  const rows: Row[] = [];
  const headings: Heading[] = [];
  const maxHeight = targetHeight * 1.6;
  let y = 0;
  let offset = 0;

  const place = (start: number, end: number, h: number, stretch: boolean) => {
    const rh = Math.round(h);
    let sum = 0;
    for (let i = start; i < end; i++) sum += ratioOf(items[i]!);
    // Width shared by the photos (gaps excluded). Rounding each edge from the
    // exact running total keeps a full row ending precisely at `width`.
    const inner = stretch ? width - gap * (end - start - 1) : sum * h;
    let run = 0;
    for (let i = start, k = 0; i < end; i++, k++) {
      const tw = (ratioOf(items[i]!) / sum) * inner;
      const x0 = Math.round(run + gap * k);
      const x1 = Math.round(run + tw + gap * k);
      tiles[i] = { index: i, x: x0, y, w: Math.max(1, x1 - x0), h: rh };
      run += tw;
    }
    rows.push({ y, h: rh, start, end });
    y += rh + gap;
  };

  sections.forEach((section, si) => {
    if (section.count <= 0) return;
    if (headingHeight > 0) {
      if (si > 0 && headings.length) y += sectionGap;
      headings.push({ key: section.key, y, h: headingHeight });
      y += headingHeight;
    }
    const startOfSection = offset;
    const endOfSection = offset + section.count;
    let rowStart = startOfSection;
    let sum = 0;
    for (let i = startOfSection; i < endOfSection; i++) {
      const r = ratioOf(items[i]!);
      sum += r;
      const n = i - rowStart + 1;
      const rowWidth = sum * targetHeight + gap * (n - 1);
      if (rowWidth < width) continue;
      // The row is full. Either end it with this photo, or just before it —
      // whichever keeps the row height closest to the target.
      const hWith = (width - gap * (n - 1)) / sum;
      if (n > 1) {
        const hWithout = (width - gap * (n - 2)) / (sum - r);
        if (Math.abs(hWithout - targetHeight) < Math.abs(hWith - targetHeight) && hWithout <= maxHeight) {
          place(rowStart, i, hWithout, true);
          rowStart = i;
          sum = r;
          // The current photo starts the next row; it may already fill it.
          if (r * targetHeight >= width) {
            place(rowStart, i + 1, width / r, true);
            rowStart = i + 1;
            sum = 0;
          }
          continue;
        }
      }
      place(rowStart, i + 1, hWith, true);
      rowStart = i + 1;
      sum = 0;
    }
    if (rowStart < endOfSection) {
      // Last, incomplete row: keep the target height, unless it's nearly full
      // (then fill the width, which reads as intentional rather than ragged).
      const n = endOfSection - rowStart;
      const fit = (width - gap * (n - 1)) / sum;
      const fill = fit <= targetHeight * 1.2;
      place(rowStart, endOfSection, fill ? fit : targetHeight, fill);
    }
    offset = endOfSection;
  });

  return { tiles, rows, headings, height: Math.max(0, y - gap) };
}

/** Row height & gap for a container width (≈140 px on phones → ≈260 px on desktop). */
export function metricsFor(width: number): { targetHeight: number; gap: number } {
  const targetHeight = Math.round(Math.min(260, Math.max(140, 140 + (width - 390) * 0.14)));
  const gap = width < 600 ? 4 : width < 1100 ? 6 : 8;
  return { targetHeight, gap };
}
