/**
 * Streaming ZIP writer ("stored", no compression — JPEGs don't compress).
 *
 * Because every file's size and CRC-32 are known up front (computed by the
 * admin's browser at upload time), the archive is streamed straight from R2
 * without buffering or re-reading, the exact Content-Length is known, and
 * ZIP64 records are emitted automatically for archives over 4 GB.
 */

export interface ZipEntry {
  name: string;
  size: number;
  crc: number;
  /** Lazily opens the file body. */
  open: () => Promise<ReadableStream<Uint8Array> | null>;
  date?: Date;
}

const enc = new TextEncoder();
const U32_MAX = 0xffffffff;
const U16_MAX = 0xffff;

interface Planned extends ZipEntry {
  nameBytes: Uint8Array;
  offset: number;
  localSize: number;
}

function dosDateTime(d: Date): { time: number; date: number } {
  const year = Math.max(1980, d.getFullYear());
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

const LOCAL_HEADER = 30;
const CENTRAL_HEADER = 46;
const EOCD = 22;
const ZIP64_EOCD = 56;
const ZIP64_LOCATOR = 20;

function plan(entries: ZipEntry[]) {
  let offset = 0;
  const planned: Planned[] = entries.map((e) => {
    const nameBytes = enc.encode(e.name);
    const localSize = LOCAL_HEADER + nameBytes.length;
    const p: Planned = { ...e, nameBytes, offset, localSize };
    offset += localSize + e.size;
    return p;
  });
  const cdOffset = offset;
  let cdSize = 0;
  for (const p of planned) cdSize += CENTRAL_HEADER + p.nameBytes.length + (p.offset >= U32_MAX ? 12 : 0);
  const zip64 = cdOffset + cdSize >= U32_MAX || planned.length >= U16_MAX || planned.some((p) => p.offset >= U32_MAX);
  const total = cdOffset + cdSize + (zip64 ? ZIP64_EOCD + ZIP64_LOCATOR : 0) + EOCD;
  return { planned, cdOffset, cdSize, zip64, total };
}

/** Exact byte length of the archive the entries would produce. */
export const zipSize = (entries: ZipEntry[]) => plan(entries).total;

function localHeader(p: Planned): Uint8Array {
  if (p.size >= U32_MAX) throw new Error('Single files over 4 GB are not supported');
  const buf = new Uint8Array(p.localSize);
  const v = new DataView(buf.buffer);
  const { time, date } = dosDateTime(p.date ?? new Date());
  v.setUint32(0, 0x04034b50, true);
  v.setUint16(4, 20, true); // version needed
  v.setUint16(6, 0x0800, true); // UTF-8 names
  v.setUint16(8, 0, true); // stored
  v.setUint16(10, time, true);
  v.setUint16(12, date, true);
  v.setUint32(14, p.crc >>> 0, true);
  v.setUint32(18, p.size, true);
  v.setUint32(22, p.size, true);
  v.setUint16(26, p.nameBytes.length, true);
  v.setUint16(28, 0, true);
  buf.set(p.nameBytes, LOCAL_HEADER);
  return buf;
}

function centralDirectory(planned: Planned[], cdOffset: number, cdSize: number, zip64: boolean): Uint8Array {
  const tail = zip64 ? ZIP64_EOCD + ZIP64_LOCATOR + EOCD : EOCD;
  const buf = new Uint8Array(cdSize + tail);
  const v = new DataView(buf.buffer);
  let o = 0;
  for (const p of planned) {
    const bigOffset = p.offset >= U32_MAX;
    const { time, date } = dosDateTime(p.date ?? new Date());
    v.setUint32(o, 0x02014b50, true);
    v.setUint16(o + 4, (3 << 8) | 45, true); // made by: Unix, spec 4.5
    v.setUint16(o + 6, bigOffset ? 45 : 20, true);
    v.setUint16(o + 8, 0x0800, true);
    v.setUint16(o + 10, 0, true);
    v.setUint16(o + 12, time, true);
    v.setUint16(o + 14, date, true);
    v.setUint32(o + 16, p.crc >>> 0, true);
    v.setUint32(o + 20, p.size, true);
    v.setUint32(o + 24, p.size, true);
    v.setUint16(o + 28, p.nameBytes.length, true);
    v.setUint16(o + 30, bigOffset ? 12 : 0, true);
    v.setUint16(o + 32, 0, true); // comment
    v.setUint16(o + 34, 0, true); // disk
    v.setUint16(o + 36, 0, true); // internal attrs
    v.setUint32(o + 38, (0o100644 << 16) >>> 0, true); // -rw-r--r--
    v.setUint32(o + 42, bigOffset ? U32_MAX : p.offset, true);
    buf.set(p.nameBytes, o + CENTRAL_HEADER);
    o += CENTRAL_HEADER + p.nameBytes.length;
    if (bigOffset) {
      v.setUint16(o, 0x0001, true); // ZIP64 extra
      v.setUint16(o + 2, 8, true);
      v.setBigUint64(o + 4, BigInt(p.offset), true);
      o += 12;
    }
  }
  if (zip64) {
    const eocd64Offset = cdOffset + cdSize;
    v.setUint32(o, 0x06064b50, true);
    v.setBigUint64(o + 4, BigInt(ZIP64_EOCD - 12), true);
    v.setUint16(o + 12, (3 << 8) | 45, true);
    v.setUint16(o + 14, 45, true);
    v.setUint32(o + 16, 0, true);
    v.setUint32(o + 20, 0, true);
    v.setBigUint64(o + 24, BigInt(planned.length), true);
    v.setBigUint64(o + 32, BigInt(planned.length), true);
    v.setBigUint64(o + 40, BigInt(cdSize), true);
    v.setBigUint64(o + 48, BigInt(cdOffset), true);
    o += ZIP64_EOCD;
    v.setUint32(o, 0x07064b50, true);
    v.setUint32(o + 4, 0, true);
    v.setBigUint64(o + 8, BigInt(eocd64Offset), true);
    v.setUint32(o + 16, 1, true);
    o += ZIP64_LOCATOR;
  }
  v.setUint32(o, 0x06054b50, true);
  v.setUint16(o + 4, 0, true);
  v.setUint16(o + 6, 0, true);
  v.setUint16(o + 8, zip64 ? U16_MAX : planned.length, true);
  v.setUint16(o + 10, zip64 ? U16_MAX : planned.length, true);
  v.setUint32(o + 12, zip64 ? U32_MAX : cdSize, true);
  v.setUint32(o + 16, zip64 ? U32_MAX : cdOffset, true);
  v.setUint16(o + 20, 0, true);
  return buf;
}

/** Builds the archive as a pull-based stream (backpressure-friendly). */
export function createZipStream(entries: ZipEntry[]): { stream: ReadableStream<Uint8Array>; size: number } {
  const { planned, cdOffset, cdSize, zip64, total } = plan(entries);
  let index = 0;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let written = 0;
  let finished = false;

  const stream = new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        try {
          while (true) {
            if (reader) {
              const { done, value } = await reader.read();
              if (!done && value) {
                written += value.byteLength;
                controller.enqueue(value);
                return;
              }
              const current = planned[index]!;
              reader = null;
              if (written !== current.size) throw new Error(`Size mismatch for ${current.name}: expected ${current.size}, got ${written}`);
              index++;
              continue;
            }
            if (index < planned.length) {
              const current = planned[index]!;
              const body = await current.open();
              if (!body) throw new Error(`Missing file ${current.name}`);
              reader = body.getReader();
              written = 0;
              controller.enqueue(localHeader(current));
              return;
            }
            if (!finished) {
              finished = true;
              controller.enqueue(centralDirectory(planned, cdOffset, cdSize, zip64));
              controller.close();
            }
            return;
          }
        } catch (err) {
          controller.error(err);
        }
      },
      async cancel() {
        await reader?.cancel().catch(() => {});
      },
    },
    { highWaterMark: 1 },
  );
  return { stream, size: total };
}
