/**
 * Compact storage for 128-d face descriptors (face-api.js / dlib style).
 * Layout per face: float32 little-endian scale, then `dims` int8 values;
 * value ≈ int8 × scale. 132 bytes per face instead of 512.
 */
import { FACE_DIMS } from './gallery-types';

export const bytesPerFace = (dims = FACE_DIMS) => 4 + dims;

export function encodeDescriptors(descriptors: ArrayLike<number>[], dims = FACE_DIMS): Uint8Array {
  const per = bytesPerFace(dims);
  const out = new Uint8Array(descriptors.length * per);
  const view = new DataView(out.buffer);
  descriptors.forEach((d, i) => {
    if (d.length !== dims) throw new Error(`Descriptor ${i} has ${d.length} values, expected ${dims}`);
    let max = 0;
    for (let k = 0; k < dims; k++) max = Math.max(max, Math.abs(d[k]!));
    const scale = max > 0 ? max / 127 : 1;
    const base = i * per;
    view.setFloat32(base, scale, true);
    for (let k = 0; k < dims; k++) view.setInt8(base + 4 + k, Math.max(-127, Math.min(127, Math.round(d[k]! / scale))));
  });
  return out;
}

export function decodeDescriptors(data: ArrayBuffer | Uint8Array, dims = FACE_DIMS): Float32Array[] {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const per = bytesPerFace(dims);
  if (bytes.length % per !== 0) throw new Error('Corrupt descriptor file');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out: Float32Array[] = [];
  for (let base = 0; base < bytes.length; base += per) {
    const scale = view.getFloat32(base, true);
    const d = new Float32Array(dims);
    for (let k = 0; k < dims; k++) d[k] = view.getInt8(base + 4 + k) * scale;
    out.push(d);
  }
  return out;
}

export function euclidean(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i]! - b[i]!;
    s += diff * diff;
  }
  return Math.sqrt(s);
}
