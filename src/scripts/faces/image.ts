/** Canvas helpers: decoding, snapshots, down-scaling and face crops (no TF). */
import { FaceError } from './errors';
import { squareCrop } from './geometry';
import type { Box, FaceSource } from './types';

/**
 * Margin added on every side of the face box in thumbnails, as a fraction of
 * the face size: the crop is ≈ 1.6× the box (≈ 60 % margin in total), which
 * keeps hair and chin and still reads well in small round avatars.
 */
export const CROP_MARGIN = 0.3;

export function sourceSize(src: FaceSource): { width: number; height: number } {
  if (typeof HTMLImageElement !== 'undefined' && src instanceof HTMLImageElement) return { width: src.naturalWidth, height: src.naturalHeight };
  if (typeof HTMLVideoElement !== 'undefined' && src instanceof HTMLVideoElement) return { width: src.videoWidth, height: src.videoHeight };
  return { width: src.width, height: src.height };
}

export const isVideo = (src: unknown): src is HTMLVideoElement =>
  typeof HTMLVideoElement !== 'undefined' && src instanceof HTMLVideoElement;

/** Copies the source (or the current video frame) into a new canvas, scaled down to `maxSide` if larger. */
export function toCanvas(source: FaceSource, maxSide = Infinity): HTMLCanvasElement {
  const { width, height } = sourceSize(source);
  if (!width || !height) throw new FaceError('decode', 'The image has no pixels (not loaded yet?)');
  const k = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * k));
  canvas.height = Math.max(1, Math.round(height * k));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new FaceError('unsupported', 'Canvas 2D is not available');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Waits until an <img> has decoded. */
export async function whenLoaded(source: FaceSource): Promise<void> {
  if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement && !(source.complete && source.naturalWidth)) {
    try {
      await source.decode();
    } catch (err) {
      throw new FaceError('decode', 'Could not decode the image', { cause: err });
    }
  }
}

async function decodeWithImageElement(blob: Blob): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return toCanvas(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Decodes an image file with its EXIF orientation applied. */
export async function decodeBlob(blob: Blob): Promise<ImageBitmap | HTMLCanvasElement> {
  let firstError: unknown;
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch (err) {
      firstError = err;
    }
  }
  try {
    // e.g. HEIC on Safari: <img> can decode formats createImageBitmap rejects.
    return await decodeWithImageElement(blob);
  } catch (err) {
    throw new FaceError('decode', 'Could not read this image file', { cause: firstError ?? err });
  }
}

export const closeSource = (src: unknown) => {
  if (typeof ImageBitmap !== 'undefined' && src instanceof ImageBitmap) src.close();
};

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new FaceError('decode', 'Could not encode the face crop'))), 'image/jpeg', quality);
  });
}

/** Square JPEG thumbnail of a face: the box plus CROP_MARGIN on each side, kept inside the image. */
export async function cropFaceJpeg(source: FaceSource, box: Box, size = 192, quality = 0.85): Promise<Blob> {
  await whenLoaded(source);
  const { width, height } = sourceSize(source);
  if (!width || !height) throw new FaceError('decode', 'The image has no pixels');
  const face = { x: box[0] * width, y: box[1] * height, w: box[2] * width, h: box[3] * height };
  const r = squareCrop(face, width, height, CROP_MARGIN);
  const out = Math.max(16, Math.round(size));
  const canvas = document.createElement('canvas');
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new FaceError('unsupported', 'Canvas 2D is not available');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source as CanvasImageSource, r.x, r.y, r.w, r.h, 0, 0, out, out);
  return canvasToJpeg(canvas, quality);
}
