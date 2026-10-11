/** Pure geometry helpers for the face pipeline (no DOM, no TF). */

/** Rectangle in source-image pixels. */
export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A detector tile; `inner` flags edges shared with a neighbouring tile (left, top, right, bottom). */
export interface Tile extends Region {
  inner: [boolean, boolean, boolean, boolean];
}

export interface Candidate {
  rect: Region;
  score: number;
}

export const area = (r: Region): number => Math.max(0, r.w) * Math.max(0, r.h);

export function intersection(a: Region, b: Region): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

export function iou(a: Region, b: Region): number {
  const i = intersection(a, b);
  return i > 0 ? i / (area(a) + area(b) - i) : 0;
}

/** Intersection over the area of the smaller rectangle (1 when one contains the other). */
export function overlapOfSmaller(a: Region, b: Region): number {
  const i = intersection(a, b);
  return i > 0 ? i / Math.min(area(a), area(b)) : 0;
}

/**
 * Overlapping grid of roughly square tiles covering a `width`×`height` image.
 * The grid is chosen on the image scaled to `workMax` px so that every tile
 * is about `target` px; returns [] when a single pass already covers it.
 */
export function tileGrid(width: number, height: number, target: number, overlap: number, workMax: number): Tile[] {
  const scale = Math.min(1, workMax / Math.max(width, height));
  const count = (len: number) => {
    const l = len * scale;
    return l <= target * 1.15 ? 1 : Math.ceil((l - overlap * target) / ((1 - overlap) * target));
  };
  const cols = count(width);
  const rows = count(height);
  if (cols * rows <= 1) return [];
  const tw = Math.round(width / (cols - (cols - 1) * overlap));
  const th = Math.round(height / (rows - (rows - 1) * overlap));
  const stepX = cols > 1 ? (width - tw) / (cols - 1) : 0;
  const stepY = rows > 1 ? (height - th) / (rows - 1) : 0;
  const tiles: Tile[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tiles.push({
        x: Math.round(c * stepX),
        y: Math.round(r * stepY),
        w: Math.min(tw, width),
        h: Math.min(th, height),
        inner: [c > 0, r > 0, c < cols - 1, r < rows - 1],
      });
    }
  }
  return tiles;
}

/**
 * True when a detection found inside `tile` touches one of its inner edges —
 * such a face is probably cut in half; the neighbouring tile (or the full
 * pass) sees it whole.
 */
export function touchesInnerEdge(rect: Region, tile: Tile): boolean {
  const mx = Math.max(2, tile.w * 0.01);
  const my = Math.max(2, tile.h * 0.01);
  const [l, t, r, b] = tile.inner;
  return (
    (l && rect.x <= tile.x + mx) ||
    (t && rect.y <= tile.y + my) ||
    (r && rect.x + rect.w >= tile.x + tile.w - mx) ||
    (b && rect.y + rect.h >= tile.y + tile.h - my)
  );
}

/**
 * Decodes one detector pass: `boxes` holds [ymin, xmin, ymax, xmax] relative
 * to the square detector input, into which `view` was drawn top-left aligned
 * (letterboxed). Applies greedy non-max suppression and maps to source pixels.
 */
export function decodeDetections(
  boxes: Float32Array | Int32Array | Uint8Array,
  scores: Float32Array | Int32Array | Uint8Array,
  view: Region,
  minScore: number,
  iouThreshold: number,
  maxResults = 100,
): Candidate[] {
  const order: number[] = [];
  for (let i = 0; i < scores.length; i++) if (scores[i]! > minScore) order.push(i);
  order.sort((a, b) => scores[b]! - scores[a]!);
  const side = Math.max(view.w, view.h);
  const picked: Candidate[] = [];
  const rel: Region[] = [];
  for (const i of order) {
    if (picked.length >= maxResults) break;
    const y0 = Math.max(0, boxes[i * 4]!);
    const x0 = Math.max(0, boxes[i * 4 + 1]!);
    const y1 = Math.min(1, boxes[i * 4 + 2]!);
    const x1 = Math.min(1, boxes[i * 4 + 3]!);
    if (x1 <= x0 || y1 <= y0) continue;
    const r: Region = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    if (rel.some((k) => iou(k, r) > iouThreshold)) continue;
    rel.push(r);
    const x = view.x + x0 * side;
    const y = view.y + y0 * side;
    const right = Math.min(view.x + view.w, view.x + x1 * side);
    const bottom = Math.min(view.y + view.h, view.y + y1 * side);
    if (right <= x || bottom <= y) continue;
    picked.push({ rect: { x, y, w: right - x, h: bottom - y }, score: scores[i]! });
  }
  return picked;
}

