/** Unit tests for the pure parts of the face module (geometry + clustering). Browser parts: scripts/test-faces.mjs. */
import { describe, expect, it } from 'vitest';
import { clusterFacesSync, type ClusterItem } from './cluster';
import {
  alignFromLandmarks,
  decodeDetections,
  dedupeByAlignment,
  iou,
  mergeCandidates,
  overlapOfSmaller,
  squareCrop,
  tileGrid,
  touchesInnerEdge,
  type Candidate,
} from './geometry';

describe('geometry', () => {
  it('computes IoU and overlap of the smaller box', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    expect(iou(a, a)).toBe(1);
    expect(iou(a, { x: 5, y: 0, w: 10, h: 10 })).toBeCloseTo(50 / 150);
    expect(iou(a, { x: 20, y: 20, w: 5, h: 5 })).toBe(0);
    expect(overlapOfSmaller(a, { x: 2, y: 2, w: 4, h: 4 })).toBe(1);
  });

  it('tiles a 2048 px landscape photo into an overlapping 3×2 grid covering it exactly', () => {
    const tiles = tileGrid(2048, 1365, 900, 0.2, 2048);
    expect(tiles).toHaveLength(6);
    expect(Math.min(...tiles.map((t) => t.x))).toBe(0);
    expect(Math.max(...tiles.map((t) => t.x + t.w))).toBe(2048);
    expect(Math.max(...tiles.map((t) => t.y + t.h))).toBe(1365);
    // neighbours overlap by ~20 % of a tile
    const [t0, t1] = tiles;
    expect(t0!.x + t0!.w - t1!.x).toBeGreaterThan(0.18 * t0!.w);
    expect(t0!.inner).toEqual([false, false, true, true]);
    expect(tileGrid(1365, 2048, 900, 0.2, 2048)).toHaveLength(6); // portrait 2×3
    expect(tileGrid(640, 427, 900, 0.2, 2048)).toEqual([]); // small image: one pass is enough
    expect(tileGrid(6000, 4000, 900, 0.2, 2048)).toHaveLength(6); // grid chosen at working size
  });

  it('flags detections cut by an inner tile edge', () => {
    const [tile] = tileGrid(2048, 1365, 900, 0.2, 2048);
    expect(touchesInnerEdge({ x: tile!.w - 30, y: 100, w: 30, h: 40 }, tile!)).toBe(true); // right edge is inner
    expect(touchesInnerEdge({ x: 0, y: 100, w: 30, h: 40 }, tile!)).toBe(false); // left edge is the image border
    expect(touchesInnerEdge({ x: 300, y: 300, w: 40, h: 40 }, tile!)).toBe(false);
  });

  it('decodes detector boxes (letterboxed view) with NMS and maps them to source pixels', () => {
    // [ymin, xmin, ymax, xmax] relative to the square input; the view is 1000×500 drawn top-left.
    const boxes = new Float32Array([0.1, 0.1, 0.2, 0.2, 0.1, 0.105, 0.2, 0.205, 0.3, 0.6, 0.4, 0.7, 0.6, 0.6, 0.7, 0.7]);
    const scores = new Float32Array([0.9, 0.8, 0.95, 0.3]);
    const view = { x: 100, y: 50, w: 1000, h: 500 };
    const dets = decodeDetections(boxes, scores, view, 0.5, 0.5);
    expect(dets).toHaveLength(2); // the 0.8 duplicate is suppressed, the 0.3 one is below threshold
    expect(dets[0]!.score).toBeCloseTo(0.95);
    expect(dets[0]!.rect.x).toBeCloseTo(100 + 0.6 * 1000);
    expect(dets[0]!.rect.y).toBeCloseTo(50 + 0.3 * 1000);
    expect(dets[1]!.rect.w).toBeCloseTo(100);
  });

  it('merges duplicates from several passes, keeping the best score', () => {
    const c = (x: number, y: number, s: number, w = 50): Candidate => ({ rect: { x, y, w, h: w }, score: s });
    const merged = mergeCandidates([c(100, 100, 0.8), c(104, 102, 0.95), c(300, 100, 0.9), c(110, 110, 0.7, 20)], 0.35, 0.6);
    expect(merged.map((m) => m.score)).toEqual([0.95, 0.9]);
  });

  it('drops a second detection of the same face but keeps faces cheek to cheek', () => {
    const al = (cx: number, size = 100) => ({ cx, cy: 100, size, angle: 0, frontal: 1 });
    // 0 and 1: same face (centres 30 px apart, size 100); 2: the neighbour one face-width away
    expect(dedupeByAlignment([al(100), al(130), al(210)], [0.7, 0.95, 0.9])).toEqual([1, 2]);
    expect(dedupeByAlignment([al(100), al(195)], [0.9, 0.9])).toEqual([0, 1]);
  });

  it('keeps square crops inside the image', () => {
    const r = squareCrop({ x: 980, y: 5, w: 20, h: 20 }, 1000, 800, 0.4);
    expect(r.x + r.w).toBeLessThanOrEqual(1000);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.w).toBeCloseTo(36);
    const huge = squareCrop({ x: 0, y: 0, w: 900, h: 900 }, 1000, 600, 0.4);
    expect(huge.w).toBe(600);
  });

  it('derives roll, size and frontalness from 68 landmarks', () => {
    const pts = new Float32Array(136);
    const set = (from: number, to: number, x: number, y: number) => {
      for (let i = from; i < to; i++) [pts[i * 2], pts[i * 2 + 1]] = [x, y];
    };
    set(0, 68, 100, 120);
    set(36, 42, 80, 100); // left eye
    set(42, 48, 120, 100); // right eye
    set(48, 68, 100, 145); // mouth
    set(30, 31, 100, 122); // nose tip, centred
    const a = alignFromLandmarks(pts);
    expect(a.angle).toBeCloseTo(0);
    expect(a.frontal).toBeCloseTo(1);
    expect(a.size).toBeCloseTo(Math.hypot(20, 45) / 0.45);
    set(42, 48, 120, 120); // tilt the right eye down → positive roll
    expect(alignFromLandmarks(pts).angle).toBeCloseTo(Math.atan2(20, 40));
  });
});

