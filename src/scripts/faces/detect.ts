/**
 * Detection pipeline: detector passes (full image + optional overlapping
 * tiles) → merge → 68 landmarks → aligned chips → 128-d descriptors.
 *
 * Every network input is drawn with the 2D canvas into fixed-size buffers
 * (512² for the detector, strips of 112²/150² face chips), so tensor shapes
 * never change between images: GPU programs are compiled once and the
 * texture pool stays bounded across hundreds of photos. All tensors are
 * disposed before returning.
 */
import {
  DESCRIPTOR_SIZE,
  DETECTOR_SIZE,
  FACE_BATCHES,
  LANDMARK_SIZE,
  MERGE_IOU,
  MERGE_OVERLAP,
  MIN_CONFIDENCE,
  MIN_FACE_PX,
  NMS_IOU,
  TILE_OVERLAP,
  TILE_TARGET,
  TILE_WORK_MAX,
} from './config';
import {
  alignFromLandmarks,
  decodeDetections,
  landmarkChip,
  mergeCandidates,
  tileGrid,
  touchesInnerEdge,
  type Alignment,
  type Candidate,
  type Region,
  type Tile,
} from './geometry';
import type { tf as TF } from '@vladmandic/face-api/dist/face-api.esm.js';
import { sourceSize } from './image';
import { activeBackend, type FaceApi } from './runtime';
import type { Box, DetectedFace, FaceSource } from './types';

type Tensor = TF.Tensor;

export interface DetectOptions {
  /** Also scan overlapping tiles at full detector resolution (small faces in group photos). */
  thorough?: boolean;
  minConfidence?: number;
  /** Minimum face size (shorter box side) in source pixels. */
  minFaceSize?: number;
}

/** Internal knobs, exposed for the test harness only. */
export const tuning = {
  /** Rotate aligned chips so the eyes are level before computing descriptors. */
  rotateChips: true,
  tileTarget: TILE_TARGET,
  /** When set, accumulates milliseconds per pipeline stage. */
  timings: null as Record<string, number> | null,
};

function lap(stage: string, since: number): number {
  const t = performance.now();
  if (tuning.timings) tuning.timings[stage] = (tuning.timings[stage] ?? 0) + (t - since);
  return t;
}

// ---------------------------------------------------------------------------
// Scratch canvases (reused; drawing + upload happen synchronously, so sharing is safe)

const scratchCanvases = new Map<string, HTMLCanvasElement>();

function scratch(key: string, width: number, height: number): CanvasRenderingContext2D {
  let canvas = scratchCanvases.get(key);
  if (!canvas) {
    canvas = document.createElement('canvas');
    scratchCanvases.set(key, canvas);
  }
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  // CPU/WASM backends read pixels back with getImageData; WebGL uploads the canvas directly.
  const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: activeBackend() !== 'webgl' });
  if (!ctx) throw new Error('Canvas 2D is not available');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  return ctx;
}

/** Draws `view` of the source top-left aligned into the square detector input (black letterbox). */
function drawDetectorView(ctx: CanvasRenderingContext2D, source: FaceSource, view: Region) {
  const k = DETECTOR_SIZE / Math.max(view.w, view.h);
  ctx.fillRect(0, 0, DETECTOR_SIZE, DETECTOR_SIZE);
  ctx.drawImage(source as CanvasImageSource, view.x, view.y, view.w, view.h, 0, 0, view.w * k, view.h * k);
}

/** Draws the aligned face chip: reference point at (0.5, 0.43) of the chip, eyes level when rotating. */
function drawAlignedChip(ctx: CanvasRenderingContext2D, source: FaceSource, a: Alignment, top: number, size: number) {
  const s = size / a.size;
  ctx.translate(0.5 * size, top + 0.43 * size);
  ctx.scale(s, s);
  if (tuning.rotateChips) ctx.rotate(-a.angle);
  ctx.translate(-a.cx, -a.cy);
  ctx.drawImage(source as CanvasImageSource, 0, 0);
}

// ---------------------------------------------------------------------------

/** Runs the detector over every view (batch 1, all queued before reading back) and decodes the boxes. */
async function detectorPasses(api: FaceApi, source: FaceSource, views: (Region | Tile)[], minScore: number): Promise<Candidate[]> {
  const { tf, nets, NetInput } = api;
  const ctx = scratch('detector', DETECTOR_SIZE, DETECTOR_SIZE);
  const outputs: { view: Region | Tile; boxes: Tensor; scores: Tensor }[] = [];
  try {
    for (const view of views) {
      drawDetectorView(ctx, source, view);
      const out = tf.tidy(() => {
        const { boxes, scores } = nets.ssdMobilenetv1.forwardInput(new NetInput([tf.browser.fromPixels(ctx.canvas)]));
        return [boxes[0]!, scores[0]!] as [Tensor, Tensor];
      });
      outputs.push({ view, boxes: out[0], scores: out[1] });
    }
    const found: Candidate[] = [];
    for (const { view, boxes, scores } of outputs) {
      const [b, s] = await Promise.all([boxes.data(), scores.data()]);
      let dets = decodeDetections(b as Float32Array, s as Float32Array, view, minScore, NMS_IOU);
      if ('inner' in view) dets = dets.filter((d) => !touchesInnerEdge(d.rect, view));
      found.push(...dets);
    }
    return found;
  } finally {
    for (const o of outputs) {
      o.boxes.dispose();
      o.scores.dispose();
    }
  }
}

type ChipDrawer = (ctx: CanvasRenderingContext2D, top: number) => void;

