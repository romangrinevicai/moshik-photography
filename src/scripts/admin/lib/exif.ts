/**
 * Minimal EXIF reader: only DateTimeOriginal (+ its UTC offset) from a JPEG's
 * APP1 segment. Reads the first 256 KB at most; returns undefined on anything
 * unexpected — the photo then simply has no takenAt.
 */
const TAG_EXIF_IFD = 0x8769;
const TAG_DATETIME = 0x0132;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TAG_OFFSET_TIME_ORIGINAL = 0x9011;

export async function readTakenAt(file: Blob): Promise<string | undefined> {
  try {
    const buf = await file.slice(0, 256 * 1024).arrayBuffer();
    return parseJpegDate(new DataView(buf));
  } catch {
    return undefined;
  }
}

export function parseJpegDate(view: DataView): string | undefined {
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return undefined;
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset);
    if ((marker & 0xff00) !== 0xff00) return undefined;
    if (marker === 0xffda || marker === 0xffd9) return undefined; // image data starts: no EXIF
    const size = view.getUint16(offset + 2);
    if (marker === 0xffe1 && offset + 10 <= view.byteLength && view.getUint32(offset + 4) === 0x45786966 /* "Exif" */) {
      return parseTiff(view, offset + 10, Math.min(view.byteLength, offset + 2 + size));
    }
    offset += 2 + size;
  }
  return undefined;
}

function parseTiff(view: DataView, start: number, end: number): string | undefined {
  if (start + 8 > end) return undefined;
  const order = view.getUint16(start);
  const little = order === 0x4949;
  if (!little && order !== 0x4d4d) return undefined;
  const u16 = (o: number) => view.getUint16(o, little);
  const u32 = (o: number) => view.getUint32(o, little);
  if (u16(start + 2) !== 42) return undefined;

  const readIfd = (ifdOffset: number) => {
    const entries = new Map<number, { type: number; count: number; valueOffset: number }>();
    const base = start + ifdOffset;
    if (base + 2 > end) return entries;
    const n = u16(base);
    for (let i = 0; i < n; i++) {
      const e = base + 2 + i * 12;
      if (e + 12 > end) break;
      entries.set(u16(e), { type: u16(e + 2), count: u32(e + 4), valueOffset: e + 8 });
    }
    return entries;
  };
  const ascii = (entry: { type: number; count: number; valueOffset: number } | undefined) => {
    if (!entry || entry.type !== 2) return '';
    const at = entry.count > 4 ? start + u32(entry.valueOffset) : entry.valueOffset;
    let s = '';
    for (let i = 0; i < entry.count && at + i < end; i++) {
      const c = view.getUint8(at + i);
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s.trim();
  };

  const ifd0 = readIfd(u32(start + 4));
  const exifPtr = ifd0.get(TAG_EXIF_IFD);
  let date = '';
  let offsetTime = '';
  if (exifPtr) {
    const exif = readIfd(u32(exifPtr.valueOffset));
    date = ascii(exif.get(TAG_DATETIME_ORIGINAL));
    offsetTime = ascii(exif.get(TAG_OFFSET_TIME_ORIGINAL));
  }
  if (!date) date = ascii(ifd0.get(TAG_DATETIME));
  return toIso(date, offsetTime);
}

/** "2026:06:18 19:42:07" (+ "+03:00") → "2026-06-18T19:42:07+03:00" */
export function toIso(exifDate: string, offset = ''): string | undefined {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(exifDate);
  if (!m) return undefined;
  const [, y, mo, d, hh, mm, ss] = m;
  if (Number(y) < 1990 || Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) return undefined;
  const tz = /^[+-]\d{2}:\d{2}$/.test(offset) ? offset : '';
  return `${y}-${mo}-${d}T${hh}:${mm}:${ss}${tz}`;
}