/** Deterministic pseudo-random descriptors: `people` centroids, each face = centroid + noise. */
function synthetic(people: number, photos: number, seed = 7) {
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  const centroids = Array.from({ length: people }, () => Float32Array.from({ length: 128 }, () => gauss() * 0.05));
  const items: ClusterItem[] = [];
  const truth: number[] = [];
  for (let p = 0; p < photos; p++) {
    const inPhoto = new Set<number>();
    for (let k = 0; k < 4; k++) {
      const who = Math.floor(rnd() * people);
      if (inPhoto.has(who)) continue;
      inPhoto.add(who);
      const descriptor = Float32Array.from(centroids[who]!, (v) => v + gauss() * 0.02);
      items.push({ photoId: `photo${p}`, face: { box: [rnd() * 0.8, rnd() * 0.8, 0.1, 0.12], score: 0.8 + rnd() * 0.2, descriptor } });
      truth.push(who);
    }
  }
  return { items, truth };
}

describe('clusterFaces', () => {
  it('groups the faces of each person and never merges two faces of one photo', () => {
    const { items, truth } = synthetic(12, 80);
    const clusters = clusterFacesSync(items, { minPhotos: 1 });
    for (const c of clusters) {
      expect(new Set(c.members.map((m) => truth[m])).size).toBe(1); // pure
      expect(new Set(c.members.map((m) => items[m]!.photoId)).size).toBe(c.members.length); // cannot-link
      expect(c.members).toContain(c.representative);
      expect(c.photoIds).toEqual([...new Set(c.members.map((m) => items[m]!.photoId))]);
      expect(c.id).toMatch(/^[A-Za-z0-9]{12}$/);
    }
    expect(clusters).toHaveLength(12); // complete
    for (let i = 1; i < clusters.length; i++) expect(clusters[i - 1]!.photoIds.length).toBeGreaterThanOrEqual(clusters[i]!.photoIds.length);
  });

  it('keeps look-alikes in one photo apart even when they are very close', () => {
    const d = new Float32Array(128).fill(0.01);
    const face = (photoId: string, x: number) => ({ photoId, face: { box: [x, 0.1, 0.1, 0.1] as [number, number, number, number], score: 0.9, descriptor: d } });
    const clusters = clusterFacesSync([face('a', 0.1), face('a', 0.5), face('b', 0.1), face('b', 0.5)], { minPhotos: 1 });
    expect(clusters).toHaveLength(2);
    for (const c of clusters) expect(new Set(c.photoIds).size).toBe(c.members.length);
  });

  it('honours minPhotos and returns stable ids regardless of input order', () => {
    const { items } = synthetic(10, 60, 3);
    const a = clusterFacesSync(items);
    expect(a.every((c) => c.photoIds.length >= 2)).toBe(true);
    const order = items.map((_, i) => i).reverse();
    const b = clusterFacesSync(order.map((i) => items[i]!));
    const norm = (cl: typeof a, map: (m: number) => number) => cl.map((c) => `${c.id}=${c.members.map(map).sort((x, y) => x - y).join(',')}`).sort();
    expect(norm(b, (m) => order[m]!)).toEqual(norm(a, (m) => m));
  });

  it('returns nothing for no faces and rejects malformed descriptors', () => {
    expect(clusterFacesSync([])).toEqual([]);
    expect(() => clusterFacesSync([{ photoId: 'x', face: { box: [0, 0, 1, 1], score: 1, descriptor: new Float32Array(3) } }])).toThrow();
  });
});
