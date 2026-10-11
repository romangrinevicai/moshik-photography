/**
 * Groups faces of the same person across photos (pure, no DOM / TF).
 *
 * 1. Distances between all faces of *different* photos are computed once;
 *    pairs closer than `threshold + EDGE_MARGIN` are kept as compact edges.
 * 2. Near-duplicates (distance < TIGHT_FACTOR × threshold, e.g. burst shots)
 *    are joined by single linkage — this only shrinks the problem.
 * 3. Average-linkage agglomerative clustering on those groups: the pair of
 *    groups with the smallest mean distance is merged while that mean is
 *    below `threshold`; pairs without an edge count as threshold + margin.
 *    Average linkage does not chain different people through one ambiguous
 *    face the way single linkage / label propagation can.
 *
 * Faces from the same photo are never placed in one cluster (cannot-link).
 */
import { DEFAULT_CLUSTER_THRESHOLD } from './config';
import type { DetectedFace, PersonCluster } from './types';

export interface ClusterItem {
  photoId: string;
  face: DetectedFace;
}

export interface ClusterOptions {
  /** Max average distance between two groups of the same person (default 0.5). */
  threshold?: number;
  /** Only people seen in at least this many photos are returned (default 2). */
  minPhotos?: number;
}

const DIMS = 128;
const EDGE_MARGIN = 0.1;
const TIGHT_FACTOR = 0.6;

class EdgeList {
  a = new Int32Array(4096);
  b = new Int32Array(4096);
  d = new Float32Array(4096);
  length = 0;

  push(i: number, j: number, dist: number) {
    if (this.length === this.a.length) {
      const grow = <T extends Int32Array | Float32Array>(src: T, make: (n: number) => T): T => {
        const out = make(src.length * 2);
        out.set(src);
        return out;
      };
      this.a = grow(this.a, (n) => new Int32Array(n));
      this.b = grow(this.b, (n) => new Int32Array(n));
      this.d = grow(this.d, (n) => new Float32Array(n));
    }
    this.a[this.length] = i;
    this.b[this.length] = j;
    this.d[this.length] = dist;
    this.length++;
  }
}

/** Binary min-heap of (value, a, b) triples. */
class MinHeap {
  private v: number[] = [];
  private a: number[] = [];
  private b: number[] = [];

  get size() {
    return this.v.length;
  }

  push(value: number, a: number, b: number) {
    const { v } = this;
    let i = v.length;
    v.push(value);
    this.a.push(a);
    this.b.push(b);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (v[p]! <= value) break;
      this.swap(i, p);
      i = p;
    }
  }

  pop(): [number, number, number] | undefined {
    const { v } = this;
    if (!v.length) return undefined;
    const top: [number, number, number] = [v[0]!, this.a[0]!, this.b[0]!];
    const last = v.length - 1;
    this.swap(0, last);
    v.pop();
    this.a.pop();
    this.b.pop();
    let i = 0;
    for (;;) {
      const l = i * 2 + 1;
      const r = l + 1;
      let m = i;
      if (l < v.length && v[l]! < v[m]!) m = l;
      if (r < v.length && v[r]! < v[m]!) m = r;
      if (m === i) break;
      this.swap(i, m);
      i = m;
    }
    return top;
  }

  private swap(i: number, j: number) {
    const { v, a, b } = this;
    [v[i], v[j]] = [v[j]!, v[i]!];
    [a[i], a[j]] = [a[j]!, a[i]!];
    [b[i], b[j]] = [b[j]!, b[i]!];
  }
}

const disjoint = (x: Set<number>, y: Set<number>) => {
  const [small, large] = x.size <= y.size ? [x, y] : [y, x];
  for (const v of small) if (large.has(v)) return false;
  return true;
};

const unionInto = (into: Set<number>, from: Set<number>) => {
  for (const v of from) into.add(v);
};

