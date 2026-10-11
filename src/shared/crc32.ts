/** CRC-32 (IEEE 802.3), used to stream ZIP downloads without re-reading files. */
let TABLE: Uint32Array | null = null;

function table(): Uint32Array {
  if (TABLE) return TABLE;
  TABLE = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    TABLE[n] = c >>> 0;
  }
  return TABLE;
}

/** Incremental CRC-32: pass the previous value to continue a running checksum. */
export function crc32(data: Uint8Array, previous = 0): number {
  const t = table();
  let crc = (previous ^ 0xffffffff) >>> 0;
  for (let i = 0; i < data.length; i++) crc = t[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** CRC-32 of a Blob/File, read in chunks to keep memory flat. */
export async function crc32Blob(blob: Blob, chunkSize = 4 * 1024 * 1024): Promise<number> {
  let crc = 0;
  for (let offset = 0; offset < blob.size; offset += chunkSize) {
    const buf = new Uint8Array(await blob.slice(offset, offset + chunkSize).arrayBuffer());
    crc = crc32(buf, crc);
  }
  return crc;
}
