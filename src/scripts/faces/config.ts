/**
 * Tunables of the on-device face pipeline. Values were tuned with the
 * harness in scripts/test-faces.mjs — change them together with a re-run.
 */

/** Detections below this confidence are ignored. */
export const MIN_CONFIDENCE = 0.5;
/** Faces smaller than this (shorter side of the box, in source pixels) give unreliable descriptors. */
export const MIN_FACE_PX = 36;

/** Square input size of the detector. */
export const DETECTOR_SIZE = 512;
/** Square face chip fed to the landmark network. */
export const LANDMARK_SIZE = 112;
/** Square aligned face chip fed to the descriptor network. */
export const DESCRIPTOR_SIZE = 150;

/**
 * Thorough mode tiles the image into a grid of overlapping, roughly square
 * tiles whose long side is ≈ TILE_TARGET px (measured on the image scaled to
 * TILE_WORK_MAX px), each scanned at full detector resolution.
 * For a 2048 px landscape photo that is a 3×2 grid of ~790 px tiles.
 */
export const TILE_TARGET = 900;
export const TILE_WORK_MAX = 2048;
export const TILE_OVERLAP = 0.2;

/** Non-max suppression inside one detector pass. */
export const NMS_IOU = 0.5;
/** Merging detections of several passes: same face when IoU or overlap-of-smaller exceed these. */
export const MERGE_IOU = 0.35;
export const MERGE_OVERLAP = 0.6;

/** Batch sizes for the per-face networks (fixed shapes avoid recompiling GPU programs). */
export const FACE_BATCHES = [1, 4, 16] as const;

/** Selfies are scaled down to this long edge before analysis. */
export const SELFIE_MAX_PX = 1280;

/**
 * Default clustering threshold: average Euclidean distance between two
 * groups of faces below which they are considered the same person.
 */
export const DEFAULT_CLUSTER_THRESHOLD = 0.5;

/** Version of the cached per-photo detections (bump when the pipeline changes). */
export const PIPELINE_VERSION = 1;