function hash32(str: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** 12 base62 characters (~64 bits) derived from `key`. */
function stableId(key: string): string {
  let out = '';
  for (const seed of [0x811c9dc5, 0x9747b28c]) {
    let h = hash32(key, seed);
    for (let i = 0; i < 6; i++) {
      out += B62[h % 62];
      h = Math.floor(h / 62);
    }
  }
  return out;
}

const faceKey = (item: ClusterItem) => `${item.photoId}:${item.face.box.map((v) => Math.round(v * 1000)).join(',')}`;

/** Picks the face with the best quality that is also typical for the person (close to the centroid). */
function pickRepresentative(items: ClusterItem[], members: number[], X: Float32Array): number {
  const centroid = new Float32Array(DIMS);
  for (const m of members) for (let k = 0; k < DIMS; k++) centroid[k]! += X[m * DIMS + k]! / members.length;
  let maxSize = 0;
  for (const m of members) maxSize = Math.max(maxSize, Math.sqrt(items[m]!.face.box[2] * items[m]!.face.box[3]));
  let best = members[0]!;
  let bestScore = -Infinity;
  for (const m of members) {
    const { face } = items[m]!;
    let d2 = 0;
    for (let k = 0; k < DIMS; k++) {
      const diff = X[m * DIMS + k]! - centroid[k]!;
      d2 += diff * diff;
    }
    const size = maxSize > 0 ? Math.sqrt(face.box[2] * face.box[3]) / maxSize : 1;
    const quality = face.quality ?? face.score * Math.sqrt(size);
    const score = quality * Math.exp(-d2 / (0.3 * 0.3));
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

/**
 * Generator form of the clustering: yields progress (0–1) at cheap
 * checkpoints so an async driver can keep the UI responsive.
 */
export function* clusterSteps(items: ClusterItem[], opts: ClusterOptions = {}): Generator<number, PersonCluster[], void> {
  const n = items.length;
  const threshold = opts.threshold ?? DEFAULT_CLUSTER_THRESHOLD;
  const minPhotos = Math.max(1, Math.floor(opts.minPhotos ?? 2));
  if (!n) return [];

  // Flatten descriptors; map photo ids to small integers.
  const X = new Float32Array(n * DIMS);
  const photoIndex = new Int32Array(n);
  const photoIds = new Map<string, number>();
  items.forEach((item, i) => {
    const d = item.face.descriptor;
    if (d.length !== DIMS) throw new Error(`Face ${i} has a ${d.length}-d descriptor, expected ${DIMS}`);
    X.set(d, i * DIMS);
    let p = photoIds.get(item.photoId);
    if (p === undefined) photoIds.set(item.photoId, (p = photoIds.size));
    photoIndex[i] = p;
  });

  // 1. Sparse distance graph.
  const cap = threshold + EDGE_MARGIN;
  const cap2 = cap * cap;
  const edges = new EdgeList();
  const totalPairs = (n * (n - 1)) / 2 || 1;
  let pairsDone = 0;
  for (let i = 0; i < n; i++) {
    const oi = i * DIMS;
    const pi = photoIndex[i];
    for (let j = i + 1; j < n; j++) {
      if (photoIndex[j] === pi) continue;
      const oj = j * DIMS;
      let s = 0;
      let k = 0;
      for (; k < DIMS; k += 4) {
        const a = X[oi + k]! - X[oj + k]!;
        const b = X[oi + k + 1]! - X[oj + k + 1]!;
        const c = X[oi + k + 2]! - X[oj + k + 2]!;
        const e = X[oi + k + 3]! - X[oj + k + 3]!;
        s += a * a + b * b + c * c + e * e;
        if ((k & 31) === 28 && s > cap2) break;
      }
      if (k >= DIMS && s < cap2) edges.push(i, j, Math.sqrt(s));
    }
    pairsDone += n - i - 1;
    yield (pairsDone / totalPairs) * 0.85;
  }

  // 2. Join near-duplicates (single linkage, respecting cannot-link).
  const order = Array.from({ length: edges.length }, (_, e) => e).sort((x, y) => edges.d[x]! - edges.d[y]!);
  const parent = Int32Array.from({ length: n }, (_, i) => i);
  const find = (x: number) => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]!]!;
      x = parent[x]!;
    }
    return x;
  };
  const photoSet: (Set<number> | null)[] = Array.from({ length: n }, (_, i) => new Set([photoIndex[i]!]));
  const tight = threshold * TIGHT_FACTOR;
  for (const e of order) {
    if (edges.d[e]! >= tight) break;
    let ra = find(edges.a[e]!);
    let rb = find(edges.b[e]!);
    if (ra === rb || !disjoint(photoSet[ra]!, photoSet[rb]!)) continue;
    if (photoSet[ra]!.size < photoSet[rb]!.size) [ra, rb] = [rb, ra];
    unionInto(photoSet[ra]!, photoSet[rb]!);
    photoSet[rb] = null;
    parent[rb] = ra;
  }
  yield 0.9;

  // 3. Average linkage between the groups.
  const groupOf = new Int32Array(n);
  const rootGroup = new Map<number, number>();
  const members: number[][] = [];
  const photos: Set<number>[] = [];
  for (let i = 0; i < n; i++) {
    const r = find(i);
    let g = rootGroup.get(r);
    if (g === undefined) {
      rootGroup.set(r, (g = members.length));
      members.push([]);
      photos.push(photoSet[r]!);
    }
    groupOf[i] = g;
    members[g]!.push(i);
  }
  const m = members.length;
  type Stat = { sum: number; cnt: number };
  const adj: (Map<number, Stat> | null)[] = Array.from({ length: m }, () => new Map());
  for (let e = 0; e < edges.length; e++) {
    const ga = groupOf[edges.a[e]!]!;
    const gb = groupOf[edges.b[e]!]!;
    if (ga === gb) continue;
    let stat = adj[ga]!.get(gb);
    if (!stat) {
      stat = { sum: 0, cnt: 0 };
      adj[ga]!.set(gb, stat);
      adj[gb]!.set(ga, stat);
    }
    stat.sum += edges.d[e]!;
    stat.cnt++;
  }
  const size = members.map((g) => g.length);
  const linkage = (a: number, b: number, s: Stat) => {
    const pairs = size[a]! * size[b]!;
    return (s.sum + (pairs - s.cnt) * cap) / pairs;
  };
  const heap = new MinHeap();
  for (let a = 0; a < m; a++) {
    for (const [b, s] of adj[a]!) {
      if (a < b) {
        const l = linkage(a, b, s);
        if (l < threshold) heap.push(l, a, b);
      }
    }
  }
  yield 0.95;

  for (let top = heap.pop(); top && top[0] < threshold; top = heap.pop()) {
    let [value, a, b] = top;
    const sa = adj[a];
    const sb = adj[b];
    if (!sa || !sb) continue; // merged away
    const stat = sa.get(b);
    if (!stat || Math.abs(linkage(a, b, stat) - value) > 1e-9) continue; // stale entry
    if (!disjoint(photos[a]!, photos[b]!)) {
      // Photo sets only grow, so these two can never merge: forget the pair.
      sa.delete(b);
      sb.delete(a);
      continue;
    }
    if (size[a]! < size[b]!) [a, b] = [b, a];
    const keep = adj[a]!;
    const gone = adj[b]!;
    for (const [x, s] of gone) {
      if (x === a) continue;
      const ax = keep.get(x);
      if (ax) {
        ax.sum += s.sum;
        ax.cnt += s.cnt;
      } else {
        keep.set(x, s);
        adj[x]!.set(a, s);
      }
      adj[x]!.delete(b);
    }
    keep.delete(b);
    adj[b] = null;
    members[a] = members[a]!.concat(members[b]!);
    members[b] = [];
    unionInto(photos[a]!, photos[b]!);
    size[a]! += size[b]!;
    size[b] = 0;
    for (const [x, s] of keep) {
      const l = linkage(a, x, s);
      if (l < threshold) heap.push(l, a, x);
    }
  }

  // Assemble the people.
  const clusters: PersonCluster[] = [];
  const used = new Set<string>();
  for (let g = 0; g < m; g++) {
    if (!adj[g] || members[g]!.length === 0) continue;
    const list = members[g]!.sort((x, y) => x - y);
    const ids = [...new Set(list.map((i) => items[i]!.photoId))];
    if (ids.length < minPhotos) continue;
    // Id from the smallest face key: unchanged when the cluster gains or loses other faces.
    const key = list.map((i) => faceKey(items[i]!)).sort()[0]!;
    let id = stableId(key);
    for (let salt = 1; used.has(id); salt++) id = stableId(`${key}#${salt}`);
    used.add(id);
    clusters.push({ id, members: list, photoIds: ids, representative: pickRepresentative(items, list, X) });
  }
  clusters.sort((x, y) => y.photoIds.length - x.photoIds.length || y.members.length - x.members.length || (x.id < y.id ? -1 : 1));
  return clusters;
}

/** Synchronous clustering (blocks the thread; fine for a few thousand faces). */
export function clusterFacesSync(items: ClusterItem[], opts?: ClusterOptions): PersonCluster[] {
  const steps = clusterSteps(items, opts);
  for (;;) {
    const r = steps.next();
    if (r.done) return r.value;
  }
}
