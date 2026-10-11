/**
 * On-device face recognition (face-api.js / TF.js).
 *
 * INTERFACE STUB — the implementation is being built; the signatures below
 * are the contract used by the client gallery and the admin panel.
 */

/** [x, y, w, h] normalised to 0–1 relative to the image. */
export type Box = [number, number, number, number];

export interface DetectedFace {
  box: Box;
  score: number;
  descriptor: Float32Array;
}

export type ProgressFn = (info: { stage: 'models' | 'detect' | 'cluster' | 'upload'; done: number; total: number; message?: string }) => void;

export interface PersonCluster {
  id: string;
  /** Indices into the `items` array passed to clusterFaces. */
  members: number[];
  photoIds: string[];
  /** Index (into items) of the best face to use as the person's thumbnail. */
  representative: number;
}

const notReady = () => new Error('Face recognition module is not available yet');

/** Load the TF.js backend and models from /models/face-api/. Safe to call repeatedly. */
export async function loadFaceModels(_onProgress?: ProgressFn): Promise<void> {
  throw notReady();
}

/** Detect faces with 128-d descriptors. `thorough` also scans overlapping tiles to catch small faces in group photos. */
export async function detectFaces(_source: ImageBitmap | HTMLImageElement | HTMLCanvasElement, _opts?: { thorough?: boolean }): Promise<DetectedFace[]> {
  throw notReady();
}

/** Descriptor of the largest face in a selfie (null when no face is found). */
export async function describeSelfie(_source: Blob | ImageBitmap | HTMLVideoElement | HTMLCanvasElement): Promise<{ descriptor: Float32Array; faces: number } | null> {
  throw notReady();
}

/** Group faces of the same person across photos. Only people seen in ≥ minPhotos photos are returned. */
export function clusterFaces(_items: { photoId: string; face: DetectedFace }[], _opts?: { threshold?: number; minPhotos?: number }): PersonCluster[] {
  throw notReady();
}

/** Square JPEG crop around a face (with some margin). */
export async function cropFace(_source: ImageBitmap | HTMLImageElement | HTMLCanvasElement, _box: Box, _size = 192): Promise<Blob> {
  throw notReady();
}

/**
 * Admin helper: analyse every photo of a gallery, cluster people, upload the
 * face index, descriptors, people and face crops via the admin API.
 * The caller should POST /api/admin/galleries/{id}/publish afterwards.
 */
export async function analyzeGallery(_opts: {
  galleryId: string;
  photos: { id: string; w: number; h: number }[];
  onProgress?: ProgressFn;
  signal?: AbortSignal;
  useCache?: boolean;
}): Promise<{ faces: number; people: number }> {
  throw notReady();
}
