import { describe, expect, it } from 'vitest';
import { decodeDescriptors, encodeDescriptors, euclidean } from '../../src/shared/face-codec';
import { searchFaces, isValidDescriptor } from '../../worker/lib/faces';
import type { FaceIndex } from '../../src/shared/gallery-types';

function randomDescriptor(seed: number): Float32Array {
  let s = seed;
  const d = new Float32Array(128);
  for (let i = 0; i < 128; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    d[i] = ((s / 0x7fffffff) - 0.5) * 0.3;
  }
  return d;
}

describe('face codec', () => {
  it('round-trips descriptors with negligible error', () => {
    const descs = [randomDescriptor(1), randomDescriptor(2), randomDescriptor(3)];
    const decoded = decodeDescriptors(encodeDescriptors(descs));
    expect(decoded).toHaveLength(3);
    descs.forEach((d, i) => expect(euclidean(d, decoded[i]!)).toBeLessThan(0.01));
  });

  it('rejects corrupt buffers and wrong dimensions', () => {
    expect(() => decodeDescriptors(new Uint8Array(131))).toThrow();
    expect(() => encodeDescriptors([new Float32Array(10)])).toThrow();
  });
});

describe('face search', () => {
  const people = [randomDescriptor(10), randomDescriptor(20), randomDescriptor(30)];
  const near = (d: Float32Array, k: number) => d.map((v, i) => v + Math.sin(i * k) * 0.01);
  const descriptors = decodeDescriptors(encodeDescriptors([people[0]!, near(people[0]!, 1), people[1]!, near(people[0]!, 2), people[2]!]));
  const index: FaceIndex = {
    version: 1,
    dims: 128,
    faces: [
      { p: 'photoAAAAAA1', b: [0, 0, 0.1, 0.1] },
      { p: 'photoAAAAAA2', b: [0, 0, 0.1, 0.1] },
      { p: 'photoAAAAAA2', b: [0.5, 0, 0.1, 0.1] },
      { p: 'photoAAAAAA3', b: [0, 0, 0.1, 0.1] },
      { p: 'photoAAAAAA4', b: [0, 0, 0.1, 0.1] },
    ],
  };

  it('returns one match per photo, closest first, within the threshold', () => {
    const matches = searchFaces(people[0]!, { index, descriptors });
    expect(matches.map((m) => m.id)).toEqual(['photoAAAAAA1', 'photoAAAAAA2', 'photoAAAAAA3']);
    expect(matches[0]!.distance).toBeLessThanOrEqual(matches[1]!.distance);
  });

  it('respects the allowed set (deleted photos are skipped)', () => {
    const matches = searchFaces(people[0]!, { index, descriptors }, 0.5, new Set(['photoAAAAAA3']));
    expect(matches.map((m) => m.id)).toEqual(['photoAAAAAA3']);
  });

  it('validates incoming descriptors', () => {
    expect(isValidDescriptor(Array.from(people[0]!))).toBe(true);
    expect(isValidDescriptor([1, 2, 3])).toBe(false);
    expect(isValidDescriptor(Array(128).fill(Number.NaN))).toBe(false);
    expect(isValidDescriptor('nope')).toBe(false);
  });
});
