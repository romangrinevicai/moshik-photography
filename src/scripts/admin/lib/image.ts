/**
 * Browser-side resizing for gallery uploads (docs/ARCHITECTURE.md → Upload pipeline):
 * decode with EXIF rotation applied, then web (2048 px, q 0.86) and thumb (640 px, q 0.8) JPEGs.
 */
export const WEB_EDGE = 2048;
export const WEB_QUALITY = 0.86;
export const THUMB_EDGE = 640;
export const THUMB_QUALITY = 0.8;

export class DecodeError extends Error {
  constructor(public kind: 'heic' | 'raw' | 'decode') {
    super(kind);
    this.name = 'DecodeError';
  }
}

export const RAW_EXT = new Set(['cr2', 'cr3', 'nef', 'nrw', 'arw', 'srf', 'sr2', 'raf', 'orf', 'rw2', 'dng', 'pef', 'srw', 'x3f', '3fr', 'iiq', 'erf', 'mrw', 'kdc']);
export const IMAGE_EXT = new Set(['jpg', 'jpeg', 'jpe', 'jfif', 'png', 'webp', 'avif', 'heic', 'heif', 'gif', 'bmp', 'tif', 'tiff']);

export const extOf = (name: string) => (/\.([a-z0-9]{1,5})$/i.exec(name)?.[1] ?? '').toLowerCase();

export function isImageFile(file: File): boolean {
  const ext = extOf(file.name);
  if (RAW_EXT.has(ext)) return false;
  return file.type.startsWith('image/') || IMAGE_EXT.has(ext);
}

export const isRaw = (file: File) => RAW_EXT.has(extOf(file.name));
export const isHeic = (file: File) => /hei[cf]/i.test(file.type) || ['heic', 'heif'].includes(extOf(file.name));

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jpe: 'image/jpeg',
  jfif: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  heic: 'image/heic',
  heif: 'image/heif',
  gif: 'image/gif',
  bmp: 'image/bmp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
};
export const mimeOf = (file: File) => file.type || MIME_BY_EXT[extOf(file.name)] || 'application/octet-stream';

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;

function makeCanvas(w: number, h: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function context(c: AnyCanvas) {
  const ctx = c.getContext('2d', { alpha: false }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new DecodeError('decode');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}

async function toJpeg(c: AnyCanvas, quality: number): Promise<Blob> {
  if ('convertToBlob' in c) return c.convertToBlob({ type: 'image/jpeg', quality });
  return new Promise((resolve, reject) => (c as HTMLCanvasElement).toBlob((b) => (b ? resolve(b) : reject(new DecodeError('decode'))), 'image/jpeg', quality));
}

const fit = (w: number, h: number, edge: number) => {
  const scale = Math.min(1, edge / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
};

export interface Prepared {
  web: Blob;
  thumb: Blob;
  /** Dimensions of the web variant (what the lightbox shows). */
  w: number;
  h: number;
}

export async function preparePhoto(file: File): Promise<Prepared> {
  if (isRaw(file)) throw new DecodeError('raw');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new DecodeError(isHeic(file) ? 'heic' : 'decode');
  }
  try {
    const web = fit(bitmap.width, bitmap.height, WEB_EDGE);
    const webCanvas = makeCanvas(web.w, web.h);
    const ctx = context(webCanvas);
    ctx.fillStyle = '#ffffff'; // transparent PNGs become white, not black
    ctx.fillRect(0, 0, web.w, web.h);
    ctx.drawImage(bitmap, 0, 0, web.w, web.h);
    bitmap.close();

    // Thumb from the already-reduced web canvas: sharper and much faster.
    const th = fit(web.w, web.h, THUMB_EDGE);
    const thumbCanvas = makeCanvas(th.w, th.h);
    context(thumbCanvas).drawImage(webCanvas as CanvasImageSource, 0, 0, th.w, th.h);

    const [webBlob, thumbBlob] = await Promise.all([toJpeg(webCanvas, WEB_QUALITY), toJpeg(thumbCanvas, THUMB_QUALITY)]);
    // Release canvas memory early on mobile.
    webCanvas.width = webCanvas.height = 0;
    thumbCanvas.width = thumbCanvas.height = 0;
    return { web: webBlob, thumb: thumbBlob, w: web.w, h: web.h };
  } catch (e) {
    try {
      bitmap.close();
    } catch {
      /* already closed */
    }
    throw e instanceof DecodeError ? e : new DecodeError('decode');
  }
}