/**
 * Runs a per-face network on chips drawn into a vertical strip canvas, in
 * fixed batch sizes. Returns one output row per chip.
 */
async function faceNet(api: FaceApi, which: 'landmarks' | 'descriptors', draw: ChipDrawer[], size: number): Promise<Float32Array[]> {
  const { tf, nets, NetInput } = api;
  const net = which === 'landmarks' ? nets.faceLandmark68Net : nets.faceRecognitionNet;
  const rows: Float32Array[] = [];
  const largest = FACE_BATCHES[FACE_BATCHES.length - 1]!;
  for (let start = 0; start < draw.length; ) {
    const remaining = draw.length - start;
    const batch = FACE_BATCHES.find((b) => b >= remaining) ?? largest;
    const n = Math.min(batch, remaining);
    const ctx = scratch(`${which}-${batch}`, size, size * batch);
    for (let k = 0; k < n; k++) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, k * size, size, size);
      ctx.clip();
      draw[start + k]!(ctx, k * size);
      ctx.restore();
    }
    const out = tf.tidy(() => {
      const strip = tf.reshape(tf.browser.fromPixels(ctx.canvas), [batch, size, size, 3]);
      return net.forwardInput(new NetInput(tf.unstack(strip) as TF.Tensor3D[]));
    });
    let data: Float32Array;
    try {
      data = (await out.data()) as Float32Array;
    } finally {
      out.dispose();
    }
    const width = data.length / batch;
    for (let k = 0; k < n; k++) rows.push(data.slice(k * width, (k + 1) * width));
    start += n;
  }
  return rows;
}

/**
 * Runs every network once on blank input, with exactly the shapes used for a
 * selfie, so the GPU programs are compiled before the first real detection.
 */
export async function warmUp(api: FaceApi): Promise<void> {
  const blank: FaceSource = scratch('warmup', 8, 8).canvas;
  await detectorPasses(api, blank, [{ x: 0, y: 0, w: 8, h: 8 }], 0.99);
  await faceNet(api, 'landmarks', [() => undefined], LANDMARK_SIZE);
  await faceNet(api, 'descriptors', [() => undefined], DESCRIPTOR_SIZE);
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const round4 = (v: number) => Math.round(v * 1e4) / 1e4;

export function normaliseBox(r: Region, width: number, height: number): Box {
  const x = clamp01(r.x / width);
  const y = clamp01(r.y / height);
  return [round4(x), round4(y), round4(Math.min(1 - x, r.w / width)), round4(Math.min(1 - y, r.h / height))];
}

/** Full pipeline on a still source (videos must be snapshotted first). */
export async function runDetection(api: FaceApi, source: FaceSource, opts: DetectOptions = {}): Promise<DetectedFace[]> {
  const { width, height } = sourceSize(source);
  if (!width || !height) return [];
  const minScore = opts.minConfidence ?? MIN_CONFIDENCE;
  const minFace = opts.minFaceSize ?? MIN_FACE_PX;

  const views: (Region | Tile)[] = [{ x: 0, y: 0, w: width, h: height }];
  if (opts.thorough) views.push(...tileGrid(width, height, tuning.tileTarget, TILE_OVERLAP, TILE_WORK_MAX));

  let t = performance.now();
  const candidates = (await detectorPasses(api, source, views, minScore)).filter((c) => Math.min(c.rect.w, c.rect.h) >= minFace);
  const faces = mergeCandidates(candidates, MERGE_IOU, MERGE_OVERLAP);
  t = lap('detector', t);
  if (!faces.length) return [];

  // 68 landmarks on the detection box, as the reference pipeline crops it.
  const chips = faces.map((f) => landmarkChip(f.rect, width, height, LANDMARK_SIZE));
  const landmarkRows = await faceNet(
    api,
    'landmarks',
    chips.map((c) => (ctx, top) => ctx.drawImage(source as CanvasImageSource, c.sx, c.sy, c.sw, c.sh, c.dx, top + c.dy, c.sw * c.k, c.sh * c.k)),
    LANDMARK_SIZE,
  );
  const alignments = landmarkRows.map((rel, i) => {
    const c = chips[i]!;
    const pts = new Float32Array(136);
    for (let j = 0; j < 68; j++) {
      pts[j * 2] = c.sx + (rel[j * 2]! * LANDMARK_SIZE - c.dx) / c.k;
      pts[j * 2 + 1] = c.sy + (rel[j * 2 + 1]! * LANDMARK_SIZE - c.dy) / c.k;
    }
    return alignFromLandmarks(pts);
  });
  t = lap('landmarks', t);

  const descriptors = await faceNet(
    api,
    'descriptors',
    alignments.map((a) => (ctx, top) => drawAlignedChip(ctx, source, a, top, DESCRIPTOR_SIZE)),
    DESCRIPTOR_SIZE,
  );
  lap('descriptors', t);

  return faces
    .map((f, i): DetectedFace => {
      const sizeFactor = Math.min(1, Math.min(f.rect.w, f.rect.h) / 120);
      const frontal = alignments[i]!.frontal;
      return {
        box: normaliseBox(f.rect, width, height),
        score: Math.round(f.score * 1e4) / 1e4,
        descriptor: descriptors[i]!,
        quality: Math.round(f.score * (0.4 + 0.6 * sizeFactor) * (0.5 + 0.5 * frontal) * 1e4) / 1e4,
      };
    })
    .sort((a, b) => a.box[0] - b.box[0] || a.box[1] - b.box[1]);
}
