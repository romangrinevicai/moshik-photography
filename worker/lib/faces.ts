import { decodeDescriptors, euclidean } from '../../src/shared/face-codec';
import { FACE_DIMS, FACE_MATCH_THRESHOLD, type FaceIndex, type FaceSearchMatch } from '../../src/shared/gallery-types';
import { keys, getJson } from './storage';

interface Loaded {
  version: number;
  index: FaceIndex;
  descriptors: Float32Array[];
}

/** Small per-isolate cache so repeated searches don't re-read R2. */
const cache = new Map<string, Loaded>();

export async function loadFaces(bucket: R2Bucket, gid: string, version?: number): Promise<Loaded | null> {
  const hit = cache.get(gid);
  if (hit && (version === undefined || hit.version === version)) return hit;
  const [index, bin] = await Promise.all([getJson<FaceIndex>(bucket, keys.facesIndex(gid)), bucket.get(keys.facesBin(gid))]);
  if (!index || !bin) return null;
  const descriptors = decodeDescriptors(await bin.arrayBuffer(), index.dims || FACE_DIMS);
  if (descriptors.length !== index.faces.length) return null;
  const loaded = { version: index.version, index, descriptors };
  cache.set(gid, loaded);
  if (cache.size > 50) cache.delete(cache.keys().next().value!);
  return loaded;
}

export function forgetFaces(gid: string) {
  cache.delete(gid);
}

export function isValidDescriptor(value: unknown, dims = FACE_DIMS): value is number[] {
  return Array.isArray(value) && value.length === dims && value.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 10);
}

/** Closest match per photo, best first. */
export function searchFaces(query: ArrayLike<number>, data: { index: FaceIndex; descriptors: Float32Array[] }, threshold = FACE_MATCH_THRESHOLD, allowed?: Set<string>): FaceSearchMatch[] {
  const best = new Map<string, number>();
  data.descriptors.forEach((d, i) => {
    const photo = data.index.faces[i]?.p;
    if (!photo || (allowed && !allowed.has(photo))) return;
    const dist = euclidean(query, d);
    if (dist <= threshold && dist < (best.get(photo) ?? Infinity)) best.set(photo, dist);
  });
  return [...best.entries()].map(([id, distance]) => ({ id, distance: Math.round(distance * 1000) / 1000 })).sort((a, b) => a.distance - b.distance);
}
