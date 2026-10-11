/**
 * On-device face recognition (face-api.js / TF.js), used by the client
 * gallery ("find yourself with a selfie") and the admin panel (grouping the
 * photos of a gallery by person).
 *
 * Importing this module is cheap: the engine (~1.3 MB) and the models
 * (~12 MB, /models/face-api/) are fetched on the first call that needs them.
 * Images never leave the device — only descriptors (128 numbers) do.
 *
 * Quick reference
 *   await loadFaceModels(({ done, total }) => …)        // optional pre-load with progress
 *   const faces = await detectFaces(bitmap, { thorough: true })
 *   const selfie = await describeSelfie(fileOrVideo)    // { descriptor, faces } | null
 *   const people = clusterFaces(items, { threshold: 0.5, minPhotos: 2 })
 *   const jpeg = await cropFace(bitmap, face.box)
 *   await analyzeGallery({ galleryId, photos, onProgress, signal })
 * Errors are FaceError instances (see `code`) or AbortError DOMExceptions.
 */
import { analyzeGalleryImpl, clusterAsync } from './analyze';
import { clearCache } from './cache';
import { clusterFacesSync } from './cluster';
import { SELFIE_MAX_PX } from './config';
import { runDetection, warmUp, type DetectOptions } from './detect';
import { closeSource, cropFaceJpeg, decodeBlob, isVideo, sourceSize, toCanvas, whenLoaded } from './image';
import { activeBackend, ensureReady, settings, tfRuntime, type Backend, type FaceSettings } from './runtime';
import type { Box, DetectedFace, FaceSource, PersonCluster, ProgressFn } from './types';

export type { Box, DetectedFace, PersonCluster, ProgressFn } from './types';
export type { Backend, FaceSettings } from './runtime';
export type { DetectOptions } from './detect';
export { FaceError, type FaceErrorCode } from './errors';
export { DEFAULT_CLUSTER_THRESHOLD } from './config';
export { euclidean as faceDistance } from '../../shared/face-codec';
export { FACE_MATCH_THRESHOLD } from '../../shared/gallery-types';

/** Optional: change where models / WASM binaries are loaded from. Call before the first load. */
export function configureFaces(options: Partial<FaceSettings>): void {
  Object.assign(settings, options);
}

/** Whether this browser can run face recognition at all (canvas + WebGL or WebAssembly). */
export function isFaceRecognitionSupported(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    if (!canvas.getContext('2d')) return false;
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl')) || typeof WebAssembly === 'object';
  } catch {
    return false;
  }
}

/** Diagnostics: active backend and live tensor memory (null before the models are loaded). */
export async function getFaceRuntimeInfo(): Promise<{ backend: Backend; tensors: number; bytes: number } | null> {
  const backend = activeBackend();
  if (!backend) return null;
  const memory = tfRuntime(await ensureReady()).memory();
  return { backend, tensors: memory.numTensors, bytes: memory.numBytes };
}

// Detections run one at a time: predictable GPU memory and lower latency per call.
let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

let warmed: Promise<void> | null = null;

/**
 * Load the TF.js backend and models from /models/face-api/. Safe to call
 * repeatedly. On WebGL it also compiles the GPU programs (message `warmup`),
 * so the first selfie is analysed without that delay.
 */
export async function loadFaceModels(onProgress?: ProgressFn): Promise<void> {
  const notify: ProgressFn = (info) => {
    try {
      onProgress?.(info);
    } catch {
      /* UI errors must not break loading */
    }
  };
  const api = await ensureReady((info) => info.message !== 'ready' && notify(info));
  if (activeBackend() === 'webgl') {
    notify({ stage: 'models', done: 1, total: 1, message: 'warmup' });
    warmed ??= exclusive(() => warmUp(api)).catch(() => {
      warmed = null; // not fatal: the first detection compiles instead
    });
    await warmed;
  }
  notify({ stage: 'models', done: 1, total: 1, message: 'ready' });
}

