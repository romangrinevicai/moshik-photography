/** Public types of the face module (re-exported by ./index.ts). */

/** [x, y, w, h] normalised to 0–1 relative to the image. */
export type Box = [number, number, number, number];

export interface DetectedFace {
  box: Box;
  /** Detector confidence (0–1). */
  score: number;
  /** 128-d descriptor; same person ≈ distance < 0.5. */
  descriptor: Float32Array;
  /** 0–1 heuristic (confidence × size × frontal pose), used to pick thumbnails. */
  quality?: number;
}

export type ProgressFn = (info: {
  stage: 'models' | 'detect' | 'cluster' | 'upload';
  done: number;
  total: number;
  message?: string;
}) => void;

export interface PersonCluster {
  id: string;
  /** Indices into the `items` array passed to clusterFaces. */
  members: number[];
  photoIds: string[];
  /** Index (into items) of the best face to use as the person's thumbnail. */
  representative: number;
}

/** Anything the pipeline can read pixels from. */
export type FaceSource = ImageBitmap | HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | OffscreenCanvas;