/** Greedy merge of detections from several passes, keeping the highest score per face. */
export function mergeCandidates<T extends Candidate>(cands: T[], maxIou: number, maxOverlap: number): T[] {
  const kept: T[] = [];
  for (const c of [...cands].sort((a, b) => b.score - a.score)) {
    if (!kept.some((k) => iou(k.rect, c.rect) > maxIou || overlapOfSmaller(k.rect, c.rect) > maxOverlap)) kept.push(c);
  }
  return kept;
}

/**
 * Square crop used for the landmark network, as the reference pipeline does:
 * the (floored) detection box clipped to the image, letterboxed and centred
 * in a `size`×`size` chip. Returns the source rectangle and where it lands.
 */
export function landmarkChip(rect: Region, width: number, height: number, size: number) {
  const x = Math.max(0, Math.floor(rect.x));
  const y = Math.max(0, Math.floor(rect.y));
  const w = Math.max(1, Math.min(Math.floor(rect.x) + Math.floor(rect.w), width) - x);
  const h = Math.max(1, Math.min(Math.floor(rect.y) + Math.floor(rect.h), height) - y);
  const k = size / Math.max(w, h);
  return { sx: x, sy: y, sw: w, sh: h, k, dx: (size - w * k) / 2, dy: (size - h * k) / 2 };
}

/** Alignment of a face derived from its 68 landmarks (interleaved x,y in source px). */
export interface Alignment {
  /** Reference point: centroid of the two eye centres and the mouth centre. */
  cx: number;
  cy: number;
  /** Side of the aligned square in source pixels. */
  size: number;
  /** Roll (radians) of the line through the eye centres. */
  angle: number;
  /** 0–1, 1 = facing the camera (from the nose position between the eyes). */
  frontal: number;
}

function meanPoint(pts: ArrayLike<number>, from: number, to: number) {
  let x = 0;
  let y = 0;
  for (let i = from; i < to; i++) {
    x += pts[i * 2]!;
    y += pts[i * 2 + 1]!;
  }
  const n = to - from;
  return { x: x / n, y: y / n };
}

/** dlib-style alignment box (as used by the descriptor network's reference pipeline). */
export function alignFromLandmarks(pts: ArrayLike<number>): Alignment {
  const le = meanPoint(pts, 36, 42);
  const re = meanPoint(pts, 42, 48);
  const mo = meanPoint(pts, 48, 68);
  const eyeToMouth = (Math.hypot(mo.x - le.x, mo.y - le.y) + Math.hypot(mo.x - re.x, mo.y - re.y)) / 2;
  const angle = Math.atan2(re.y - le.y, re.x - le.x);
  // Yaw proxy: horizontal offset of the nose tip from the eye midpoint, in the face's own frame.
  const eyeDist = Math.hypot(re.x - le.x, re.y - le.y) || 1;
  const nx = pts[30 * 2]! - (le.x + re.x) / 2;
  const ny = pts[30 * 2 + 1]! - (le.y + re.y) / 2;
  const yaw = Math.abs(nx * Math.cos(angle) + ny * Math.sin(angle)) / eyeDist;
  return {
    cx: (le.x + re.x + mo.x) / 3,
    cy: (le.y + re.y + mo.y) / 3,
    size: eyeToMouth / 0.45,
    angle,
    frontal: Math.max(0, Math.min(1, 1 - yaw / 0.6)),
  };
}

/** Square crop with `margin` (fraction of the face size added on every side), kept inside the image. */
export function squareCrop(box: Region, width: number, height: number, margin: number, lift = 0.08): Region {
  const face = Math.max(box.w, box.h);
  const side = Math.max(1, Math.min(face * (1 + 2 * margin), width, height));
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2 - face * lift; // a little more hair than neck
  const x = Math.min(Math.max(0, cx - side / 2), width - side);
  const y = Math.min(Math.max(0, cy - side / 2), height - side);
  return { x, y, w: side, h: side };
}