/** Detect faces with 128-d descriptors. `thorough` also scans overlapping tiles to catch small faces in group photos. */
export async function detectFaces(
  source: ImageBitmap | HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
  opts?: DetectOptions,
): Promise<DetectedFace[]> {
  const api = await ensureReady();
  await whenLoaded(source);
  // A playing video would change between the pipeline stages: freeze the current frame.
  const still: FaceSource = isVideo(source) ? toCanvas(source) : source;
  return exclusive(() => runDetection(api, still, opts));
}

/**
 * Descriptor of the largest face in a selfie (null when no face is found).
 * Accepts an image file, a bitmap, a canvas or a <video> (current frame);
 * the image is scaled down to ≤ 1280 px first.
 */
export async function describeSelfie(
  source: Blob | ImageBitmap | HTMLVideoElement | HTMLCanvasElement,
): Promise<{ descriptor: Float32Array; faces: number; box: Box; score: number } | null> {
  const api = await ensureReady();
  let image: FaceSource;
  if (source instanceof Blob) {
    const decoded = await decodeBlob(source);
    const { width, height } = sourceSize(decoded);
    if (Math.max(width, height) > SELFIE_MAX_PX) {
      image = toCanvas(decoded, SELFIE_MAX_PX);
      closeSource(decoded);
    } else {
      image = decoded;
    }
  } else {
    const { width, height } = sourceSize(source);
    image = isVideo(source) || Math.max(width, height) > SELFIE_MAX_PX ? toCanvas(source, SELFIE_MAX_PX) : source;
  }
  try {
    return await exclusive(async () => {
      let faces = await runDetection(api, image);
      // Small or partly hidden face: retry with the tiled scan.
      if (!faces.length) faces = await runDetection(api, image, { thorough: true });
      if (!faces.length) return null;
      const best = faces.reduce((a, b) => (b.box[2] * b.box[3] > a.box[2] * a.box[3] ? b : a));
      return { descriptor: best.descriptor, faces: faces.length, box: best.box, score: best.score };
    });
  } finally {
    if (image !== source) closeSource(image);
  }
}

/** Group faces of the same person across photos. Only people seen in ≥ minPhotos photos are returned. */
export function clusterFaces(
  items: { photoId: string; face: DetectedFace }[],
  opts?: { threshold?: number; minPhotos?: number },
): PersonCluster[] {
  return clusterFacesSync(items, opts);
}

/** Same as clusterFaces, but yields to the UI while working (large galleries). */
export function clusterFacesAsync(
  items: { photoId: string; face: DetectedFace }[],
  opts?: { threshold?: number; minPhotos?: number; signal?: AbortSignal; onProgress?: (fraction: number) => void },
): Promise<PersonCluster[]> {
  return clusterAsync(items, opts?.onProgress, opts?.signal, opts);
}

/** Square JPEG crop around a face (with some margin). */
export async function cropFace(source: ImageBitmap | HTMLImageElement | HTMLCanvasElement, box: Box, size = 192): Promise<Blob> {
  return cropFaceJpeg(source, box, size);
}

/** Forget cached per-photo detections (one gallery, or all). */
export function clearFaceCache(galleryId?: string): Promise<void> {
  return clearCache(galleryId);
}

/**
 * Admin helper: analyse every photo of a gallery, cluster people, upload the
 * face index, descriptors, people and face crops via the admin API.
 * The caller should POST /api/admin/galleries/{id}/publish afterwards.
 */
export async function analyzeGallery(opts: {
  galleryId: string;
  photos: { id: string; w: number; h: number }[];
  onProgress?: ProgressFn;
  signal?: AbortSignal;
  useCache?: boolean;
}): Promise<{ faces: number; people: number }> {
  return analyzeGalleryImpl(opts, {
    ready: ensureReady,
    detect: async (source, o) => {
      const api = await ensureReady();
      return exclusive(() => runDetection(api, source, o));
    },
  });
}
